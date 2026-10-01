// Product.jsx — Textile & Apparel Stock Management
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Download, Upload, Trash2, Save, Search, RefreshCw,
  X, ChevronLeft, ChevronRight, Edit, Hash, Tag, Package,
  AlertTriangle, Filter, XCircle, Printer, Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import JsBarcode from "jsbarcode";
import { printProductSticker } from "../utils/printProductSticker";

const API_URL = "http://localhost:5000/api/products";
const SUPPLIER_API_URL = "http://localhost:5000/api";

export const APPAREL_CATEGORIES_MAP = [
  // ── Men's Categories ──
  { section: "Men", category: "F-SHIRT", style: "RV-01", fhShirts: "Full Sleeve", label: "F-SHIRT (RV-01)" },
  { section: "Men", category: "H-SHIRT", style: "RV-02", fhShirts: "Half Sleeve", label: "H-SHIRT (RV-02)" },
  { section: "Men", category: "T..F SHIRT", style: "RV-03", fhShirts: "Full Sleeve", label: "T..F SHIRT (RV-03)" },
  { section: "Men", category: "T..H SHIRT", style: "RV-04", fhShirts: "Half Sleeve", label: "T..H SHIRT (RV-04)" },
  { section: "Men", category: "F PANT", style: "RV-05", fhShirts: "—", label: "F PANT (RV-05)" },
  { section: "Men", category: "JEANS", style: "RV-06", fhShirts: "—", label: "JEANS (RV-06)" },
  { section: "Men", category: "TRACKS", style: "RV-07", fhShirts: "—", label: "TRACKS (RV-07)" },
  { section: "Men", category: "SHORTS", style: "RV-08", fhShirts: "—", label: "SHORTS (RV-08)" },
  { section: "Men", category: "INNERS", style: "RV-09", fhShirts: "—", label: "INNERS (RV-09)" },
  // ── Ladies' Categories ──
  { section: "Ladies", category: "S -TOP", style: "RV-11", fhShirts: "—", label: "S -TOP (RV-11)" },
  { section: "Ladies", category: "2 PCS SET TOPS", style: "RV-12", fhShirts: "—", label: "2 PCS SET TOPS (RV-12)" },
  { section: "Ladies", category: "3-PCS SET TOP", style: "RV-13", fhShirts: "—", label: "3-PCS SET TOP (RV-13)" },
];

export const CATEGORY_TO_STYLE = {
  "F-SHIRT": "RV-01",
  "H-SHIRT": "RV-02",
  "T..F SHIRT": "RV-03",
  "T..H SHIRT": "RV-04",
  "F PANT": "RV-05",
  "JEANS": "RV-06",
  "TRACKS": "RV-07",
  "SHORTS": "RV-08",
  "INNERS": "RV-09",
  "S -TOP": "RV-11",
  "S-TOP": "RV-11",
  "2 PCS SET TOPS": "RV-12",
  "2-PCS SET TOPS": "RV-12",
  "3-PCS SET TOP": "RV-13",
  "3 PCS SET TOP": "RV-13",
};

export const STYLE_TO_CATEGORY = {
  "RV-01": "F-SHIRT",
  "RV-02": "H-SHIRT",
  "RV-03": "T..F SHIRT",
  "RV-04": "T..H SHIRT",
  "RV-05": "F PANT",
  "RV-06": "JEANS",
  "RV-07": "TRACKS",
  "RV-08": "SHORTS",
  "RV-09": "INNERS",
  "RV-11": "S -TOP",
  "RV-12": "2 PCS SET TOPS",
  "RV-13": "3-PCS SET TOP",
};

const APPAREL_CATEGORIES = APPAREL_CATEGORIES_MAP.map((m) => m.category);
const APPAREL_STYLES = APPAREL_CATEGORIES_MAP.map((m) => m.style);

const APPAREL_SIZES = [
  "36", "38", "39", "40", "42", "44", "46",
  "XS", "S", "M", "L", "XL", "2XL", "3XL", "Free Size",
];

const FH_SHIRT_OPTIONS = [
  "Full Sleeve", "Half Sleeve", "3/4 Sleeve", "Sleeveless", "F/H", "—",
];

const COMMON_COLOURS = [
  "White", "Black", "Navy Blue", "Sky Blue", "Royal Blue",
  "Red", "Maroon", "Green", "Olive Green", "Yellow",
  "Grey", "Charcoal", "Beige", "Brown", "Pink", "Multi-colour",
];

const DEFAULT_SITES = [
  "RV Fashion", "RV Textiles", "Main Store", "Warehouse", "Branch 1",
];

const LOW_STOCK_THRESHOLD = 5;

export default function ItemsPage() {
  // ── Core state ─────────────────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [suppliers, setSuppliers] = useState([]);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStyle, setFilterStyle] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [filterFhShirts, setFilterFhShirts] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);

  // ── Sort state ─────────────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  // ── Pagination state ───────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ── Stats from API ─────────────────────────────────────────────────────────
  const [filterSummary, setFilterSummary] = useState(null);

  // ── Edit / Add modal ───────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // ── Import modal ───────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedItems, setImportedItems] = useState([]);
  const [processingImport, setProcessingImport] = useState(false);
  const [importStats, setImportStats] = useState({ added: 0, updated: 0, skipped: 0 });

  // ── Product Sticker modal state ────────────────────────────────────────────
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [stickerProduct, setStickerProduct] = useState(null);
  const [stickerCopies, setStickerCopies] = useState(1);
  const [stickerMrp, setStickerMrp] = useState("");
  const [stickerSellPrice, setStickerSellPrice] = useState("");
  const [stickerBarcode, setStickerBarcode] = useState("");
  const previewSvgRef = useRef(null);

  // ── Computed: any active filter? ───────────────────────────────────────────
  const hasActiveFilters = !!(
    search || filterCategory || filterSite || filterSize ||
    filterFhShirts || minPrice || maxPrice || filterLowStock
  );

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSuppliers();
  }, []);

  // Debounced reload whenever any filter/sort/paging param changes
  useEffect(() => {
    const t = setTimeout(() => loadProducts(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterCategory, filterStyle, filterSite, filterSize, filterFhShirts,
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
      params.set("page", page);
      params.set("per_page", itemsPerPage);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortDir);
      if (search.trim()) params.set("search", search.trim());
      if (filterCategory) params.set("category", filterCategory);
      if (filterStyle) params.set("style", filterStyle);
      if (filterSite) params.set("site_name", filterSite);
      if (filterSize) params.set("size", filterSize);
      if (filterFhShirts) params.set("fh_shirts", filterFhShirts);
      if (minPrice !== "" && !isNaN(+minPrice)) params.set("min_price", minPrice);
      if (maxPrice !== "" && !isNaN(+maxPrice)) params.set("max_price", maxPrice);
      if (filterLowStock) params.set("low_stock", "true");
      return `${API_URL}?${params.toString()}`;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, filterCategory, filterStyle, filterSite, filterSize, filterFhShirts,
      minPrice, maxPrice, filterLowStock, itemsPerPage, sortBy, sortDir]
  );

  const loadProducts = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(buildProductUrl(page));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let arr = [];
      if (data?.items && Array.isArray(data.items)) {
        arr = data.items;
        setTotalItems(data.total || 0);
        setTotalPages(data.pages || 1);
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
    const qty = parseInt(item.quantity) || parseInt(item.qty) || 0;
    const mrp = item.mrp !== undefined && item.mrp !== null && item.mrp !== "" ? parseFloat(item.mrp) : 0;
    const sell = parseFloat(item.sellPrice) || mrp || 0;
    const buy = parseFloat(item.buyPrice) || 0;
    return {
      ...item,
      siteName: item.siteName || item.site_name || "",
      productCode: item.productCode || item.barcode || "",
      barcode: item.productCode || item.barcode || "",
      category: item.category || "",
      size: item.size || "",
      colour: item.colour || item.color || "",
      fhShirts: item.fhShirts || item.fh_shirts || "",
      style: item.style || "",
      mrp: mrp,
      sellPrice: sell,
      buyPrice: buy,
      quantity: qty,
      amount: (sell * qty).toFixed(2),
    };
  };

  const isSameProduct = (a, b) => {
    const codeA = (a.barcode || a.productCode || a.product_code || "").trim().toLowerCase();
    const codeB = (b.barcode || b.productCode || b.product_code || "").trim().toLowerCase();
    if (codeA && codeB) return codeA === codeB;

    const catA = (a.category || "").trim().toLowerCase();
    const catB = (b.category || "").trim().toLowerCase();
    const styleA = (a.style || "").trim().toLowerCase();
    const styleB = (b.style || "").trim().toLowerCase();
    const sizeA = (a.size || "").trim().toLowerCase();
    const sizeB = (b.size || "").trim().toLowerCase();
    return catA === catB && styleA === styleB && sizeA === sizeB;
  };

  const generateRandomBarcode = () => {
    const prefix = "RV";
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${rand}`;
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
    setFilterStyle("");
    setFilterSite("");
    setFilterSize("");
    setFilterFhShirts("");
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
    setEditingItem(calculateAmount({ ...item }));
    setShowMoreFields(false);
    setShowEditModal(true);
  };

  const handleEditChange = (field, value) => {
    setEditingItem((prev) => calculateAmount({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (val) => {
    const matchedStyle = CATEGORY_TO_STYLE[val];
    const matchedItem = APPAREL_CATEGORIES_MAP.find((m) => m.category === val);
    setEditingItem((prev) =>
      calculateAmount({
        ...prev,
        category: val,
        style: matchedStyle || prev.style,
        fhShirts: (matchedItem && matchedItem.fhShirts !== "—") ? matchedItem.fhShirts : prev.fhShirts,
      })
    );
  };

  const handleStyleChange = (val) => {
    const matchedCat = STYLE_TO_CATEGORY[val];
    const matchedItem = APPAREL_CATEGORIES_MAP.find((m) => m.style === val);
    setEditingItem((prev) =>
      calculateAmount({
        ...prev,
        style: val,
        category: matchedCat || prev.category,
        fhShirts: (matchedItem && matchedItem.fhShirts !== "—") ? matchedItem.fhShirts : prev.fhShirts,
      })
    );
  };

  const handleAddNewItem = () => {
    setEditingItem(calculateAmount({
      id: `new-${Date.now()}`,
      siteName: "RV Fashion",
      productCode: generateRandomBarcode(),
      barcode: "",
      category: "F-SHIRT",
      style: "RV-01",
      size: "40",
      colour: "White",
      fhShirts: "Full Sleeve",
      mrp: "",
      sellPrice: "",
      buyPrice: "",
      quantity: 1,
      isNew: true,
    }));
    setShowMoreFields(false);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editingItem) return;

    const barcode = (editingItem.barcode || editingItem.productCode || "").trim();
    const mrp = parseFloat(editingItem.mrp);

    if (isNaN(mrp) || mrp < 0) {
      showMessage("error", "Please enter a valid MRP");
      return;
    }

    setSaving(true);
    try {
      const productData = {
        siteName: editingItem.siteName?.trim() || "RV Fashion",
        productCode: barcode,
        barcode: barcode,
        category: editingItem.category?.trim() || "",
        size: editingItem.size?.trim() || "",
        colour: editingItem.colour?.trim() || "",
        color: editingItem.colour?.trim() || "",
        fhShirts: editingItem.fhShirts?.trim() || "",
        style: editingItem.style?.trim() || "",
        mrp: mrp,
        sellPrice: parseFloat(editingItem.sellPrice) || mrp,
        buyPrice: parseFloat(editingItem.buyPrice) || 0,
        quantity: parseInt(editingItem.quantity) || 0,
        qty: parseInt(editingItem.quantity) || 0,
        supplierId: editingItem.supplierId || null,
        name: editingItem.name?.trim() || `${editingItem.category || 'Item'} ${editingItem.style || ''} ${editingItem.fhShirts || ''} ${editingItem.size || ''}`.trim(),
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
        throw new Error(err.errors ? err.errors.join(", ") : err.error || "Failed to save product");
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

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCT STICKER HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleOpenStickerModal = (item = null) => {
    const target = item || (items.length > 0 ? items[0] : null);
    if (!target) {
      showMessage("info", "No products available to generate stickers.");
      return;
    }

    const mrp = parseFloat(target.mrp || target.sellPrice || 0);
    const code = String(
      target.barcode || target.productCode || (target.id ? `RVFT-${String(target.id).padStart(5, "0")}` : "000000")
    ).trim();

    setStickerProduct(target);
    setStickerCopies(parseInt(target.quantity) > 0 ? parseInt(target.quantity) : 1);
    setStickerMrp(mrp.toFixed(2));
    setStickerSellPrice(mrp.toFixed(2));
    setStickerBarcode(code);
    setShowStickerModal(true);
  };

  const handleSelectStickerProduct = (id) => {
    const found = items.find((p) => String(p.id) === String(id));
    if (found) {
      const mrp = parseFloat(found.mrp || found.sellPrice || 0);
      const code = String(
        found.barcode || found.productCode || (found.id ? `RVFT-${String(found.id).padStart(5, "0")}` : "000000")
      ).trim();

      setStickerProduct(found);
      setStickerCopies(parseInt(found.quantity) > 0 ? parseInt(found.quantity) : 1);
      setStickerMrp(mrp.toFixed(2));
      setStickerSellPrice(mrp.toFixed(2));
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
      name: stickerProduct.name || `${stickerProduct.category || ''} ${stickerProduct.style || ''} ${stickerProduct.size || ''}`.trim(),
      productCode: stickerBarcode || stickerProduct.barcode || stickerProduct.productCode,
      mrp: parseFloat(stickerMrp) || 0,
      sellPrice: parseFloat(stickerSellPrice) || parseFloat(stickerMrp) || 0,
    };
    printProductSticker(printItem, {
      copies: parseInt(stickerCopies) || 1,
      storeName: stickerProduct.siteName || "RV FASHION",
    });
    showMessage("success", `Sticker print initiated for ${printItem.name || stickerProduct.productCode}`);
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
    if (!window.confirm("Delete this product?")) return;
    try {
      if (!String(id).startsWith("new-")) {
        const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        if (res.status === 404) {
          showMessage("info", "Product was already deleted");
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
      showMessage("success", "Product deleted");
      await loadProducts(currentPage);
    } catch (err) {
      showMessage("error", `Delete failed: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT (Matching Exact Requested Columns)
  // ─────────────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      const res = await fetch(buildProductUrl(1).replace(`per_page=${itemsPerPage}`, "per_page=5000"));
      const data = await res.json();
      const arr = data?.items ?? (Array.isArray(data) ? data : []);

      const exportData = arr.map((item, idx) => ({
        "SL NO": idx + 1,
        "SITE NAME": item.siteName || item.site_name || "RV Fashion",
        "BARCODE": item.barcode || item.productCode || "",
        "CATEGORY": item.category || "",
        "SIZE": item.size || "",
        "COLOUR": item.colour || item.color || "",
        "F/H SHIRTS": item.fhShirts || item.fh_shirts || "",
        "MRP": item.mrp !== undefined && item.mrp !== null ? Number(item.mrp) : (Number(item.sellPrice) || 0),
        "QTY": item.quantity ?? item.qty ?? 0,
        "STYLE": item.style || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 8 },  // SL NO
        { wch: 16 }, // SITE NAME
        { wch: 16 }, // BARCODE
        { wch: 16 }, // CATEGORY
        { wch: 10 }, // SIZE
        { wch: 14 }, // COLOUR
        { wch: 14 }, // F/H SHIRTS
        { wch: 12 }, // MRP
        { wch: 10 }, // QTY
        { wch: 18 }, // STYLE
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      saveAs(
        new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }),
        `Products_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      showMessage("success", "Export successful!");
    } catch (err) {
      showMessage("error", "Export failed: " + err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // IMPORT (Parsing Exact Requested Columns)
  // ─────────────────────────────────────────────────────────────────────────

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!rows.length) { showMessage("error", "No data in file"); return; }

        const processed = rows
          .map((row, i) => {
            const barcode = row["BARCODE"] || row["Barcode"] || row["barcode"] || row["Product Code"] || row["SKU"] || "";
            const siteName = row["SITE NAME"] || row["Site Name"] || row["site_name"] || row["Site"] || "RV Fashion";
            const category = row["CATEGORY"] || row["Category"] || row["category"] || "";
            const size = row["SIZE"] || row["Size"] || row["size"] || "";
            const colour = row["COULOUR"] || row["Coulour"] || row["Colour"] || row["Color"] || row["colour"] || "";
            const fhShirts = row["F/H SHIRTS"] || row["F/H Shirts"] || row["FH Shirts"] || row["fh_shirts"] || "";
            const mrp = parseFloat(row["MRP"] || row["mrp"] || row["Price"] || row["Sell Price"] || 0);
            const qty = parseInt(row["QTY"] || row["Qty"] || row["Quantity"] || row["quantity"] || 0);
            const style = row["STYLE"] || row["Style"] || row["style"] || "";
            const name = row["Name"] || row["name"] || `${category} ${style} ${fhShirts} ${size}`.trim() || "Imported Item";

            return {
              id: `import-${Date.now()}-${i}`,
              siteName,
              barcode: barcode || generateRandomBarcode(),
              productCode: barcode || generateRandomBarcode(),
              category,
              size,
              colour,
              color: colour,
              fhShirts,
              fh_shirts: fhShirts,
              mrp,
              sellPrice: mrp,
              buyPrice: 0,
              quantity: qty,
              qty,
              style,
              name,
              isNew: true,
              selected: true,
            };
          })
          .filter((item) => item.category || item.barcode || item.style || item.mrp > 0);

        if (!processed.length) { showMessage("error", "No valid product rows found in file"); return; }
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
            const r = await fetch(`${API_URL}/${found.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                siteName: imp.siteName || found.siteName,
                productCode: found.productCode || imp.barcode,
                barcode: found.productCode || imp.barcode,
                category: imp.category || found.category,
                size: imp.size || found.size,
                colour: imp.colour || found.colour,
                fhShirts: imp.fhShirts || found.fhShirts,
                style: imp.style || found.style,
                mrp: imp.mrp || found.mrp,
                sellPrice: imp.mrp || found.sellPrice,
                buyPrice: found.buyPrice || 0,
                quantity: (parseInt(found.quantity) || 0) + (parseInt(imp.quantity) || 0),
              }),
            });
            r.ok ? updated++ : skipped++;
          } else {
            const r = await fetch(API_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                siteName: imp.siteName || "RV Fashion",
                productCode: imp.barcode || imp.productCode,
                barcode: imp.barcode || imp.productCode,
                category: imp.category || "",
                size: imp.size || "",
                colour: imp.colour || "",
                fhShirts: imp.fhShirts || "",
                style: imp.style || "",
                mrp: imp.mrp || 0,
                sellPrice: imp.mrp || 0,
                buyPrice: 0,
                quantity: parseInt(imp.quantity) || 0,
                name: imp.name || `${imp.category} ${imp.style} ${imp.size}`.trim(),
              }),
            });
            r.ok ? added++ : skipped++;
          }
        } catch { skipped++; }
      }

      setImportStats({ added, updated, skipped });
      await loadProducts(currentPage);
      showMessage("success", `Import complete! ✅ ${added} added  📈 ${updated} updated  ⏭️ ${skipped} skipped`);
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
  const goPrev = () => { if (currentPage > 1) { const p = currentPage - 1; setCurrentPage(p); loadProducts(p); } };
  const goNext = () => { if (currentPage < totalPages) { const p = currentPage + 1; setCurrentPage(p); loadProducts(p); } };

  // ─────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────

  const S = {
    container: { padding: "30px 40px", backgroundColor: "#0f172a", minHeight: "100vh", color: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" },
    headerTitle: { display: "flex", alignItems: "center", gap: "12px" },
    title: { fontSize: "24px", fontWeight: "700", margin: 0, letterSpacing: "-0.5px" },
    buttonGroup: { display: "flex", gap: "8px", flexWrap: "wrap" },

    // Buttons
    btn: {
      display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px",
      borderRadius: "7px", backgroundColor: "#1e293b", color: "#f1f5f9",
      border: "1px solid #334155", cursor: "pointer", fontSize: "13px",
      fontWeight: "500", transition: "all 0.15s",
    },
    btnPrimary: { backgroundColor: "#6366f1", border: "none", color: "#fff", fontWeight: "600" },
    btnGhost: { background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "6px", borderRadius: "6px", display: "flex", alignItems: "center" },

    // Filter bar
    filterBar: {
      display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center",
      padding: "12px 16px", backgroundColor: "#1e293b", borderRadius: "10px",
      marginBottom: "14px", border: "1px solid #334155",
    },
    filterInput: {
      padding: "7px 10px", backgroundColor: "#0f172a", border: "1px solid #334155",
      color: "#f1f5f9", borderRadius: "6px", fontSize: "13px", minWidth: "130px",
    },
    filterSearchWrapper: { position: "relative", flex: "1", minWidth: "200px", maxWidth: "340px" },
    filterSearchIcon: { position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748b" },
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
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px",
      marginBottom: "14px",
    },
    statCard: (accent) => ({
      padding: "12px 16px", backgroundColor: "#1e293b", borderRadius: "8px",
      border: `1px solid #334155`, borderLeft: `3px solid ${accent}`,
    }),
    statLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "4px" },
    statValue: { fontSize: "19px", fontWeight: "700", color: "#f1f5f9" },

    // Table
    tableWrap: { overflowX: "auto", borderRadius: "10px", border: "1px solid #334155", backgroundColor: "#1e293b" },
    table: { width: "100%", borderCollapse: "collapse", minWidth: "1150px" },
    th: {
      backgroundColor: "#0f172a", padding: "12px 14px", textAlign: "left",
      color: "#94a3b8", fontWeight: "700", fontSize: "12px", whiteSpace: "nowrap",
      cursor: "pointer", userSelect: "none", borderBottom: "1px solid #334155",
      letterSpacing: "0.5px", textTransform: "uppercase",
      transition: "color 0.15s",
    },
    thStatic: {
      backgroundColor: "#0f172a", padding: "12px 14px", textAlign: "left",
      color: "#94a3b8", fontWeight: "700", fontSize: "12px", whiteSpace: "nowrap",
      letterSpacing: "0.5px", textTransform: "uppercase",
      borderBottom: "1px solid #334155",
    },
    td: { padding: "11px 14px", borderTop: "1px solid #33415544", color: "#e2e8f0", fontSize: "13px" },
    tdLowStock: { padding: "11px 14px", borderTop: "1px solid #33415544", color: "#e2e8f0", fontSize: "13px" },

    // Badges / Pills
    catPill: {
      display: "inline-block", padding: "3px 9px", borderRadius: "12px", fontSize: "11.5px",
      fontWeight: "600", backgroundColor: "rgba(99,102,241,0.14)", color: "#a5b4fc",
      border: "1px solid rgba(99,102,241,0.3)",
    },
    sizePill: {
      display: "inline-block", padding: "2px 8px", borderRadius: "6px", fontSize: "12px",
      fontWeight: "700", backgroundColor: "rgba(56,189,248,0.12)", color: "#38bdf8",
      border: "1px solid rgba(56,189,248,0.25)",
    },
    sitePill: {
      display: "inline-block", padding: "2px 8px", borderRadius: "6px", fontSize: "11.5px",
      fontWeight: "500", backgroundColor: "rgba(148,163,184,0.10)", color: "#cbd5e1",
      border: "1px solid rgba(148,163,184,0.20)",
    },
    codePill: { fontFamily: "monospace", fontSize: "12.5px", fontWeight: "600", color: "#fbbf24", letterSpacing: "0.5px" },
    lowBadge: { display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 7px", borderRadius: "12px", fontSize: "10px", fontWeight: "600", backgroundColor: "rgba(217,119,6,0.15)", color: "#fbbf24", border: "1px solid rgba(217,119,6,0.3)", marginLeft: "6px" },

    // Action buttons
    actionBtns: { display: "flex", gap: "6px" },
    stickerBtn: { background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "4px", color: "#38bdf8", display: "flex", alignItems: "center" },
    editBtn: { background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "4px", color: "#818cf8", display: "flex", alignItems: "center" },
    delBtn: { background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "4px", color: "#f87171", display: "flex", alignItems: "center" },

    // Message
    msg: { padding: "11px 18px", borderRadius: "7px", marginBottom: "14px", fontSize: "13px", fontWeight: "500" },
    msgSuccess: { backgroundColor: "rgba(22,163,74,0.15)", color: "#4ade80", border: "1px solid #16a34a" },
    msgError: { backgroundColor: "rgba(220,38,38,0.15)", color: "#f87171", border: "1px solid #dc2626" },
    msgInfo: { backgroundColor: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid #3b82f6" },

    // Empty state
    emptyState: { textAlign: "center", padding: "48px", color: "#64748b", fontStyle: "italic" },
    loadingRow: { textAlign: "center", padding: "48px", color: "#64748b" },

    // Pagination
    pagRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "10px" },
    pagInfo: { color: "#64748b", fontSize: "13px" },
    pagControls: { display: "flex", gap: "6px", alignItems: "center" },
    pagBtn: (active, disabled) => ({
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "6px 11px", minWidth: "34px",
      backgroundColor: active ? "#6366f1" : "#1e293b",
      border: `1px solid ${active ? "#6366f1" : "#334155"}`,
      color: disabled ? "#334155" : "#f1f5f9", borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer", fontSize: "13px",
      opacity: disabled ? 0.45 : 1, transition: "all 0.15s",
    }),
    perPageSelect: {
      padding: "5px 8px", backgroundColor: "#1e293b", border: "1px solid #334155",
      color: "#f1f5f9", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
    },
  };

  // Modal styles
  const M = {
    overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.78)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(2px)" },
    box: { backgroundColor: "#1e293b", padding: "26px", borderRadius: "12px", width: "90%", maxWidth: "640px", maxHeight: "88vh", overflow: "auto", border: "1px solid #334155", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" },
    lgBox: { backgroundColor: "#1e293b", padding: "26px", borderRadius: "12px", width: "94%", maxWidth: "1050px", maxHeight: "84vh", overflow: "auto", border: "1px solid #334155", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", paddingBottom: "12px", borderBottom: "1px solid #334155" },
    title: { fontSize: "18px", fontWeight: "700", color: "#f1f5f9", margin: 0, display: "flex", alignItems: "center", gap: "8px" },
    closeBtn: { background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px", borderRadius: "4px" },
    group: { marginBottom: "14px" },
    label: { display: "block", marginBottom: "5px", color: "#94a3b8", fontSize: "11.5px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" },
    input: { width: "100%", padding: "9px 11px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9", borderRadius: "6px", fontSize: "13.5px", boxSizing: "border-box" },
    select: { width: "100%", padding: "9px 11px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f1f5f9", borderRadius: "6px", fontSize: "13.5px", boxSizing: "border-box", cursor: "pointer" },
    readOnly: { padding: "9px 11px", backgroundColor: "#0f172a", border: "1px solid #1e3a5f", color: "#64748b", borderRadius: "6px", fontSize: "13.5px" },
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
    row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" },
    footer: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #334155" },
    importTh: { backgroundColor: "#0f172a", padding: "10px 10px", textAlign: "left", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", position: "sticky", top: 0 },
    importTd: { padding: "9px 10px", borderBottom: "1px solid #334155", color: "#e2e8f0", fontSize: "12px" },
    statBox: (col) => ({ flex: 1, textAlign: "center", padding: "10px", borderRadius: "6px", backgroundColor: col }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={S.container}>

      {/* ── Add / Edit Product Modal (Exact Requested Columns) ─────── */}
      {showEditModal && editingItem && (
        <div style={M.overlay}>
          <div style={M.box}>
            <div style={M.header}>
              <h2 style={M.title}>
                <Edit size={18} style={{ color: "#6366f1" }} />
                {editingItem.isNew ? "Add New Product" : "Edit Product"}
              </h2>
              <button style={M.closeBtn} onClick={() => { setShowEditModal(false); setEditingItem(null); }}>
                <X size={20} />
              </button>
            </div>

            {/* Row 1: SITE NAME & BARCODE */}
            <div style={M.row2}>
              <div style={M.group}>
                <label style={M.label}>Site Name</label>
                <input
                  style={M.input}
                  list="siteOptions"
                  value={editingItem.siteName || ""}
                  onChange={(e) => handleEditChange("siteName", e.target.value)}
                  placeholder="e.g. RV Fashion"
                />
                <datalist id="siteOptions">
                  {DEFAULT_SITES.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div style={M.group}>
                <label style={M.label}>Barcode</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    style={M.input}
                    value={editingItem.barcode || editingItem.productCode || ""}
                    onChange={(e) => {
                      handleEditChange("barcode", e.target.value);
                      handleEditChange("productCode", e.target.value);
                    }}
                    placeholder="e.g. RV849201"
                  />
                  <button
                    type="button"
                    style={{ ...S.btn, padding: "0 10px" }}
                    onClick={() => {
                      const rand = generateRandomBarcode();
                      handleEditChange("barcode", rand);
                      handleEditChange("productCode", rand);
                    }}
                    title="Generate unique barcode"
                  >
                    <Sparkles size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: CATEGORY & SIZE */}
            <div style={M.row2}>
              <div style={M.group}>
                <label style={M.label}>Category</label>
                <select
                  style={M.select}
                  value={editingItem.category || ""}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">— Select Category —</option>
                  <optgroup label="Men's Collection">
                    {APPAREL_CATEGORIES_MAP.filter((m) => m.section === "Men").map((m) => (
                      <option key={m.category} value={m.category}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ladies' Collection">
                    {APPAREL_CATEGORIES_MAP.filter((m) => m.section === "Ladies").map((m) => (
                      <option key={m.category} value={m.category}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div style={M.group}>
                <label style={M.label}>Size</label>
                <input
                  style={M.input}
                  list="sizeOptions"
                  value={editingItem.size || ""}
                  onChange={(e) => handleEditChange("size", e.target.value)}
                  placeholder="e.g. 40, L, XL"
                />
                <datalist id="sizeOptions">
                  {APPAREL_SIZES.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>

            {/* Row 3: COLOUR & F/H SHIRTS */}
            <div style={M.row2}>
              <div style={M.group}>
                <label style={M.label}>Colour</label>
                <input
                  style={M.input}
                  list="colorOptions"
                  value={editingItem.colour || editingItem.color || ""}
                  onChange={(e) => handleEditChange("colour", e.target.value)}
                  placeholder="e.g. Navy Blue, White"
                />
                <datalist id="colorOptions">
                  {COMMON_COLOURS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div style={M.group}>
                <label style={M.label}>F/H Shirts</label>
                <select
                  style={M.select}
                  value={editingItem.fhShirts || editingItem.fh_shirts || ""}
                  onChange={(e) => handleEditChange("fhShirts", e.target.value)}
                >
                  <option value="">— Select F/H Sleeve —</option>
                  {FH_SHIRT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: MRP, QTY & STYLE */}
            <div style={M.row3}>
              <div style={M.group}>
                <label style={M.label}>MRP (₹) *</label>
                <input
                  style={M.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingItem.mrp !== undefined && editingItem.mrp !== null ? editingItem.mrp : ""}
                  onChange={(e) => handleEditChange("mrp", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div style={M.group}>
                <label style={M.label}>Qty *</label>
                <input
                  style={M.input}
                  type="number"
                  min="0"
                  step="1"
                  value={editingItem.quantity !== undefined && editingItem.quantity !== null ? editingItem.quantity : ""}
                  onChange={(e) => handleEditChange("quantity", e.target.value)}
                  placeholder="1"
                  required
                />
              </div>

              <div style={M.group}>
                <label style={M.label}>Style</label>
                <select
                  style={M.select}
                  value={editingItem.style || ""}
                  onChange={(e) => handleStyleChange(e.target.value)}
                >
                  <option value="">— Select Style —</option>
                  <optgroup label="Men's Styles">
                    {APPAREL_CATEGORIES_MAP.filter((m) => m.section === "Men").map((m) => (
                      <option key={m.style} value={m.style}>
                        {m.style} — {m.category}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ladies' Styles">
                    {APPAREL_CATEGORIES_MAP.filter((m) => m.section === "Ladies").map((m) => (
                      <option key={m.style} value={m.style}>
                        {m.style} — {m.category}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Optional / Advanced Settings Toggle */}
            <div style={{ marginTop: "6px", marginBottom: "12px" }}>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "12px", padding: 0 }}
                onClick={() => setShowMoreFields(!showMoreFields)}
              >
                {showMoreFields ? "▲ Hide Advanced Options (Buy Price, Supplier)" : "▼ More Options (Buy Price, Supplier)"}
              </button>
            </div>

            {showMoreFields && (
              <div style={{ padding: "12px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155", marginBottom: "14px" }}>
                <div style={M.row2}>
                  <div style={M.group}>
                    <label style={M.label}>Purchase / Buy Price (₹)</label>
                    <input
                      style={M.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingItem.buyPrice || ""}
                      onChange={(e) => handleEditChange("buyPrice", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div style={M.group}>
                    <label style={M.label}>Supplier</label>
                    <select
                      style={M.select}
                      value={editingItem.supplierId || ""}
                      onChange={(e) => handleEditChange("supplierId", e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">— No Supplier —</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ""}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div style={M.footer}>
              <button style={S.btn} onClick={() => { setShowEditModal(false); setEditingItem(null); }}>Cancel</button>
              <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleEditSave} disabled={saving}>
                {saving ? "Saving…" : editingItem.isNew ? "Add Product" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal (Exact Requested Columns) ─────────────────── */}
      {showImportModal && (
        <div style={M.overlay}>
          <div style={M.lgBox}>
            <div style={M.header}>
              <h2 style={M.title}>
                <Upload size={18} style={{ color: "#6366f1" }} />
                Import Products ({importedItems.length} found)
              </h2>
              <button style={M.closeBtn} onClick={() => { setShowImportModal(false); setImportedItems([]); }}>
                <X size={20} />
              </button>
            </div>

            {(importStats.added || importStats.updated || importStats.skipped) ? (
              <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                {[
                  ["Added", importStats.added, "rgba(22,163,74,0.15)"],
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
                <p style={{ color: "#94a3b8", marginBottom: "12px", fontSize: "12.5px" }}>
                  Items with existing barcode will have quantity added. Review the table below before importing:
                </p>
                <div style={{ maxHeight: "380px", overflow: "auto", borderRadius: "6px", border: "1px solid #334155" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={M.importTh}><input type="checkbox" checked={importedItems.every((i) => i.selected)} onChange={toggleAllImport} /></th>
                        <th style={M.importTh}>SL NO</th>
                        <th style={M.importTh}>SITE NAME</th>
                        <th style={M.importTh}>BARCODE</th>
                        <th style={M.importTh}>CATEGORY</th>
                        <th style={M.importTh}>SIZE</th>
                        <th style={M.importTh}>COLOUR</th>
                        <th style={M.importTh}>F/H SHIRTS</th>
                        <th style={M.importTh}>MRP</th>
                        <th style={M.importTh}>QTY</th>
                        <th style={M.importTh}>STYLE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={M.importTd}><input type="checkbox" checked={item.selected} onChange={() => toggleImportItem(idx)} /></td>
                          <td style={M.importTd}>{idx + 1}</td>
                          <td style={M.importTd}>{item.siteName || "RV Fashion"}</td>
                          <td style={M.importTd}><span style={S.codePill}>{item.barcode}</span></td>
                          <td style={M.importTd}>{item.category || "—"}</td>
                          <td style={M.importTd}>{item.size || "—"}</td>
                          <td style={M.importTd}>{item.colour || "—"}</td>
                          <td style={M.importTd}>{item.fhShirts || "—"}</td>
                          <td style={M.importTd}>₹{Number(item.mrp || 0).toFixed(2)}</td>
                          <td style={M.importTd}><strong>{item.quantity}</strong></td>
                          <td style={M.importTd}>{item.style || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={M.footer}>
                  <button style={S.btn} onClick={() => { setShowImportModal(false); setImportedItems([]); }}>Cancel</button>
                  <button style={{ ...S.btn, ...S.btnPrimary }} onClick={processImportedItems} disabled={processingImport}>
                    {processingImport ? "Processing…" : `Import Selected (${importedItems.filter((i) => i.selected).length})`}
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
              <h2 style={M.title}>
                <Tag size={19} style={{ color: "#38bdf8" }} />
                Product Sticker — RV Fashion
              </h2>
              <button style={M.closeBtn} onClick={() => setShowStickerModal(false)}>
                <X size={20} />
              </button>
            </div>

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
                      {p.category} {p.style} {p.size} ({p.barcode || p.productCode || `ID: ${p.id}`}) — MRP: ₹{parseFloat(p.mrp || p.sellPrice || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* Sticker Visual Preview */}
              <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Live Label Preview (50 × 25 mm)
                </div>

                <div style={{
                  width: "240px",
                  height: "120px",
                  backgroundColor: "#ffffff",
                  borderRadius: "6px",
                  border: "1px solid #94a3b8",
                  padding: "4px 8px",
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
                  <div style={{
                    width: "100%", fontSize: "11px", fontWeight: "900", textAlign: "center",
                    textTransform: "uppercase", letterSpacing: "0.8px", paddingTop: "2px",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {stickerProduct.siteName || "RV FASHION"}
                  </div>

                  <div style={{
                    width: "100%", fontSize: "10px", fontWeight: "700", textAlign: "center",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginTop: "4px",
                  }}>
                    {[stickerProduct.category, stickerProduct.style, stickerProduct.size].filter(Boolean).join(" ") || "Textile Item"}
                  </div>

                  <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", margin: "3px 0 2px 0" }}>
                    <svg ref={previewSvgRef} style={{ maxWidth: "210px", height: "35px", display: "block" }} />
                  </div>

                  <div style={{
                    fontSize: "9.5px", fontFamily: "'Courier New', monospace", fontWeight: "700",
                    letterSpacing: "0.8px", textAlign: "center", lineHeight: "1", marginTop: "1px",
                  }}>
                    {stickerBarcode || "000000"}
                  </div>

                  <div style={{
                    width: "100%", marginTop: "auto", paddingBottom: "3px",
                    display: "flex", justifyContent: "center", alignItems: "center",
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: "900", color: "#000000" }}>
                      MRP: ₹{parseFloat(stickerMrp || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: "10px", fontSize: "11px", color: "#64748b", textAlign: "center" }}>
                  🖨️ For SNBC TVSE LP45 BPLE (2 per row on 101.6mm roll)
                </div>
              </div>

              {/* Controls */}
              <div style={{ flex: "1 1 280px" }}>
                <div style={M.group}>
                  <label style={M.label}>Barcode / SKU</label>
                  <input
                    style={M.input}
                    value={stickerBarcode}
                    onChange={(e) => setStickerBarcode(e.target.value)}
                    placeholder="Barcode string"
                  />
                </div>

                <div style={M.group}>
                  <label style={M.label}>MRP (₹)</label>
                  <input
                    style={M.input}
                    type="number"
                    min="0"
                    step="0.01"
                    value={stickerMrp}
                    onChange={(e) => setStickerMrp(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div style={M.group}>
                  <label style={M.label}>Number of Stickers</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      style={{ ...M.input, width: "90px" }}
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
                  </div>
                </div>
              </div>
            </div>

            <div style={M.footer}>
              <button style={S.btn} onClick={() => setShowStickerModal(false)}>Cancel</button>
              {items.length > 1 && (
                <button
                  style={{ ...S.btn, backgroundColor: "#334155", color: "#f1f5f9" }}
                  onClick={handlePrintAllStickers}
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

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.headerTitle}>
          <h1 style={S.title}>📦 Products & Stock</h1>
          <button style={S.btnGhost} onClick={handleRefresh} title="Refresh data">
            <RefreshCw size={17} />
          </button>
        </div>

        <div style={S.buttonGroup}>
          <button
            style={{ ...S.btn, borderColor: "rgba(56,189,248,0.4)", color: "#38bdf8" }}
            onClick={() => handleOpenStickerModal(null)}
            title="Generate & Print Product Stickers"
          >
            <Tag size={15} /> Product Sticker
          </button>
          <button style={S.btn} onClick={handleExport}><Download size={15} /> Export</button>
          <label style={{ ...S.btn, cursor: "pointer" }}>
            <Upload size={15} /> Import
            <input type="file" hidden onChange={handleImport} accept=".xlsx,.xls,.csv" />
          </label>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleAddNewItem}><Plus size={15} /> Add New Product</button>
        </div>
      </div>

      {/* ── Message Alert ────────────────────────────────────────── */}
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
            placeholder="Search barcode, style, colour, category…"
          />
        </div>

        {/* Category */}
        <select style={S.filterInput} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          <optgroup label="Men's Collection">
            {APPAREL_CATEGORIES_MAP.filter((m) => m.section === "Men").map((m) => (
              <option key={m.category} value={m.category}>{m.label}</option>
            ))}
          </optgroup>
          <optgroup label="Ladies' Collection">
            {APPAREL_CATEGORIES_MAP.filter((m) => m.section === "Ladies").map((m) => (
              <option key={m.category} value={m.category}>{m.label}</option>
            ))}
          </optgroup>
        </select>

        {/* Style */}
        <select style={S.filterInput} value={filterStyle} onChange={(e) => setFilterStyle(e.target.value)}>
          <option value="">All Styles</option>
          <optgroup label="Men's Styles">
            {APPAREL_CATEGORIES_MAP.filter((m) => m.section === "Men").map((m) => (
              <option key={m.style} value={m.style}>{m.style} ({m.category})</option>
            ))}
          </optgroup>
          <optgroup label="Ladies' Styles">
            {APPAREL_CATEGORIES_MAP.filter((m) => m.section === "Ladies").map((m) => (
              <option key={m.style} value={m.style}>{m.style} ({m.category})</option>
            ))}
          </optgroup>
        </select>

        {/* Size */}
        <select style={S.filterInput} value={filterSize} onChange={(e) => setFilterSize(e.target.value)}>
          <option value="">All Sizes</option>
          {APPAREL_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* F/H Shirts */}
        <select style={S.filterInput} value={filterFhShirts} onChange={(e) => setFilterFhShirts(e.target.value)}>
          <option value="">All F/H Shirts</option>
          {FH_SHIRT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

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
            { label: "Total Products", value: (filterSummary.total_products || 0).toLocaleString(), accent: "#6366f1" },
            { label: "Total Quantity", value: (filterSummary.total_qty || 0).toLocaleString(), accent: "#10b981" },
            { label: "Total Stock Value", value: `₹${Number(filterSummary.total_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, accent: "#f59e0b" },
            { label: "Avg Product MRP", value: `₹${Number(filterSummary.avg_mrp !== undefined ? filterSummary.avg_mrp : (filterSummary.avg_sell_price || 0)).toFixed(2)}`, accent: "#ec4899" },
          ].map(({ label, value, accent }) => (
            <div key={label} style={S.statCard(accent)}>
              <div style={S.statLabel}>{label}</div>
              <div style={S.statValue}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Products Table (Exact Requested Columns) ─────────────── */}
      <div style={S.tableWrap}>
        {loading ? (
          <div style={S.loadingRow}>Loading products…</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thStatic}>SL NO</th>
                <th style={{ ...S.th }} onClick={() => handleSort("site_name")}>SITE NAME <SortIcon col="site_name" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("product_code")}>BARCODE <SortIcon col="product_code" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("category")}>CATEGORY <SortIcon col="category" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("size")}>SIZE <SortIcon col="size" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("colour")}>COLOUR <SortIcon col="colour" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("fh_shirts")}>F/H SHIRTS <SortIcon col="fh_shirts" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("mrp")}>MRP <SortIcon col="mrp" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("quantity")}>QTY <SortIcon col="quantity" /></th>
                <th style={{ ...S.th }} onClick={() => handleSort("style")}>STYLE <SortIcon col="style" /></th>
                <th style={S.thStatic}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="11" style={S.emptyState}>
                    {hasActiveFilters
                      ? "No products match the current filters."
                      : "No products found. Click 'Add New Product' to get started."}
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const lowStock = (parseInt(item.quantity) || 0) <= LOW_STOCK_THRESHOLD;
                  const tdStyle = lowStock ? S.tdLowStock : S.td;
                  const slNo = (currentPage - 1) * itemsPerPage + idx + 1;
                  const displayBarcode = item.barcode || item.productCode || "—";
                  const displayMrp = item.mrp !== undefined && item.mrp !== null ? parseFloat(item.mrp).toFixed(2) : parseFloat(item.sellPrice || 0).toFixed(2);

                  return (
                    <tr key={item.id} style={{ backgroundColor: lowStock ? "rgba(217,119,6,0.05)" : "transparent" }}>
                      {/* 1. SL NO */}
                      <td style={tdStyle}>
                        <span style={{ color: "#64748b", fontWeight: "600" }}>{slNo}</span>
                      </td>

                      {/* 2. SITE NAME */}
                      <td style={tdStyle}>
                        <span style={S.sitePill}>{item.siteName || item.site_name || "RV Fashion"}</span>
                      </td>

                      {/* 3. BARCODE */}
                      <td style={tdStyle}>
                        <span style={S.codePill}>{displayBarcode}</span>
                      </td>

                      {/* 4. CATEGORY */}
                      <td style={tdStyle}>
                        {item.category ? <span style={S.catPill}>{item.category}</span> : <span style={{ color: "#475569" }}>—</span>}
                      </td>

                      {/* 5. SIZE */}
                      <td style={tdStyle}>
                        {item.size ? <span style={S.sizePill}>{item.size}</span> : <span style={{ color: "#475569" }}>—</span>}
                      </td>

                      {/* 6. COULOUR */}
                      <td style={tdStyle}>
                        <strong style={{ color: "#f1f5f9" }}>{item.colour || item.color || "—"}</strong>
                      </td>

                      {/* 7. F/H SHIRTS */}
                      <td style={tdStyle}>
                        <span style={{ color: "#cbd5e1" }}>{item.fhShirts || item.fh_shirts || "—"}</span>
                      </td>

                      {/* 8. MRP */}
                      <td style={{ ...tdStyle, fontWeight: "700", color: "#4ade80" }}>
                        ₹{displayMrp}
                      </td>

                      {/* 9. QTY */}
                      <td style={{ ...tdStyle, fontWeight: "700" }}>
                        {item.quantity ?? 0}
                        {lowStock && <span style={S.lowBadge}><AlertTriangle size={9} /> Low</span>}
                      </td>

                      {/* 10. STYLE */}
                      <td style={{ ...tdStyle, color: "#e2e8f0" }}>
                        {item.style || "—"}
                      </td>

                      {/* 11. ACTIONS */}
                      <td style={tdStyle}>
                        <div style={S.actionBtns}>
                          <button style={S.stickerBtn} onClick={() => handleOpenStickerModal(item)} title="Print Product Sticker"><Tag size={15} /></button>
                          <button style={S.editBtn} onClick={() => handleEditClick(item)} title="Edit"><Edit size={15} /></button>
                          <button style={S.delBtn} onClick={() => handleDelete(item.id)} title="Delete"><Trash2 size={15} /></button>
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
              if (show) return <button key={n} style={S.pagBtn(currentPage === n, false)} onClick={() => paginate(n)}>{n}</button>;
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