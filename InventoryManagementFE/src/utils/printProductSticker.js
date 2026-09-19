import JsBarcode from "jsbarcode";

/**
 * ================================================================
 * PRODUCT STICKER PRINTING — RV FASHION
 * ================================================================
 *
 * Printer:
 *   SNBC TVSE LP45 BPLE (gap-sensing thermal label printer)
 *
 * PHYSICAL ROLL / STOCK:
 *   101.6 mm wide   (4 inch roll)
 *   25 mm tall      (= ONE sticker row)
 *
 * STICKER:
 *   50 mm × 25 mm
 *
 * LAYOUT:
 *   2 stickers per row (50mm + 50mm = 100mm, with 0.8mm side margins)
 *   Row gap = 2.5 mm
 *
 * CONTENT:
 *   - Store Title: "RV FASHION"
 *   - Product Name
 *   - Barcode SVG (CODE128)
 *   - Barcode Text / SKU
 *   - Price Section: Clean MRP (no strikethrough, no divider lines)
 */

export const printProductSticker = (
  productOrList,
  options = {}
) => {
  if (!productOrList) return;

  const {
    copies: explicitCopies,
    autoPrint = true,
    storeName = "RV FASHION",
    pageWidth = 101.6,
    pageHeight = stickerHeightDefault(options),
    stickerWidth = 50,
    stickerHeight = 25,
    rowGap = 2.5,
  } = options;

  // ==============================================================
  // PRODUCTS
  // ==============================================================

  const products = Array.isArray(productOrList)
    ? productOrList
    : [productOrList];

  if (products.length === 0) return;

  // ==============================================================
  // CONSTANTS
  // ==============================================================

  const PAGE_WIDTH = Number(pageWidth);
  const PAGE_HEIGHT = Number(pageHeight);

  const STICKER_WIDTH = Number(stickerWidth);
  const STICKER_HEIGHT = Number(stickerHeight);

  const ROW_GAP = Number(rowGap);

  if (
    !Number.isFinite(PAGE_WIDTH) ||
    !Number.isFinite(PAGE_HEIGHT) ||
    !Number.isFinite(STICKER_WIDTH) ||
    !Number.isFinite(STICKER_HEIGHT)
  ) {
    console.error("Invalid sticker/page dimensions.");
    return;
  }

  // ==============================================================
  // HORIZONTAL POSITION
  // ==============================================================

  const SIDE_SPACE = (PAGE_WIDTH - STICKER_WIDTH * 2) / 2;
  const LEFT_STICKER_POSITION = SIDE_SPACE;
  const RIGHT_STICKER_POSITION = SIDE_SPACE + STICKER_WIDTH;

  const MAX_ROWS_PER_PAGE = Math.max(
    1,
    Math.floor((PAGE_HEIGHT + ROW_GAP) / (STICKER_HEIGHT + ROW_GAP))
  );

  // ==============================================================
  // ESCAPE HTML
  // ==============================================================

  const escapeHtml = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // ==============================================================
  // HELPERS
  // ==============================================================

  const getProductCode = (product) => {
    return String(
      product.productCode ||
      product.barcode ||
      product.code ||
      product.sku ||
      (product.id ? `RVT-${String(product.id).padStart(5, "0")}` : "000000")
    ).trim();
  };

  const getProductName = (product) => {
    return (
      product.name ||
      product.productName ||
      product.description ||
      "Textile Item"
    );
  };

  const getSellingPrice = (product) => {
    const candidates = [
      product.sellPrice,
      product.sell_price,
      product.sellingPrice,
      product.price,
      product.discountAmount,
      product.discount_amount,
    ];
    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== "" && !isNaN(Number(c)) && Number(c) > 0) {
        return Number(c);
      }
    }
    const mrp = Number(product.mrp || product.MRP || 0);
    return mrp > 0 ? mrp : 0;
  };

  const getMrp = (product) => {
    if (product.mrp !== undefined && product.mrp !== null && !isNaN(Number(product.mrp)) && Number(product.mrp) > 0) {
      return Number(product.mrp);
    }
    if (product.MRP !== undefined && product.MRP !== null && !isNaN(Number(product.MRP)) && Number(product.MRP) > 0) {
      return Number(product.MRP);
    }
    const sell = getSellingPrice(product);
    return sell > 0 ? sell : 0;
  };

  // ==============================================================
  // BARCODE GENERATION
  // ==============================================================

  const generateBarcode = (productCode) => {
    const svgNode = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    try {
      JsBarcode(svgNode, productCode, {
        format: "CODE128",
        width: 1.4,
        height: 36,
        displayValue: false,
        margin: 0,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
      });
    } catch (error) {
      console.error("Barcode generation failed for:", productCode, error);
    }

    return svgNode.outerHTML;
  };

  // ==============================================================
  // RENDER ONE EXACT 50 × 25 MM STICKER
  // ==============================================================

  const renderStickerHTML = (product) => {
    if (!product) {
      return `<div class="sticker blank-sticker"></div>`;
    }

    const productCode = getProductCode(product);
    const productName = getProductName(product);
    const rawSellingPrice = getSellingPrice(product);
    const rawMrp = getMrp(product);

    const activePrice = rawSellingPrice > 0 ? rawSellingPrice : (rawMrp > 0 ? rawMrp : 0);
    const priceDisplayStr = Number.isFinite(activePrice) ? activePrice.toFixed(2) : "0.00";
    const barcodeSvg = generateBarcode(productCode);

    return `
      <div class="sticker">
        <!-- STORE NAME -->
        <div class="sticker-header">
          ${escapeHtml(storeName)}
        </div>

        <!-- PRODUCT NAME -->
        <div class="product-name" title="${escapeHtml(productName)}">
          ${escapeHtml(productName)}
        </div>

        <!-- BARCODE -->
        <div class="barcode-container">
          ${barcodeSvg}
        </div>

        <!-- BARCODE NUMBER -->
        <div class="barcode-number">
          ${escapeHtml(productCode)}
        </div>

        <!-- PRICE SECTION (MRP Only, No Lines, No Strikethrough) -->
        <div class="price-section">
          <span class="mrp-price">
            MRP: &#8377;${priceDisplayStr}
          </span>
        </div>
      </div>
    `;
  };

  // ==============================================================
  // CREATE ALL LABEL COPIES
  // ==============================================================

  const allLabels = [];

  products.forEach((product) => {
    if (!product) return;

    let totalCopies;
    if (explicitCopies !== undefined && explicitCopies !== null) {
      totalCopies = Number(explicitCopies);
    } else {
      const quantity = parseInt(product.quantity, 10);
      totalCopies = quantity > 0 ? quantity : 1;
    }

    if (!Number.isFinite(totalCopies) || totalCopies <= 0) {
      totalCopies = 1;
    }
    totalCopies = Math.floor(totalCopies);

    for (let i = 0; i < totalCopies; i++) {
      allLabels.push(product);
    }
  });

  if (allLabels.length === 0) return;

  // ==============================================================
  // CREATE TWO STICKERS PER ROW
  // ==============================================================

  const rows = [];

  for (let i = 0; i < allLabels.length; i += 2) {
    const firstProduct = allLabels[i];
    const secondProduct = allLabels[i + 1] || null;

    rows.push(`
      <div class="sticker-row">
        ${renderStickerHTML(firstProduct)}
        ${secondProduct ? renderStickerHTML(secondProduct) : `<div class="sticker blank-sticker"></div>`}
      </div>
    `);
  }

  // ==============================================================
  // SPLIT INTO PHYSICAL PAGES
  // ==============================================================

  const pages = [];

  for (let i = 0; i < rows.length; i += MAX_ROWS_PER_PAGE) {
    const pageRows = rows.slice(i, i + MAX_ROWS_PER_PAGE);
    pages.push(`
      <div class="print-page">
        ${pageRows.join("")}
      </div>
    `);
  }

  const pagesHtml = pages.join("");

  // ==============================================================
  // COMPLETE PRINT HTML
  // ==============================================================

  const fullHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>RV Fashion - Product Stickers</title>
<style>
/* GLOBAL RESET */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* PHYSICAL PAGE */
@page {
  size: ${PAGE_WIDTH}mm ${PAGE_HEIGHT}mm;
  margin: 0 !important;
}

/* HTML / BODY */
html, body {
  width: ${PAGE_WIDTH}mm;
  margin: 0;
  padding: 0;
  font-family: Arial, "Segoe UI", sans-serif;
  color: #000;
  background: #f1f5f9;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

/* PREVIEW TOOLBAR */
.preview-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #0f172a;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  z-index: 9999;
  font-size: 12px;
  border-bottom: 1px solid #334155;
}

.info-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.printer-badge {
  background: #6366f1;
  padding: 4px 9px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 11px;
}

.size-badge, .layout-badge {
  background: #1e293b;
  padding: 4px 9px;
  border-radius: 4px;
  font-weight: 600;
  border: 1px solid #334155;
  font-size: 11px;
}

.print-btn {
  border: none;
  background: #16a34a;
  color: white;
  padding: 8px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 6px rgba(22,163,74,0.3);
}

.print-btn:hover {
  background: #15803d;
}

/* PREVIEW CONTAINER */
.preview-container {
  margin-top: 70px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

/* PHYSICAL PAGE */
.print-page {
  position: relative;
  width: ${PAGE_WIDTH}mm;
  height: ${PAGE_HEIGHT}mm;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  background: white;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
}

/* STICKER ROW */
.sticker-row {
  position: relative;
  width: ${PAGE_WIDTH}mm;
  height: ${STICKER_HEIGHT}mm;
  margin: 0 0 ${ROW_GAP}mm 0;
  padding: 0;
  display: block;
  overflow: hidden;
  box-sizing: border-box;
  page-break-inside: avoid;
  break-inside: avoid;
  flex-shrink: 0;
}

/* EXACT 50 × 25 MM STICKER */
.sticker {
  position: absolute;
  top: 0;
  width: ${STICKER_WIDTH}mm;
  min-width: ${STICKER_WIDTH}mm;
  max-width: ${STICKER_WIDTH}mm;
  height: ${STICKER_HEIGHT}mm;
  min-height: ${STICKER_HEIGHT}mm;
  max-height: ${STICKER_HEIGHT}mm;
  box-sizing: border-box;
  margin: 0;
  padding: 0.5mm 1.2mm 0.3mm 1.2mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
  overflow: hidden;
  background: white;
  page-break-inside: avoid;
  break-inside: avoid;
}

.sticker-row > .sticker:first-child {
  left: ${LEFT_STICKER_POSITION}mm;
}

.sticker-row > .sticker:nth-child(2) {
  left: ${RIGHT_STICKER_POSITION}mm;
}

.blank-sticker {
  visibility: hidden !important;
  border: none !important;
  background: transparent !important;
}

/* STORE NAME (No Border Line) */
.sticker-header {
  width: 100%;
  height: 2.8mm;
  flex: 0 0 2.8mm;
  font-size: 6pt;
  line-height: 2.8mm;
  font-weight: 900;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  padding: 0;
  letter-spacing: 0.5px;
}

/* PRODUCT NAME (Shifted slightly downwards) */
.product-name {
  width: 100%;
  height: 2.8mm;
  flex: 0 0 2.8mm;
  font-size: 5.5pt;
  line-height: 2.8mm;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0.8mm 0 0 0;
  padding: 0;
}

/* BARCODE CONTAINER */
.barcode-container {
  width: 100%;
  height: 6.8mm;
  flex: 0 0 6.8mm;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin: 0.5mm 0 0 0;
  padding: 0;
}

.barcode-container svg {
  display: block;
  width: auto;
  max-width: 44mm;
  height: 6.5mm;
  max-height: 6.5mm;
  margin: 0;
  padding: 0;
}

/* BARCODE NUMBER */
.barcode-number {
  width: 100%;
  height: 2.2mm;
  flex: 0 0 2.2mm;
  font-family: "Courier New", monospace;
  font-size: 5pt;
  line-height: 2.2mm;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-align: center;
  margin: 0.3mm 0 0 0;
  padding: 0;
  letter-spacing: 0.5px;
}

/* PRICE SECTION: Centered MRP only (No Border Line, No Strikethrough) */
.price-section {
  width: 100%;
  height: 4.8mm;
  flex: 0 0 4.8mm;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin: 0.6mm 0 0 0;
  padding: 0 0.5mm;
  line-height: 1;
  overflow: hidden;
}

.mrp-price {
  font-size: 6.8pt;
  font-weight: 900;
  color: #000;
  white-space: nowrap;
}

/* PRINT STYLES */
@media print {
  @page {
    size: ${PAGE_WIDTH}mm ${PAGE_HEIGHT}mm;
    margin: 0 !important;
  }

  html, body {
    width: ${PAGE_WIDTH}mm !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    overflow: visible !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .preview-toolbar {
    display: none !important;
  }

  .preview-container {
    display: block !important;
    width: ${PAGE_WIDTH}mm !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .print-page {
    position: relative !important;
    width: ${PAGE_WIDTH}mm !important;
    height: ${PAGE_HEIGHT}mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: white !important;
    box-shadow: none !important;
    page-break-after: always !important;
    break-after: page !important;
  }

  .print-page:last-child {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }

  .sticker-row {
    position: relative !important;
    width: ${PAGE_WIDTH}mm !important;
    height: ${STICKER_HEIGHT}mm !important;
    margin: 0 0 ${ROW_GAP}mm 0 !important;
    padding: 0 !important;
    display: block !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    flex-shrink: 0 !important;
  }

  .sticker {
    position: absolute !important;
    top: 0 !important;
    width: ${STICKER_WIDTH}mm !important;
    min-width: ${STICKER_WIDTH}mm !important;
    max-width: ${STICKER_WIDTH}mm !important;
    height: ${STICKER_HEIGHT}mm !important;
    min-height: ${STICKER_HEIGHT}mm !important;
    max-height: ${STICKER_HEIGHT}mm !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0.5mm 1.2mm 0.3mm 1.2mm !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: flex-start !important;
    text-align: center !important;
    overflow: hidden !important;
    background: white !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  .sticker-row > .sticker:first-child {
    left: ${LEFT_STICKER_POSITION}mm !important;
  }

  .sticker-row > .sticker:nth-child(2) {
    left: ${RIGHT_STICKER_POSITION}mm !important;
  }

  .barcode-container {
    width: 100% !important;
    height: 6.8mm !important;
    flex: 0 0 6.8mm !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
    margin: 0.2mm 0 0 0 !important;
    padding: 0 !important;
  }

  .barcode-container svg {
    display: block !important;
    width: auto !important;
    max-width: 44mm !important;
    height: 6.5mm !important;
    max-height: 6.5mm !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .blank-sticker {
    visibility: hidden !important;
    border: none !important;
    background: transparent !important;
  }

  .sticker-header,
  .product-name,
  .barcode-container,
  .barcode-number,
  .price-section {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
</style>
</head>
<body>

<!-- PREVIEW TOOLBAR -->
<div class="preview-toolbar">
  <div class="info-group">
    <span class="printer-badge">🖨️ SNBC TVSE LP45 BPLE</span>
    <span class="size-badge">Roll: ${PAGE_WIDTH} × ${PAGE_HEIGHT} mm</span>
    <span class="layout-badge">Sticker: ${STICKER_WIDTH} × ${STICKER_HEIGHT} mm (2/row)</span>
  </div>
  <button class="print-btn" onclick="window.print()">
    🖨️ Print Stickers
  </button>
</div>

<!-- PRINT PREVIEW -->
<div class="preview-container">
  ${pagesHtml}
</div>

${autoPrint
      ? `
  <script>
    window.addEventListener("load", function() {
      setTimeout(function() {
        window.print();
      }, 700);
    });
  </script>
`
      : ""
    }

</body>
</html>
`;

  // ==============================================================
  // OPEN PRINT WINDOW
  // ==============================================================

  let popupWindow = null;
  try {
    popupWindow = window.open("", "_blank", "width=1000,height=800");
  } catch (error) {
    console.warn("Popup opening failed:", error);
  }

  if (popupWindow && !popupWindow.closed) {
    try {
      popupWindow.document.open();
      popupWindow.document.write(fullHtmlContent);
      popupWindow.document.close();
      return;
    } catch (error) {
      console.warn("Popup write failed, trying iframe fallback.", error);
    }
  }

  // ==============================================================
  // IFRAME FALLBACK
  // ==============================================================

  let printFrame = document.getElementById("sticker-print-iframe");
  if (!printFrame) {
    printFrame = document.createElement("iframe");
    printFrame.id = "sticker-print-iframe";
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.visibility = "hidden";
    document.body.appendChild(printFrame);
  }

  const frameWindow = printFrame.contentWindow;
  const frameDocument = frameWindow.document;

  frameDocument.open();
  frameDocument.write(fullHtmlContent);
  frameDocument.close();

  if (autoPrint) {
    setTimeout(() => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } catch (error) {
        console.error("Iframe print failed:", error);
      }
    }, 1000);
  }
};

function stickerHeightDefault(options) {
  return Number(options.stickerHeight) || 25;
}

export default printProductSticker;
