import { Product } from "@/data/products";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Canvg } from "canvg";
import { ExportConfig, EXPORT_COLORS, EXPORT_DIM } from "./exportConstants";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default: return c;
    }
  });
}

function getFontSettings(text: string) {
  const len = text.length;
  // Base 10pt = ~2.4
  if (len <= 70) return { fontSize: 2.3, charLimit: 32, maxLines: 3 };
  if (len <= 120) return { fontSize: 2.1, charLimit: 38, maxLines: 3 };
  return { fontSize: 1.9, charLimit: 42, maxLines: 3 };
}

function wrapText(text: string, limit: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const lines: string[] = [];
  
  for (let i = 0; i < words.length; i += 2) {
    if (lines.length >= maxLines) break;
    
    let chunk = words.slice(i, i + 2).join(" ");
    
    // Check if we are on the last allowed line and there are more words remaining
    if (lines.length === maxLines - 1 && i + 2 < words.length) {
      if (chunk.length > limit - 3) {
        chunk = chunk.substring(0, limit - 3) + "...";
      } else {
        chunk += "...";
      }
    } else if (chunk.length > limit) {
      chunk = chunk.substring(0, limit);
    }
    
    lines.push(chunk);
  }
  
  return lines;
}

async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
       throw new Error(`Invalid content type: ${blob.type}`);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Failed to convert image to base64:", url, err);
    return ""; // Return empty string on failure
  }
}

export function generatePageSvg(
  products: Product[],
  brand: string,
  category: string,
  pageInfo: string,
  config: ExportConfig,
  bannerUrl?: string,
  imageMap: Record<string, string> = {}
): string {
  const contentWidth = EXPORT_DIM.WIDTH - EXPORT_DIM.SIDEBAR_WIDTH;
  const BINDER_OFFSET = 8.5;
  const gridWidth = contentWidth - (EXPORT_DIM.MARGIN * 2) - BINDER_OFFSET;
  
  const hasBanner = !!bannerUrl;
  const bannerHeight = hasBanner ? 50 : 0;
  const headerHeight = hasBanner ? bannerHeight : EXPORT_DIM.HEADER_HEIGHT;
  
  // Recalculate grid height to fit remaining space if banner is present
  const footerAreaH = 8; // Reduced for simplification
  const gridTop = headerHeight + EXPORT_DIM.MARGIN;
  const gridBottom = 297 - footerAreaH - EXPORT_DIM.MARGIN;
  const gridHeight = gridBottom - gridTop;
  
  const COLS = 4;
  const ROWS = 3;
  const colWidth = gridWidth / COLS;
  const rowHeight = gridHeight / ROWS;
  
  const cardWidth = colWidth - EXPORT_DIM.GAP;
  const cardHeight = rowHeight - EXPORT_DIM.GAP;

  let cardsSvg = "";
  products.forEach((p, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = EXPORT_DIM.MARGIN + BINDER_OFFSET + col * colWidth;
    const y = headerHeight + EXPORT_DIM.MARGIN + row * rowHeight;

    const STORAGE_BASE = import.meta.env.VITE_SUPABASE_URL || "";
    const STORAGE_URL = `${STORAGE_BASE}/storage/v1/object/public/product-images`;
    // Use the base64 mapping, then the pre-mapped local imageUrl, then fallback to Supabase
    const imgUrl = imageMap[p.code] || (p.imageUrl ? escapeXml(p.imageUrl) : escapeXml(`${STORAGE_URL}/${p.code}.png`));
    
    // Card Layout Internal Math (4x4 specific)
    const padding = 2.0;
    const innerWidth = cardWidth - (padding * 2);
    
    const brandSize = 2.4;
    const catSize = 1.8;
    const groupGap = 0.5;
    
    const showBrand = config.showBrand && p.brand;
    const showCat = config.showCategory && p.category;
    const showName = config.showName && p.name;

    const fontSettings = getFontSettings(p.name || "");
    const nameSize = fontSettings.fontSize;
    const nameLines = showName ? wrapText((p.name || "").toUpperCase(), fontSettings.charLimit, fontSettings.maxLines) : [];
    
    let totalMetaH = 0;
    if (showBrand) totalMetaH += brandSize + groupGap;
    if (showCat) totalMetaH += catSize + groupGap;
    if (showName) {
      totalMetaH += (nameLines.length * nameSize) + ((nameLines.length - 1) * 0.8);
    }
    
    const tableFields = [
      { id: "code", label: "Cód.", value: p.code, active: config.showCode },
      { id: "box", label: "Caixa", value: p.packSize, active: config.showBox },
      { id: "ean", label: "EAN", value: p.ean, active: config.showEan },
    ].filter(f => f.active);

    const rowH = 4.0; 
    const pillGap = 1.0; 
    const tableH = tableFields.length * (rowH + pillGap);
    const tableW = cardWidth * 0.94; 

    // 1. Calculate Image Area dynamically
    const imgY = padding;
    // exact size the image needs to be to fill the card
    const maxImgH = Math.max(20, cardHeight - (totalMetaH + tableH + padding * 2 + 4));
    const imgH = maxImgH; // Fill responsive space

    const imgBorderSvg = `<rect x="${padding}" y="${imgY}" width="${innerWidth}" height="${imgH}" rx="2" fill="white" />`;
    const imageSvg = `<image href="${imgUrl}" x="${padding + 0.5}" y="${imgY + 0.5}" width="${innerWidth - 1}" height="${imgH - 1}" preserveAspectRatio="xMidYMid meet" />`;

    // 2. Metadata Area
    const metaAreaStartY = imgY + imgH + 2;
    let currentY = metaAreaStartY; // Start immediately after image
    
    // 3. Table Data (Starts slightly after metadata)
    const tableY = currentY + totalMetaH + 2;

    // Determine actual card height based on filled space
    const actualCardHeight = tableY + tableH + padding;
    // ensure it's not smaller than rowHeight-gap
    const finalCardHeight = Math.max(cardHeight, actualCardHeight);

    let tableSvg = "";
    if (tableFields.length > 0) {
      const labelW = tableW * 0.35;
      let rowsList = "";
      tableFields.forEach((f, idx) => {
        const yOffset = idx * (rowH + pillGap);
        rowsList += `
          <g transform="translate(0, ${yOffset})">
            <rect width="${tableW}" height="${rowH}" rx="${rowH / 2}" fill="#3B6898" />
            <rect width="${labelW}" height="${rowH}" rx="${rowH / 2}" fill="#5D82AC" />
            <line x1="${labelW}" y1="0" x2="${labelW}" y2="${rowH}" stroke="white" stroke-width="0.1" stroke-opacity="0.3" />
            <text x="${labelW / 2}" y="${rowH / 2 + 0.9}" font-family="sans-serif" font-size="2.4" fill="white" font-weight="bold" text-anchor="middle">${escapeXml(f.label)}</text>
            <text x="${labelW + 2}" y="${rowH / 2 + 0.9}" font-family="sans-serif" font-size="2.4" fill="white" font-weight="bold">${escapeXml(f.value)}</text>
          </g>`;
      });

      tableSvg = `<g transform="translate(${(cardWidth - tableW) / 2}, ${tableY})">${rowsList}</g>`;
    }

    let brandSvg = "";
    if (showBrand) {
      brandSvg = `<text x="${cardWidth / 2}" y="${currentY + brandSize}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${brandSize}" fill="#3B6898">${escapeXml(p.brand).toUpperCase()}</text>`;
      currentY += brandSize + groupGap;
    }

    let categorySvg = "";
    if (showCat) {
      categorySvg = `<text x="${cardWidth / 2}" y="${currentY + catSize}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${catSize}" fill="#94A3B8">${escapeXml(p.category).toUpperCase()}</text>`;
      currentY += catSize + groupGap;
    }

    let nameSvg = "";
    if (showName && nameLines.length > 0) {
      const tspans = nameLines.map((line, idx) => 
        `<tspan x="${cardWidth / 2}" dy="${idx === 0 ? 0 : nameSize + 0.8}">${escapeXml(line)}</tspan>`
      ).join("");

      nameSvg = `
        <text x="${cardWidth / 2}" y="${currentY + nameSize}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${nameSize}" fill="#3B6898" style="line-height: 1.3">
          ${tspans}
        </text>
      `;
    }

    cardsSvg += `
      <g id="card-${p.code}" transform="translate(${x}, ${y})">
        <rect width="${cardWidth}" height="${finalCardHeight}" fill="white" rx="3" stroke="#E2E8F0" stroke-width="0.4" />
        ${imgBorderSvg}
        ${imageSvg}
        ${brandSvg}
        ${categorySvg}
        ${nameSvg}
        ${tableSvg}
      </g>
    `;
  });

  const sidebarText = escapeXml(`${brand} ${category ? `- ${category}` : ""}`.toUpperCase());

  const headerMarkup = hasBanner 
    ? `<image href="${imageMap['header'] || escapeXml(bannerUrl!)}" x="0" y="0" width="195" height="${bannerHeight}" preserveAspectRatio="xMidYMid slice" />`
    : `<path d="M 0 0 H 195 V 35 C 195 38 190 42 180 42 H 0 Z" fill="#3B6898" />`;

  const logoHref = imageMap['logo'] || "/logo.png";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 210 297" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">
  <rect width="210" height="297" fill="white" />
  
  ${headerMarkup}
  
  <rect x="195" y="0" width="15" height="297" fill="${config.sidebarColor || "#EA0086"}" />
  
  <g transform="translate(202.5, 287)">
    <text text-anchor="start" font-family="sans-serif" font-weight="bold" font-size="9" fill="white" transform="rotate(-90)" dominant-baseline="middle">
      ${sidebarText}
    </text>
  </g>
  
  <g id="cards-container">
    ${cardsSvg}
  </g>
  
  <image href="${logoHref}" x="16.5" y="284.5" width="29.75" height="8.5" preserveAspectRatio="xMinYMid meet" />

  <text x="187" y="292" text-anchor="end" font-family="sans-serif" font-size="5" font-weight="900" fill="#3B6898">
    ${escapeXml(pageInfo)}
  </text>
</svg>`;
}

async function svgToCanvas(svgString: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const v = await Canvg.from(ctx, svgString);
  await v.render();
  return canvas;
}

export async function exportCatalogAsPdf(
  products: Product[],
  config: ExportConfig,
  pageBanners: Record<number, string> = {}
) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const grouped = products.reduce((acc, p) => {
    if (!acc[p.brand]) acc[p.brand] = [];
    acc[p.brand].push(p);
    return acc;
  }, {} as Record<string, Product[]>);

  const entries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  
  // A4 size at 300 DPI is ~2480 x 3508
  const DPI = 300;
  const pixelWidth = Math.round((210 / 25.4) * DPI);
  const pixelHeight = Math.round((297 / 25.4) * DPI);

  // Pre-fetch logo base64
  let logoBase64: string | null = null;
  try {
    logoBase64 = await urlToBase64("/logo.png");
  } catch (e) {
    console.warn("Could not fetch logo.png for PDF template", e);
  }

  let globalPageIndex = 0;
  let isFirstPage = true;

  for (const [brand, brandProducts] of entries) {
    brandProducts.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const itemsPerPage = 12;
    const totalPages = Math.ceil(brandProducts.length / itemsPerPage);
    
    for (let i = 0; i < totalPages; i++) {
      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;

      const pageProducts = brandProducts.slice(i * itemsPerPage, (i + 1) * itemsPerPage);
      const pageNum = i + 1;
      const categoryHint = pageProducts.length > 0 ? pageProducts[0].category : "";
      
      // Pre-fetch images as Base64 for the current page
      const imageMap: Record<string, string> = {};
      if (logoBase64) imageMap['logo'] = logoBase64;
      const STORAGE_BASE = import.meta.env.VITE_SUPABASE_URL || "";
      const STORAGE_URL = `${STORAGE_BASE}/storage/v1/object/public/product-images`;

      // Fetch banner if it exists
      if (pageBanners[globalPageIndex]) {
        const base64 = await urlToBase64(pageBanners[globalPageIndex]);
        if (base64) imageMap['header'] = base64;
      }

      // Fetch all product images for the current page in parallel
      await Promise.all(pageProducts.map(async (p) => {
        const fullUrl = p.imageUrl ? p.imageUrl : `${STORAGE_URL}/${p.code}.png`;
        const base64 = await urlToBase64(fullUrl);
        if (base64) {
          imageMap[p.code] = base64;
        } else {
          // Placeholder transparency if failed to avoid blanking
          imageMap[p.code] = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        }
      }));

      const svg = generatePageSvg(
        pageProducts,
        brand,
        categoryHint,
        `${pageNum}`,
        config,
        pageBanners[globalPageIndex],
        imageMap
      );

      // HIGH QUALITY RENDER: SVG -> Blob -> Image -> Canvas
      const canvas = document.createElement("canvas");
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      await new Promise((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
          URL.revokeObjectURL(url);
          resolve(true);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(false);
        };
        img.src = url;
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "SLOW");
      
      globalPageIndex++;
    }
  }

  pdf.save("Catalogo_Chok.pdf");
}

export async function exportCatalogAsSvg(
  products: Product[], 
  config: ExportConfig,
  pageBanners: Record<number, string> = {}
) {
  const zip = new JSZip();

  const grouped = products.reduce((acc, p) => {
    if (!acc[p.brand]) acc[p.brand] = [];
    acc[p.brand].push(p);
    return acc;
  }, {} as Record<string, Product[]>);

  const entries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  
  // Pre-fetch logo base64
  let logoBase64: string | null = null;
  try {
    logoBase64 = await urlToBase64("/logo.png");
  } catch (e) {
    console.warn("Could not fetch logo.png for SVG template", e);
  }

  let globalPageIndex = 0;
  for (const [brand, brandProducts] of entries) {
    brandProducts.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const itemsPerPage = 12;
    const totalPages = Math.ceil(brandProducts.length / itemsPerPage);
    
    for (let i = 0; i < totalPages; i++) {
      const pageProducts = brandProducts.slice(i * itemsPerPage, (i + 1) * itemsPerPage);
      const pageNum = i + 1;
      const categoryHint = pageProducts.length > 0 ? pageProducts[0].category : "";
      
      const imageMap: Record<string, string> = {};
      if (logoBase64) imageMap['logo'] = logoBase64;
      if (pageBanners[globalPageIndex]) {
        try {
          const bannerBase64 = await urlToBase64(pageBanners[globalPageIndex]);
          if (bannerBase64) imageMap['header'] = bannerBase64;
        } catch(e) {
          console.warn("Could not fetch banner", e);
        }
      }

      const STORAGE_BASE = import.meta.env.VITE_SUPABASE_URL || "";
      const STORAGE_URL = `${STORAGE_BASE}/storage/v1/object/public/product-images`;

      // Fetch all product images for the current page in parallel
      await Promise.all(pageProducts.map(async (p) => {
        const fullUrl = p.imageUrl ? p.imageUrl : `${STORAGE_URL}/${p.code}.png`;
        const base64 = await urlToBase64(fullUrl);
        if (base64) {
          imageMap[p.code] = base64;
        } else {
          imageMap[p.code] = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        }
      }));

      const svg = generatePageSvg(
        pageProducts,
        brand,
        categoryHint,
        `${pageNum}`,
        config,
        pageBanners[globalPageIndex],
        imageMap
      );
      
      const safeBrand = brand.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      zip.file(`Catalogo_${safeBrand}_${pageNum}.svg`, svg);
      globalPageIndex++;
    }
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "Catalogo_Chok.zip");
}
