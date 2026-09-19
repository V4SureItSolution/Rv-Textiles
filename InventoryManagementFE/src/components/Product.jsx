// Product.jsx — Textile Stock Management (Search & Filter Upgrade)
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Download, Upload, Trash2, Save, Search, RefreshCw,
  X, ChevronLeft, ChevronRight, Edit, Hash, Tag, Package,
  AlertTriangle, Filter, XCircle, Printer,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import JsBarcode from "jsbarcode";
import { formatDate } from "../utils/dateUtils";
import { printProductSticker } from "../utils/printProductSticker";

const API_URL = "http://localhost:5000/api/products";
const SUPPLIER_API_URL = "http://localhost:5000/api";

const TEXTILE_CATEGORIES = [
  "Cotton", "Silk", "Polyester", "Linen", "Denim",
  "Wool", "Rayon", "Nylon", "Chiffon", "Georgette",
  "Velvet", "Satin", "Knit", "Fleece", "Other",
];

const TEXTILE_UNITS = [
  "Meters", "Yards", "Kilograms", "Pieces", "Rolls", "Bundles", "Boxes",
];

const LOW_STOCK_THRESHOLD = 5;

// ─── Helper: profit margin colour ─────────────────────────────────────────────
const marginColor = (pct) => {
  if (pct === null || pct === undefined) return "#9ca3af";
  if (pct < 0)  return "#f87171";  // red
  if (pct < 15) return "#fbbf24";  // amber
  return "#4ade80";                // green
};

export default function ItemsPage() {
  // ── Core state ─────────────────────────────────────────────────────────────
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [suppliers, setSuppliers] = useState([]);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [search,           setSearch]           = useState("");
  const [filterCategory,   setFilterCategory]   = useState("");
  const [filterUnit,       setFilterUnit]       = useState("");
  const [filterSupplierId, setFilterSupplierId] = useState("");
  const [minPrice,         setMinPrice]         = useState("");
  const [maxPrice,         setMaxPrice]         = useState("");
  const [filterLowStock,   setFilterLowStock]   = useState(false);

  // ── Sort state ─────────────────────────────────────────────────────────────
  const [sortBy,  setSortBy]  = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  // ── Pagination state ───────────────────────────────────────────────────────
  const [currentPage,  setCurrentPage]  = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems,   setTotalItems]   = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);

  // ── Stats from API ─────────────────────────────────────────────────────────
  const [filterSummary, setFilterSummary] = useState(null);

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem,   setEditingItem]   = useState(null);

  // ── Import modal ───────────────────────────────────────────────────────────
  const [showImportModal,  setShowImportModal]  = useState(false);
  const [importedItems,    setImportedItems]    = useState([]);
  const [processingImport, setProcessingImport] = useState(false);
  const [importStats,      setImportStats]      = useState({ added: 0, updated: 0, skipped: 0 });

  // ── Product Sticker modal state ────────────────────────────────────────────
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [stickerProduct,   setStickerProduct]   = useState(null);
  const [stickerCopies,    setStickerCopies]    = useState(1);
  const [stickerMrp,       setStickerMrp]       = useState("");
  const [stickerSellPrice, setStickerSellPrice] = useState("");
  const [stickerBarcode,   setStickerBarcode]   = useState("");
  const previewSvgRef = useRef(null);

  // ── Computed: any active filter? ───────────────────────────────────────────
  const hasActiveFilters = !!(
    search || filterCategory || filterUnit || filterSupplierId ||
    minPrice || maxPrice || filterLowStock
  );

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  // Initial: load suppliers once
  useEffect(() => {
    loadSuppliers();
  }, []);

  // Debounced reload whenever any filter/sort/paging param changes
  useEffect(() => {
    const t = setTimeout(() => loadProducts(1), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterCategory, filterUnit, filterSupplierId,
      minPrice, maxPrice, filterLowStock, itemsPerPage, sortBy, sortDir]);

  // Auto-hide message
  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: "", text: "" }), 3500);
    return () => clearTimeout(t);
  }, [message]);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────

  const showMessage = (type, text) => setMessage({ type, text });

  const loadSuppliers = async () => {
    try {
      const res = await fetch(`${SUPPLIER_API_URL}/suppliers`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.suppliers || data.data || [];
      setSuppliers(list);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    }
  };

  /** Build the full URL for GET /products with all current filters */
  const buildProductUrl = useCallback(
    (page) => {
      const params = new URLSearchParams();
      params.set("page",       page);
      params.set("per_page",   itemsPerPage);
      params.set("sort_by",    sortBy);
      params.set("sort_order", sortDir);
      if (search.trim())        params.set("search",      search.trim());
      if (filterCategory)       params.set("category",    filterCategory);
      if (filterUnit)           params.set("unit",        filterUnit);
      if (filterSupplierId)     params.set("supplier_id", filterSupplierId);
      if (minPrice !== "" && !isNaN(+minPrice)) params.set("min_price", minPrice);
      if (maxPrice !== "" && !isNaN(+maxPrice)) params.set("max_price", maxPrice);
      if (filterLowStock)       params.set("low_stock",   "true");
      return `${API_URL}?${params.toString()}`;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, filterCategory, filterUnit, filterSupplierId,
     minPrice, maxPrice, filterLowStock, itemsPerPage, sortBy, sortDir]
  );

  const loadProducts = async (page = 1) => {
    setLoading(true);
    try {
      const res  = await fetch(buildProductUrl(page));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let arr = [];
      if (data?.items && Array.isArray(data.items)) {
        arr = data.items;
        setTotalItems(data.total  || 0);
        setTotalPages(data.pages  || 1);
        setCurrentPage(data.current_page || page);
        if (data.filter_summary) setFilterSummary(data.filter_summary);
      } else if (Array.isArray(data)) {
        arr = data;
        setTotalItems(arr.length);
        setTotalPages(Math.ceil(arr.length / itemsPerPage) || 1);
      } else {
        setTotalItems(0);
        setTotalPages(1);
      }

      setItems(arr.map((item) => calculateAmount({ ...item })));
    } catch (err) {
      console.error("Error fetching products:", err);
      showMessage("error", "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const calculateAmount = (item) => {
    const sell = parseFloat(item.sellPrice) || 0;
    const qty  = parseInt(item.quantity)    || 0;
    const mrp  = item.mrp !== undefined && item.mrp !== null && item.mrp !== ""
      ? item.mrp
      : (sell > 0 ? (sell * 1.25).toFixed(2) : "");
    return {
      ...item,
      amount: (sell * qty).toFixed(2),
      buyPrice: parseFloat(item.buyPrice) || 0,
      sellPrice: sell,
      mrp: mrp,
      quantity: qty,
    };
  };

  const isSameProduct = (a, b) => {
    const nameMatch = (a.name || "").trim().toLowerCase() === (b.name || "").trim().toLowerCase();
    const codeA = (a.productCode || a.product_code || "").trim().toLowerCase();
    const codeB = (b.productCode || b.product_code || "").trim().toLowerCase();
    if (codeA && codeB) return nameMatch && codeA === codeB;
    return nameMatch;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SORT
  // ─────────────────────────────────────────────────────────────────────────

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ color: "#4b5563", marginLeft: "4px", fontSize: "11px" }}>↕</span>;
    return <span style={{ color: "#818cf8", marginLeft: "4px", fontSize: "11px" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FILTERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleClearFilters = () => {
    setSearch("");
    setFilterCategory("");
    setFilterUnit("");
    setFilterSupplierId("");
    setMinPrice("");
    setMaxPrice("");
    setFilterLowStock(false);
    setSortBy("created_at");
    setSortDir("desc");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // EDIT / ADD
  // ─────────────────────────────────────────────────────────────────────────

  const handleEditClick = (item) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
  };

  const handleEditChange = (field, value) => {
    setEditingItem((prev) => calculateAmount({ ...prev, [field]: value }));
  };

  const handleEditSave = async () => {
    if (!editingItem) return;
    if (!editingItem.name?.trim()) {
      showMessage("error", "Product name is required");
      return;
    }

    setSaving(true);
    try {
      const productData = {
        name:        editingItem.name.trim(),
        productCode: editingItem.productCode?.trim() || "",
        category:    editingItem.category  || "",
        unit:        editingItem.unit      || "",
        supplierId:  editingItem.supplierId || null,
        buyPrice:    parseFloat(editingItem.buyPrice)  || 0,
        sellPrice:   parseFloat(editingItem.sellPrice) || 0,
        mrp:         editingItem.mrp ? parseFloat(editingItem.mrp) : null,
        quantity:    parseInt(editingItem.quantity)    || 0,
      };

      const response = editingItem.isNew
        ? await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(productData),
          })
        : await fetch(`${API_URL}/${editingItem.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(productData),
          });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.errors ? err.errors.join(", ") : "Failed to save product");
      }

      showMessage("success", `Item ${editingItem.isNew ? "created" : "updated"} successfully!`);
      setShowEditModal(false);
      setEditingItem(null);
      await loadProducts(currentPage);
    } catch (err) {
      showMessage("error", `Failed to save item: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewItem = () => {
    setEditingItem(calculateAmount({
      id: `new-${Date.now()}`, name: "", productCode: "", category: "",
      unit: "", supplierId: null, buyPrice: "", sellPrice: "", mrp: "", quantity: "", isNew: true,
    }));
    setShowEditModal(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCT STICKER HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleOpenStickerModal = (item = null) => {
    const target = item || (items.length > 0 ? items[0] : null);
    if (!target) {
      showMessage("info", "No products available to generate stickers.");
      return;
    }

    const sell = parseFloat(target.sellPrice) || 0;
    const rawMrp = target.mrp !== undefined && target.mrp !== null && target.mrp !== ""
      ? parseFloat(target.mrp)
      : (sell > 0 ? Math.round(sell * 1.25) : 0);
    const code = String(
      target.productCode || (target.id ? `RVT-${String(target.id).padStart(5, "0")}` : "000000")
    ).trim();

    setStickerProduct(target);
    setStickerCopies(parseInt(target.quantity) > 0 ? parseInt(target.quantity) : 1);
    setStickerMrp(rawMrp > 0 ? rawMrp.toFixed(2) : (sell * 1.25).toFixed(2));
    setStickerSellPrice(sell.toFixed(2));
    setStickerBarcode(code);
    setShowStickerModal(true);
  };

  const handleSelectStickerProduct = (id) => {
    const found = items.find((p) => String(p.id) === String(id));
    if (found) {
      const sell = parseFloat(found.sellPrice) || 0;
      const rawMrp = found.mrp !== undefined && found.mrp !== null && found.mrp !== ""
        ? parseFloat(found.mrp)
        : (sell > 0 ? Math.round(sell * 1.25) : 0);
      const code = String(
        found.productCode || (found.id ? `RVT-${String(found.id).padStart(5, "0")}` : "000000")
      ).trim();

      setStickerProduct(found);
      setStickerCopies(parseInt(found.quantity) > 0 ? parseInt(found.quantity) : 1);
      setStickerMrp(rawMrp > 0 ? rawMrp.toFixed(2) : (sell * 1.25).toFixed(2));
      setStickerSellPrice(sell.toFixed(2));
      setStickerBarcode(code);
    }
  };

  // Live SVG barcode rendering in modal
  useEffect(() => {
    if (showStickerModal && previewSvgRef.current && stickerBarcode) {
      try {
        JsBarcode(previewSvgRef.current, stickerBarcode, {
          format: "CODE128",
          width: 1.4,
          height: 34,
          displayValue: false,
          margin: 0,
        });
      } catch (e) {
        console.error("Barcode preview error:", e);
      }
    }
  }, [showStickerModal, stickerBarcode]);

  const handlePrintSticker = () => {
    if (!stickerProduct) return;
    const printItem = {
      ...stickerProduct,
      productCode: stickerBarcode || stickerProduct.productCode,
      mrp: parseFloat(stickerMrp) || 0,
      sellPrice: parseFloat(stickerSellPrice) || 0,
    };
    printProductSticker(printItem, {
      copies: parseInt(stickerCopies) || 1,
      storeName: "RV FASHION",
    });
    showMessage("success", `Sticker print initiated for ${stickerProduct.name}`);
  };

  const handlePrintAllStickers = () => {
    if (items.length === 0) return;
    printProductSticker(items, {
      storeName: "RV FASHION",
    });
    showMessage("success", `Sticker print initiated for all ${items.length} products`);
    setShowStickerModal(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE / REFRESH
  // ─────────────────────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    await loadProducts(currentPage);
    showMessage("success", "Refreshed!");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      if (!String(id).startsWith("new-")) {
        const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        if (res.status === 404) {
          showMessage("info", "Item was already deleted");
          await loadProducts(currentPage);
          return;
        }
        if (!res.ok) {
          let errorMsg = "Failed to delete";
          try {
            const e = await res.json();
            errorMsg = e.error || e.message || errorMsg;
          } catch {
            errorMsg = await res.text();
          }
          throw new Error(errorMsg);
        }
      }
      showMessage("success", "Item deleted");
      await loadProducts(currentPage);
    } catch (err) {
      showMessage("error", `Delete failed: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      // Export all matching the current filters (up to 5000 rows)
      const res  = await fetch(buildProductUrl(1).replace(`per_page=${itemsPerPage}`, "per_page=5000"));
      const data = await res.json();
      const arr  = data?.items ?? (Array.isArray(data) ? data : []);

      const exportData = arr.map((item) => ({
        ID:               item.id || "",
        "Product Code":   item.productCode || "",
        Name:             item.name || "",
        Category:         item.category || "",
        Unit:             item.unit || "",
        Supplier:         item.supplierName || "",
        "Purchase Price": item.buyPrice || 0,
        "Sell Price":     item.sellPrice || 0,
        Quantity:         item.quantity || 0,
        "Margin %":       item.profitPercent || 0,
        Amount:           parseFloat(item.amount || 0).toFixed(2),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 6 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
        { wch: 10 }, { wch: 22 }, { wch: 14 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Textile Stock");
      saveAs(
        new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }),
        `TextileStock_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      showMessage("success", "Export successful!");
    } catch (err) {
      showMessage("error", "Export failed: " + err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // IMPORT
  // ─────────────────────────────────────────────────────────────────────────

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(new Uint8Array(evt.target.result), { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!rows.length) { showMessage("error", "No data in file"); return; }

        const processed = rows
          .map((row, i) => ({
            id: `import-${Date.now()}-${i}`,
            name:        row["Name"]         || row["name"]        || row["Product"] || "",
            productCode: row["Product Code"] || row["productCode"] || row["SKU"]     || row["Code"] || "",
            category:    row["Category"]     || row["category"]    || "",
            unit:        row["Unit"]         || row["unit"]        || "",
            supplierId:  null,
            buyPrice:    parseFloat(row["Purchase Price"] || row["Buy Price"] || row["buyPrice"] || 0),
            sellPrice:   parseFloat(row["Sell Price"]    || row["sellPrice"] || 0),
            quantity:    parseInt  (row["Quantity"]      || row["quantity"]  || row["Qty"] || 0),
            isNew: true, selected: true,
          }))
          .filter((item) => item.name);

        if (!processed.length) { showMessage("error", "No valid rows found (missing 'Name' column?)"); return; }
        setImportedItems(processed);
        setShowImportModal(true);
        setImportStats({ added: 0, updated: 0, skipped: 0 });
        e.target.value = "";
      } catch (err) {
        showMessage("error", "Import parse error: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processImportedItems = async () => {
    const toProcess = importedItems.filter((i) => i.selected);
    if (!toProcess.length) { showMessage("error", "No items selected"); return; }
    setProcessingImport(true);

    try {
      const existing = await fetch(`${API_URL}?page=1&per_page=2000`)
        .then((r) => r.json())
        .then((d) => d?.items ?? (Array.isArray(d) ? d : []));

      let added = 0, updated = 0, skipped = 0;

      for (const imp of toProcess) {
        try {
          const found = existing.find((x) => isSameProduct(x, imp));
          if (found) {
            const importSell = parseFloat(imp.sellPrice) || 0;
            const existSell  = parseFloat(found.sellPrice) || 0;
            if (importSell === 0 || Math.abs(importSell - existSell) < 0.01) {
              const r = await fetch(`${API_URL}/${found.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: found.name, productCode: found.productCode || "",
                  category: found.category || "", unit: found.unit || "",
                  buyPrice: found.buyPrice || 0, sellPrice: found.sellPrice || 0,
                  quantity: (parseInt(found.quantity) || 0) + (parseInt(imp.quantity) || 0),
                }),
              });
              r.ok ? updated++ : skipped++;
            } else {
              const r = await fetch(API_URL, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: imp.name, productCode: imp.productCode || "",
                  category: imp.category || "", unit: imp.unit || "",
                  buyPrice: parseFloat(imp.buyPrice) || 0, sellPrice: importSell,
                  quantity: parseInt(imp.quantity) || 0,
                }),
              });
              r.ok ? added++ : skipped++;
            }
          } else {
            const r = await fetch(API_URL, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: imp.name, productCode: imp.productCode || "",
                category: imp.category || "", unit: imp.unit || "",
                buyPrice: parseFloat(imp.buyPrice) || 0,
                sellPrice: parseFloat(imp.sellPrice) || 0,
                quantity: parseInt(imp.quantity) || 0,
              }),
            });
            r.ok ? added++ : skipped++;
          }
        } catch { skipped++; }
      }

      setImportStats({ added, updated, skipped });
      await loadProducts(currentPage);
      showMessage("success", `Import done! ✅ ${added} added  📈 ${updated} updated  ⏭️ ${skipped} skipped`);
      setTimeout(() => { setShowImportModal(false); setImportedItems([]); }, 3000);
    } catch (err) {
      showMessage("error", "Import failed: " + err.message);
    } finally {
      setProcessingImport(false);
    }
  };

  const toggleImportItem = (i) =>
    setImportedItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, selected: !it.selected } : it)));

  const toggleAllImport = () => {
    const all = importedItems.every((i) => i.selected);
    setImportedItems((prev) => prev.map((it) => ({ ...it, selected: !all })));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGINATION
  // ─────────────────────────────────────────────────────────────────────────

  const paginate = (n) => { if (n > 0 && n <= totalPages) { setCurrentPage(n); loadProducts(n); } };
  const goPrev   = ()  => { if (currentPage > 1)          { const p = currentPage - 1; setCurrentPage(p); loadProducts(p); } };
  const goNext   = ()  => { if (currentPage < totalPages)  { const p = currentPage + 1; setCurrentPage(p); loadProducts(p); } };

  // ─────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────

  const S = {
    // Layout
    container:    { padding: "40px 60px", backgroundColor: "#0f172a", minHeight: "100vh", color: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif" },
    header:       { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" },
    headerTitle:  { display: "flex", alignItems: "center", gap: "12px" },
    title:        { fontSize: "26px", fontWeight: "700", margin: 0, letterSpacing: "-0.5px" },
    buttonGroup:  { display: "flex", gap: "8px", flexWrap: "wrap" },

    // Buttons
    btn: {
      display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px",
      borderRadius: "7px", backgroundColor: "#1e293b", color: "#f1f5f9",
      border: "1px solid #334155", cursor: "pointer", fontSize: "13px",
      fontWeight: "500", transition: "all 0.15s",
    },
    btnPrimary: { backgroundColor: "#6366f1", border: "none", color: "#fff" },
    btnGhost:   { background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "6px", borderRadius: "6px", display: "flex", alignItems: "center" },

    // Filter bar
    filterBar: {
      display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center",
      padding: "14px 16px", backgroundColor: "#1e293b", borderRadius: "10px",
      marginBottom: "14px", border: "1px solid #334155",
    },
    filterInput: {
      padding: "7px 10px", backgroundColor: "#0f172a", border: "1px solid #334155",
      color: "#f1f5f9", borderRadius: "6px", fontSize: "13px", minWidth: "140px",
    },
    filterSearchWrapper: { position: "relative", flex: "1", minWidth: "200px", maxWidth: "320px" },
    filterSearchIcon:    { position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748b" },
    filterSearchInput: {
      width: "100%", padding: "7px 10px 7px 34px", backgroundColor: "#0f172a",
      border: "1px solid #334155", color: "#f1f5f9", borderRadius: "6px", fontSize: "13px",
      boxSizing: "border-box",
    },
    lowStockBtn: (active) => ({
      display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px",
      borderRadius: "6px", fontSize: "13px", cursor: "pointer", fontWeight: "500",
      border: active ? "1px solid #d97706" : "1px solid #334155",
      backgroundColor: active ? "rgba(217,119,6,0.15)" : "#0f172a",
      color: active ? "#fbbf24" : "#94a3b8",
      transition: "all 0.15s",
    }),
    clearBtn: {
      display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px",
      borderRadius: "6px", fontSize: "13px", cursor: "pointer", fontWeight: "500",
      border: "1px solid #ef4444", backgroundColor: "rgba(239,68,68,0.08)",
      color: "#f87171", transition: "all 0.15s",
    },

    // Stats bar
    statsBar: {
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px",
      marginBottom: "14px",
    },
    statCard: (accent) => ({
      padding: "12px 16px", backgroundColor: "#1e293b", borderRadius: "8px",
      border: `1px solid #334155`, borderLeft: `3px solid ${accent}`,
    }),
    statLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "4px" },
    statValue: { fontSize: "20px", fontWeight: "700", color: "#f1f5f9" },

    // Table
    tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid #334155" },
    table:     { width: "100%", borderCollapse: "collapse", backgroundColor: "#1e293b", minWidth: "1300px" },
    th: {
      backgroundColor: "#0f172a", padding: "11px 12px", textAlign: "left",
      color: "#94a3b8", fontWeight: "600", fontSize: "12px", whiteSpace: "nowrap",
      cursor: "pointer", userSelect: "none", borderBottom: "1px solid #334155",
      transition: "color 0.15s",
    },
    thStatic: {
      backgroundColor: "#0f172a", padding: "11px 12px", textAlign: "left",
      color: "#94a3b8", fontWeight: "600", fontSize: "12px", whiteSpace: "nowrap",
      borderBottom: "1px solid #334155",
    },
    td:         { padding: "11px 12px", borderTop: "1px solid #1e3a5f22", color: "#e2e8f0", fontSize: "13px" },
    tdLowStock: { padding: "11px 12px", borderTop: "1px solid #1e3a5f22", color: "#e2e8f0", fontSize: "13px", borderLeft: "3px solid #d97706" },

    // Pills
    catPill: {
      display: "inline-block", padding: "2px 9px", borderRadius: "12px", fontSize: "11px",
      fontWeight: "600", backgroundColor: "rgba(99,102,241,0.12)", color: "#a5b4fc",
      border: "1px solid rgba(99,102,241,0.25)",
    },
    unitPill: {
      display: "inline-block", padding: "2px 9px", borderRadius: "12px", fontSize: "11px",
      backgroundColor: "rgba(16,185,129,0.10)", color: "#6ee7b7",
      border: "1px solid rgba(16,185,129,0.20)",
    },
    codePill:  { fontFamily: "monospace", fontSize: "12px", color: "#fbbf24" },
    lowBadge:  { display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 7px", borderRadius: "12px", fontSize: "10px", fontWeight: "600", backgroundColor: "rgba(217,119,6,0.15)", color: "#fbbf24", border: "1px solid rgba(217,119,6,0.3)", marginLeft: "6px" },

    // Action buttons
    actionBtns: { display: "flex", gap: "6px" },
    stickerBtn: { background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "4px", color: "#38bdf8", display: "flex", alignItems: "center" },
    editBtn:    { background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "4px", color: "#818cf8", display: "flex", alignItems: "center" },
    delBtn:     { background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "4px", color: "#f87171", display: "flex", alignItems: "center" },

    // Message
    msg: { padding: "11px 18px", borderRadius: "7px", marginBottom: "14px", fontSize: "13px", fontWeight: "500" },
    msgSuccess: { backgroundColor: "rgba(22,163,74,0.15)", color: "#4ade80", border: "1px solid #16a34a" },
    msgError:   { backgroundColor: "rgba(220,38,38,0.15)", color: "#f87171",  border: "1px solid #dc2626" },
    msgInfo:    { backgroundColor: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid #3b82f6" },

    // Misc
    emptyState: { textAlign: "center", padding: "48px", color: "#475569", fontStyle: "italic" },
    loadingRow: { textAlign: "center", padding: "48px", color: "#64748b" },

    // Pagination
    pagRow:  { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" },
    pagInfo: { color: "#64748b", fontSize: "13px" },
    pagControls: { display: "flex", gap: "6px", alignItems: "center" },
    pagBtn: (active, disabled) => ({
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "7px 11px", minWidth: "36px",
      backgroundColor: active ? "#6366f1" : "#1e293b",
      border: `1px solid ${active ? "#6366f1" : "#334155"}`,
      color: disabled ? "#334155" : "#f1f5f9", borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer", fontSize: "13px",
      opacity: disabled ? 0.45 : 1, transition: "all 0.15s",
    }),
    perPageSelect: {
      padding: "6px 8px", backgroundColor: "#1e293b", border: "1px solid #334155",
      color: "#f1f5f9", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
    },
  };

  // Modal styles
  const M = {
    overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
    box:     { backgroundColor: "#1e293b", padding: "28px", borderRadius: "12px", width: "90%", maxWidth: "600px", maxHeight: "88vh", overflow: "auto", border: "1px solid #334155" },
    lgBox:   { backgroundColor: "#1e293b", padding: "28px", borderRadius: "12px", width: "92%", maxWidth: "950px", maxHeight: "82vh", overflow: "auto", border: "1px solid #334155" },
    header:  { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
    title:   { fontSize: "18px", fontWeight: "600", color: "#f1f5f9" },
    closeBtn:{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px", borderRadius: "4px" },
    group:   { marginBottom: "14px" },
    label:   { display: "block", marginBottom: "5px", color: "#94a3b8", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" },
    input:   { width: "100%", padding: "9px 11px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" },
    select:  { width: "100%", padding: "9px 11px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box", cursor: "pointer" },
    readOnly:{ padding: "9px 11px", backgroundColor: "#0f172a", border: "1px solid #1e3a5f", color: "#64748b", borderRadius: "6px", fontSize: "14px" },
    row2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
    footer:  { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "18px", borderTop: "1px solid #334155" },
    // import table
    importTh:{ backgroundColor: "#0f172a", padding: "9px 10px", textAlign: "left", color: "#94a3b8", fontSize: "11px", fontWeight: "600", position: "sticky", top: 0 },
    importTd:{ padding: "9px 10px", borderBottom: "1px solid #334155", color: "#e2e8f0", fontSize: "12px" },
    statBox: (col) => ({ flex: 1, textAlign: "center", padding: "10px", borderRadius: "6px", backgroundColor: col }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={S.container}>

      {/* ── Edit / Add Modal ─────────────────────────────────────── */}
      {showEditModal && editingItem && (
        <div style={M.overlay}>
          <div style={M.box}>
            <div style={M.header}>
              <h2 style={M.title}>
                <Edit size={18} style={{ marginRight: "8px", display: "inline", verticalAlign: "middle" }} />
                {editingItem.isNew ? "Add New Textile Item" : "Edit Textile Item"}
              </h2>
              <button style={M.closeBtn} onClick={() => { setShowEditModal(false); setEditingItem(null); }}>
                <X size={20} />
              </button>
            </div>

            {/* Name */}
            <div style={M.group}>
              <label style={M.label}>Product Name *</label>
              <input style={M.input} value={editingItem.name || ""} onChange={(e) => handleEditChange("name", e.target.value)} placeholder="e.g. Premium Cotton Fabric" />
            </div>

            {/* Product Code */}
            <div style={M.group}>
              <label style={M.label}>Product Code (SKU)</label>
              <input style={M.input} value={editingItem.productCode || ""} onChange={(e) => handleEditChange("productCode", e.target.value)} placeholder="e.g. CTN-001" />
            </div>

            {/* Category + Unit */}
            <div style={M.row2}>
              <div style={M.group}>
                <label style={M.label}>Category</label>
                <select style={M.select} value={editingItem.category || ""} onChange={(e) => handleEditChange("category", e.target.value)}>
                  <option value="">— Select —</option>
                  {TEXTILE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={M.group}>
                <label style={M.label}>Unit</label>
                <select style={M.select} value={editingItem.unit || ""} onChange={(e) => handleEditChange("unit", e.target.value)}>
                  <option value="">— Select —</option>
                  {TEXTILE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Supplier */}
            <div style={M.group}>
              <label style={M.label}>Supplier</label>
              <select style={M.select} value={editingItem.supplierId || ""} onChange={(e) => handleEditChange("supplierId", e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">— No Supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ""}</option>)}
              </select>
            </div>

            {/* Prices */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div style={M.group}>
                <label style={M.label}>Purchase (₹)</label>
                <input style={M.input} type="number" min="0" step="0.01" value={editingItem.buyPrice || ""} onChange={(e) => handleEditChange("buyPrice", e.target.value)} placeholder="0.00" />
              </div>
              <div style={M.group}>
                <label style={M.label}>MRP (₹)</label>
                <input style={M.input} type="number" min="0" step="0.01" value={editingItem.mrp || ""} onChange={(e) => handleEditChange("mrp", e.target.value)} placeholder="Auto (25%)" />
              </div>
              <div style={M.group}>
                <label style={M.label}>Selling Price (₹)</label>
                <input style={M.input} type="number" min="0" step="0.01" value={editingItem.sellPrice || ""} onChange={(e) => handleEditChange("sellPrice", e.target.value)} placeholder="0.00" />
              </div>
            </div>

            {/* Qty + Amount */}
            <div style={M.row2}>
              <div style={M.group}>
                <label style={M.label}>Quantity</label>
                <input style={M.input} type="number" min="0" step="1" value={editingItem.quantity || ""} onChange={(e) => handleEditChange("quantity", e.target.value)} placeholder="0" />
              </div>
              <div style={M.group}>
                <label style={M.label}>Amount (₹) — auto</label>
                <div style={M.readOnly}>₹{parseFloat(editingItem.amount || 0).toFixed(2)}</div>
              </div>
            </div>

            <div style={M.footer}>
              <button style={S.btn} onClick={() => { setShowEditModal(false); setEditingItem(null); }}>Cancel</button>
              <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleEditSave} disabled={saving}>
                {saving ? "Saving…" : editingItem.isNew ? "Create Item" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ─────────────────────────────────────────── */}
      {showImportModal && (
        <div style={M.overlay}>
          <div style={M.lgBox}>
            <div style={M.header}>
              <h2 style={M.title}>
                <Upload size={18} style={{ marginRight: "8px", display: "inline", verticalAlign: "middle" }} />
                Import Items ({importedItems.length} found)
              </h2>
              <button style={M.closeBtn} onClick={() => { setShowImportModal(false); setImportedItems([]); }}>
                <X size={20} />
              </button>
            </div>

            {(importStats.added || importStats.updated || importStats.skipped) ? (
              <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                {[
                  ["Added",   importStats.added,   "rgba(22,163,74,0.15)"],
                  ["Updated", importStats.updated, "rgba(99,102,241,0.15)"],
                  ["Skipped", importStats.skipped, "rgba(100,116,139,0.15)"],
                ].map(([label, val, bg]) => (
                  <div key={label} style={M.statBox(bg)}>
                    <div style={{ fontSize: "26px", fontWeight: "700" }}>{val}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>{label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p style={{ color: "#64748b", marginBottom: "12px", fontSize: "13px" }}>
                  Items with matching name + code will have quantity added. Different sell price → new item.
                </p>
                <div style={{ maxHeight: "380px", overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={M.importTh}><input type="checkbox" checked={importedItems.every((i) => i.selected)} onChange={toggleAllImport} /></th>
                        {["Name", "Code", "Category", "Unit", "Buy Price", "Sell Price", "Qty"].map((h) => <th key={h} style={M.importTh}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {importedItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={M.importTd}><input type="checkbox" checked={item.selected} onChange={() => toggleImportItem(idx)} /></td>
                          <td style={M.importTd}>{item.name || "–"}</td>
                          <td style={M.importTd}><span style={S.codePill}>{item.productCode || "–"}</span></td>
                          <td style={M.importTd}>{item.category || "–"}</td>
                          <td style={M.importTd}>{item.unit || "–"}</td>
                          <td style={M.importTd}>₹{item.buyPrice.toFixed(2)}</td>
                          <td style={M.importTd}>₹{item.sellPrice.toFixed(2)}</td>
                          <td style={M.importTd}>{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={M.footer}>
                  <button style={S.btn} onClick={() => { setShowImportModal(false); setImportedItems([]); }}>Cancel</button>
                  <button style={{ ...S.btn, ...S.btnPrimary }} onClick={processImportedItems} disabled={processingImport}>
                    {processingImport ? "Processing…" : "Import Selected"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Product Sticker Modal ─────────────────────────────────── */}
      {showStickerModal && stickerProduct && (
        <div style={M.overlay}>
          <div style={{ ...M.box, maxWidth: "680px" }}>
            <div style={M.header}>
              <h2 style={{ ...M.title, display: "flex", alignItems: "center", gap: "8px" }}>
                <Tag size={19} style={{ color: "#38bdf8" }} />
                Product Sticker — RV Textiles
              </h2>
              <button style={M.closeBtn} onClick={() => setShowStickerModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Product Selector if multiple products exist */}
            {items.length > 1 && (
              <div style={{ marginBottom: "16px" }}>
                <label style={M.label}>Select Product</label>
                <select
                  style={M.select}
                  value={stickerProduct.id}
                  onChange={(e) => handleSelectStickerProduct(e.target.value)}
                >
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.productCode || `ID: ${p.id}`}) — ₹{parseFloat(p.sellPrice || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Layout: Live Label Preview (left) + Editable Fields (right) */}
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
              
              {/* Sticker Visual Preview */}
              <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Live Label Preview (50 × 25 mm)
                </div>

                {/* Actual Physical Proportional Sticker Card */}
                <div style={{
                  width: "240px",
                  height: "120px",
                  backgroundColor: "#ffffff",
                  borderRadius: "6px",
                  border: "1px solid #94a3b8",
                  padding: "4px 8px 4px 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  color: "#000000",
                  fontFamily: "Arial, sans-serif",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}>
                  {/* Store Name (No Border Line) */}
                  <div style={{
                    width: "100%",
                    fontSize: "11px",
                    fontWeight: "900",
                    textAlign: "center",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    paddingTop: "2px",
                    paddingBottom: "1px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    RV FASHION
                  </div>

                  {/* Product Name (Shifted slightly downwards) */}
                  <div style={{
                    width: "100%",
                    fontSize: "10.5px",
                    fontWeight: "700",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: "6px",
                    paddingBottom: "1px",
                  }} title={stickerProduct.name}>
                    {stickerProduct.name || "Textile Item"}
                  </div>

                  {/* Barcode SVG */}
                  <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", margin: "3px 0 2px 0" }}>
                    <svg ref={previewSvgRef} style={{ maxWidth: "210px", height: "35px", display: "block" }} />
                  </div>

                  {/* Barcode Number */}
                  <div style={{
                    fontSize: "9.5px",
                    fontFamily: "'Courier New', monospace",
                    fontWeight: "700",
                    letterSpacing: "0.8px",
                    textAlign: "center",
                    lineHeight: "1",
                    marginTop: "1px",
                  }}>
                    {stickerBarcode || "000000"}
                  </div>

                  {/* Price Section: Clean MRP (No Border Lines, No Strikethrough) */}
                  <div style={{
                    width: "100%",
                    marginTop: "auto",
                    paddingBottom: "4px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: "1.2",
                  }}>
                    <span style={{
                      fontSize: "12px",
                      fontWeight: "900",
                      color: "#000000",
                      whiteSpace: "nowrap",
                    }}>
                      MRP: ₹{parseFloat(stickerSellPrice || stickerMrp || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: "10px", fontSize: "11px", color: "#64748b", textAlign: "center" }}>
                  🖨️ For SNBC TVSE LP45 BPLE (2 per row on 101.6mm roll)
                </div>
              </div>

              {/* Form Controls */}
              <div style={{ flex: "1 1 280px" }}>
                {/* Product Name (Read-only) */}
                <div style={M.group}>
                  <label style={M.label}>Product Name</label>
                  <div style={{ ...M.readOnly, fontWeight: "600", color: "#f1f5f9" }}>
                    {stickerProduct.name}
                  </div>
                </div>

                {/* Product Barcode */}
                <div style={M.group}>
                  <label style={M.label}>Product Barcode / SKU</label>
                  <input
                    style={M.input}
                    value={stickerBarcode}
                    onChange={(e) => setStickerBarcode(e.target.value)}
                    placeholder="Barcode string e.g. CTN-001"
                  />
                </div>

                {/* MRP and Selling Price */}
                <div style={M.row2}>
                  <div style={M.group}>
                    <label style={M.label}>
                      MRP (₹) <span style={{ color: "#ef4444", fontSize: "10px", fontWeight: "normal" }}>[Strikethrough]</span>
                    </label>
                    <input
                      style={{ ...M.input, borderColor: "#f87171" }}
                      type="number"
                      min="0"
                      step="0.01"
                      value={stickerMrp}
                      onChange={(e) => setStickerMrp(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div style={M.group}>
                    <label style={M.label}>
                      Selling Price (₹) <span style={{ color: "#4ade80", fontSize: "10px", fontWeight: "normal" }}>[Display Price]</span>
                    </label>
                    <input
                      style={{ ...M.input, borderColor: "#4ade80" }}
                      type="number"
                      min="0"
                      step="0.01"
                      value={stickerSellPrice}
                      onChange={(e) => setStickerSellPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Copies */}
                <div style={M.group}>
                  <label style={M.label}>Number of Stickers to Print</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      style={{ ...M.input, width: "100px" }}
                      type="number"
                      min="1"
                      step="1"
                      value={stickerCopies}
                      onChange={(e) => setStickerCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    {[1, 2, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        style={{
                          padding: "6px 10px",
                          backgroundColor: stickerCopies === num ? "#6366f1" : "#0f172a",
                          color: "#f1f5f9",
                          border: `1px solid ${stickerCopies === num ? "#6366f1" : "#334155"}`,
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        onClick={() => setStickerCopies(num)}
                      >
                        {num}
                      </button>
                    ))}
                    {parseInt(stickerProduct.quantity) > 0 && (
                      <button
                        type="button"
                        style={{
                          padding: "6px 10px",
                          backgroundColor: "#0f172a",
                          color: "#38bdf8",
                          border: "1px solid #334155",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        onClick={() => setStickerCopies(parseInt(stickerProduct.quantity) || 1)}
                        title="Set copies equal to in-stock quantity"
                      >
                        Stock ({stickerProduct.quantity})
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div style={M.footer}>
              <button style={S.btn} onClick={() => setShowStickerModal(false)}>
                Cancel
              </button>

              {items.length > 1 && (
                <button
                  style={{ ...S.btn, backgroundColor: "#334155", color: "#f1f5f9" }}
                  onClick={handlePrintAllStickers}
                  title="Print 1 sticker for each item in current product list"
                >
                  Print All Products ({items.length})
                </button>
              )}

              <button
                style={{ ...S.btn, ...S.btnPrimary, backgroundColor: "#0284c7" }}
                onClick={handlePrintSticker}
              >
                <Printer size={15} />
                Print {stickerCopies} Sticker{stickerCopies > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.headerTitle}>
          <h1 style={S.title}>🧵 Textile Stock</h1>
          <button style={S.btnGhost} onClick={handleRefresh} title="Refresh data">
            <RefreshCw size={17} />
          </button>
        </div>

        <div style={S.buttonGroup}>
          <button
            style={{ ...S.btn, borderColor: "rgba(56,189,248,0.4)", color: "#38bdf8" }}
            onClick={() => handleOpenStickerModal(null)}
            title="Generate & Print Product Stickers for RV Textiles"
          >
            <Tag size={15} /> Product Sticker
          </button>
          <button style={S.btn} onClick={handleExport}><Download size={15} /> Export</button>
          <label style={{ ...S.btn, cursor: "pointer" }}>
            <Upload size={15} /> Import
            <input type="file" hidden onChange={handleImport} accept=".xlsx,.xls,.csv" />
          </label>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleAddNewItem}><Plus size={15} /> Add New</button>
        </div>
      </div>

      {/* ── Message ─────────────────────────────────────────────── */}
      {message.text && (
        <div style={{ ...S.msg, ...(message.type === "success" ? S.msgSuccess : message.type === "error" ? S.msgError : S.msgInfo) }}>
          {message.text}
        </div>
      )}

      {/* ── Filter Bar ──────────────────────────────────────────── */}
      <div style={S.filterBar}>
        {/* Search */}
        <div style={S.filterSearchWrapper}>
          <Search size={14} style={S.filterSearchIcon} />
          <input
            style={S.filterSearchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, category…"
          />
        </div>

        {/* Category */}
        <select style={S.filterInput} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {TEXTILE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Unit */}
        <select style={S.filterInput} value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
          <option value="">All Units</option>
          {TEXTILE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>

        {/* Supplier */}
        <select style={S.filterInput} value={filterSupplierId} onChange={(e) => setFilterSupplierId(e.target.value)}>
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ""}</option>)}
        </select>

        {/* Price range */}
        <input
          style={{ ...S.filterInput, minWidth: "90px", maxWidth: "105px" }}
          type="number" min="0" step="1"
          value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
          placeholder="Min ₹"
        />
        <input
          style={{ ...S.filterInput, minWidth: "90px", maxWidth: "105px" }}
          type="number" min="0" step="1"
          value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="Max ₹"
        />

        {/* Low stock toggle */}
        <button style={S.lowStockBtn(filterLowStock)} onClick={() => setFilterLowStock((v) => !v)}>
          <AlertTriangle size={13} />
          Low Stock
        </button>

        {/* Clear */}
        {hasActiveFilters && (
          <button style={S.clearBtn} onClick={handleClearFilters}>
            <XCircle size={13} /> Clear
          </button>
        )}
      </div>

      {/* ── Stats Bar ───────────────────────────────────────────── */}
      {filterSummary && (
        <div style={S.statsBar}>
          {[
            { label: "Total Products",  value: filterSummary.total_products.toLocaleString(), accent: "#6366f1" },
            { label: "Total Quantity",  value: filterSummary.total_qty.toLocaleString(),      accent: "#10b981" },
            { label: "Stock Value",     value: `₹${filterSummary.total_value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, accent: "#f59e0b" },
            { label: "Avg Sell Price",  value: `₹${filterSummary.avg_sell_price.toFixed(2)}`, accent: "#ec4899" },
          ].map(({ label, value, accent }) => (
            <div key={label} style={S.statCard(accent)}>
              <div style={S.statLabel}>{label}</div>
              <div style={S.statValue}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <div style={S.tableWrap}>
        {loading ? (
          <div style={S.loadingRow}>Loading products…</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thStatic}><Hash size={12} style={{ display: "inline", marginRight: "3px" }} />ID</th>
                <th style={{ ...S.th }} onClick={() => handleSort("product_code")}>Code <SortIcon col="product_code" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("name")}>Name <SortIcon col="name" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("category")}>Category <SortIcon col="category" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("unit")}>Unit <SortIcon col="unit" /></th>
                <th style={S.thStatic}>Supplier</th>
                <th style={{ ...S.th }} onClick={() => handleSort("buy_price")}>Purchase ₹ <SortIcon col="buy_price" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("sell_price")}>Sell ₹ <SortIcon col="sell_price" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("quantity")}><Package size={12} style={{ display: "inline", marginRight: "3px" }} />Qty <SortIcon col="quantity" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("profit_percent")}>Margin % <SortIcon col="profit_percent" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("amount")}>Amount ₹ <SortIcon col="amount" /></th>
                <th style={S.thStatic}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="12" style={S.emptyState}>
                    {hasActiveFilters
                      ? "No products match the current filters."
                      : "No products found. Click 'Add New' to get started."}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const lowStock = (parseInt(item.quantity) || 0) <= LOW_STOCK_THRESHOLD;
                  const tdStyle  = lowStock ? S.tdLowStock : S.td;
                  return (
                    <tr key={item.id} style={{ backgroundColor: lowStock ? "rgba(217,119,6,0.04)" : "transparent" }}>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: "monospace", color: "#64748b" }}>#{item.id}</span>
                      </td>
                      <td style={tdStyle}><span style={S.codePill}>{item.productCode || "—"}</span></td>
                      <td style={tdStyle}>
                        <strong style={{ color: "#f1f5f9" }}>{item.name || "–"}</strong>
                        {lowStock && <span style={S.lowBadge}><AlertTriangle size={9} /> Low</span>}
                      </td>
                      <td style={tdStyle}>
                        {item.category ? <span style={S.catPill}>{item.category}</span> : <span style={{ color: "#475569" }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {item.unit ? <span style={S.unitPill}>{item.unit}</span> : <span style={{ color: "#475569" }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, color: "#94a3b8", fontSize: "12px" }}>{item.supplierName || "—"}</td>
                      <td style={tdStyle}>₹{(item.buyPrice || 0).toFixed(2)}</td>
                      <td style={tdStyle}>₹{(item.sellPrice || 0).toFixed(2)}</td>
                      <td style={{ ...tdStyle, fontWeight: "600" }}>{item.quantity ?? 0}</td>
                      <td style={tdStyle}>
                        <span style={{ color: marginColor(item.profitPercent), fontWeight: "600", fontSize: "13px" }}>
                          {item.profitPercent !== null && item.profitPercent !== undefined
                            ? `${item.profitPercent}%`
                            : "—"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: "600" }}>₹{parseFloat(item.amount || 0).toFixed(2)}</td>
                      <td style={tdStyle}>
                        <div style={S.actionBtns}>
                          <button style={S.stickerBtn} onClick={() => handleOpenStickerModal(item)} title="Generate Product Sticker for RV Textiles"><Tag size={15} /></button>
                          <button style={S.editBtn} onClick={() => handleEditClick(item)} title="Edit"><Edit size={15} /></button>
                          <button style={S.delBtn}  onClick={() => handleDelete(item.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────── */}
      {totalItems > 0 && (
        <div style={S.pagRow}>
          <div style={S.pagInfo}>
            Showing page {currentPage} of {totalPages} &nbsp;|&nbsp; {totalItems.toLocaleString()} total items
            &nbsp;|&nbsp;
            <select style={S.perPageSelect} value={itemsPerPage} onChange={(e) => { setItemsPerPage(+e.target.value); setCurrentPage(1); }}>
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </div>
          <div style={S.pagControls}>
            <button style={S.pagBtn(false, currentPage === 1)} onClick={goPrev} disabled={currentPage === 1}><ChevronLeft size={15} /></button>
            {[...Array(totalPages)].map((_, idx) => {
              const n = idx + 1;
              const show = n === 1 || n === totalPages || (n >= currentPage - 2 && n <= currentPage + 2);
              const ellipsis = n === currentPage - 3 || n === currentPage + 3;
              if (show)     return <button key={n} style={S.pagBtn(currentPage === n, false)} onClick={() => paginate(n)}>{n}</button>;
              if (ellipsis) return <span key={n} style={{ color: "#475569", padding: "0 2px" }}>…</span>;
              return null;
            })}
            <button style={S.pagBtn(false, currentPage === totalPages)} onClick={goNext} disabled={currentPage === totalPages}><ChevronRight size={15} /></button>
          </div>
        </div>
      )}

    </div>
  );
}