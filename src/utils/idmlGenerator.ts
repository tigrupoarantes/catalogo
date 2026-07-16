import JSZip from 'jszip';
import { Product, parseProductTechnicalData } from '../data/products';
import { ExportConfig, EXPORT_DIM } from './exportConstants';
import fs from 'fs';
import path from 'path';

const MM_TO_PT = 2.83464567; // 1 mm = 2.83464567 points
const PAGE_HALF_WIDTH = 105; // A4 width 210 / 2

// Helper to escape XML strings
function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

// Convert Hex Color to Space-separated RGB string
function hexToRgb(hex: string): string {
  if (!hex) return "234 0 134";
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean.substring(0, 1) + clean.substring(0, 1), 16);
    const g = parseInt(clean.substring(1, 2) + clean.substring(1, 2), 16);
    const b = parseInt(clean.substring(2, 3) + clean.substring(2, 3), 16);
    return `${r} ${g} ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
  return "234 0 134";
}

function replaceStoryText(storyXml: string, newText: string): string {
  let replaced = false;
  return storyXml.replace(/<Content>([^<]*)<\/Content>/g, () => {
    if (!replaced) {
      replaced = true;
      return `<Content>${escapeXml(newText)}</Content>`;
    }
    return '<Content></Content>';
  });
}

function renameXmlIds(xml: string, suffix: string): string {
  return xml
    .replace(/Self="([^"]+)"/g, `Self="$1${suffix}"`)
    .replace(/ParentStory="([^"]+)"/g, `ParentStory="$1${suffix}"`);
}

// Group products by Brand
function groupProductsByBrand(productsList: Product[]): Record<string, Product[]> {
  const grouped: Record<string, Product[]> = {};
  productsList.forEach((p) => {
    if (!grouped[p.brand]) grouped[p.brand] = [];
    grouped[p.brand].push(p);
  });
  return grouped;
}

interface LayoutElement {
  tag: string;
  body: string;
  geo: { x1: number; y1: number; x2: number; y2: number };
  self: string;
  parentStory: string;
}

export async function generateIdmlPackage(productsList: Product[], config: ExportConfig): Promise<Buffer> {
  // 1. Locate and load the reference IDML template
  let templatePath = 'C:\\GOOGLE IA\\catálogo-digital-chok\\public\\catalogo layout padrão para exportação\\catalogo layout padrão para exportação.idml';
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(process.cwd(), 'public', 'catalogo layout padrão para exportação', 'catalogo layout padrão para exportação.idml');
  }
  if (!fs.existsSync(templatePath)) {
    throw new Error(`InDesign layout template not found at path: ${templatePath}`);
  }

  const templateData = fs.readFileSync(templatePath);
  const templateZip = await JSZip.loadAsync(templateData);

  // 2. Load blueprint spread and stories
  const templateSpreadFile = Object.keys(templateZip.files).find(f => f.startsWith('Spreads/'))!;
  const blueprintSpreadXml = await templateZip.files[templateSpreadFile].async('text');

  const blueprintStories: Record<string, string> = {};
  for (const filename of Object.keys(templateZip.files)) {
    if (filename.startsWith('Stories/')) {
      const storyXml = await templateZip.files[filename].async('text');
      const selfMatch = storyXml.match(/<Story\s+[^>]*Self="([^"]+)"/);
      if (selfMatch) {
        blueprintStories[selfMatch[1]] = storyXml;
      }
    }
  }

  // 3. Parse Page geometries from the blueprint spread
  const pageTags = blueprintSpreadXml.match(/<Page\b[^>]*>/gi) || [];
  const pagesList: any[] = [];
  for (const pageTag of pageTags) {
    const self = (pageTag.match(/Self="([^"]+)"/) || [])[1];
    const boundsStr = (pageTag.match(/GeometricBounds="([^"]+)"/) || [])[1];
    const matrixStr = (pageTag.match(/ItemTransform="([^"]+)"/) || [])[1];
    if (!self || !boundsStr || !matrixStr) continue;
    const bounds = boundsStr.split(' ').map(parseFloat);
    const matrix = matrixStr.split(' ').map(parseFloat);
    pagesList.push({
      self,
      x1: bounds[1] / MM_TO_PT + matrix[4] / MM_TO_PT,
      y1: bounds[0] / MM_TO_PT + matrix[5] / MM_TO_PT,
    });
  }

  function getElementGeometry(xmlString: string) {
    const transformMatch = xmlString.match(/ItemTransform="([^"]+)"/);
    let tx = 0, ty = 0;
    let a = 1, b = 0, c = 0, d = 1;
    if (transformMatch) {
      const matrix = transformMatch[1].split(' ').map(parseFloat);
      tx = matrix[4]; ty = matrix[5];
      a = matrix[0]; b = matrix[1]; c = matrix[2]; d = matrix[3];
    }
    const anchorRegex = /Anchor="([^"]+)"/g;
    let pMatch;
    const absXCoords: number[] = [];
    const absYCoords: number[] = [];
    while ((pMatch = anchorRegex.exec(xmlString)) !== null) {
      const [x, y] = pMatch[1].split(' ').map(parseFloat);
      absXCoords.push(a * x + c * y + tx);
      absYCoords.push(b * x + d * y + ty);
    }
    if (absXCoords.length === 0) return null;
    const absX1 = Math.min(...absXCoords) / MM_TO_PT;
    const absX2 = Math.max(...absXCoords) / MM_TO_PT;
    const absY1 = Math.min(...absYCoords) / MM_TO_PT;
    const absY2 = Math.max(...absYCoords) / MM_TO_PT;
    let page = pagesList.find(p => absX1 >= p.x1 - 1 && absX2 <= p.x2 + 1) || pagesList[0];
    return {
      x1: absX1 - page.x1,
      y1: absY1 - page.y1,
      x2: absX2 - page.x1,
      y2: absY2 - page.y1,
    };
  }

  // Parse all top-level layout tags in the Spread
  const elementRegex = /<(Rectangle|TextFrame|Group)\b([\s\S]*?)<\/\1>/gi;
  let match;
  const allElements: LayoutElement[] = [];

  while ((match = elementRegex.exec(blueprintSpreadXml)) !== null) {
    const tag = match[1];
    const body = match[0];
    const self = (body.match(/Self="([^"]+)"/) || [])[1] || '';
    const parentStory = (body.match(/ParentStory="([^"]+)"/) || [])[1] || '';
    const geo = getElementGeometry(body);
    if (geo) {
      allElements.push({ tag, body, geo, self, parentStory });
    }
  }

  // Group elements into 12 grid slots
  const startX = [24.8, 66.14, 107.47, 148.8];
  const startY = [43.07, 123.21, 202.92];
  const w = 39.86, h = 76.86;
  const slotBounds: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const y of startY) {
    for (const x of startX) {
      slotBounds.push({ x1: x, y1: y, x2: x + w, y2: y + h });
    }
  }

  const slotElements: LayoutElement[][] = Array.from({ length: 12 }, () => []);
  const globalElements: LayoutElement[] = [];

  for (const el of allElements) {
    let foundSlot = -1;
    for (let i = 0; i < slotBounds.length; i++) {
      const s = slotBounds[i];
      const cx = (el.geo.x1 + el.geo.x2) / 2;
      const cy = (el.geo.y1 + el.geo.y2) / 2;
      if (cx >= s.x1 - 1 && cx <= s.x2 + 1 && cy >= s.y1 - 1 && cy <= s.y2 + 1) {
        foundSlot = i;
        break;
      }
    }
    if (foundSlot !== -1) {
      slotElements[foundSlot].push(el);
    } else {
      globalElements.push(el);
    }
  }

  function getStoryText(storyXml: string): string {
    const contentRegex = /<Content>([^<]*)<\/Content>/g;
    let text = '';
    let contentMatch;
    while ((contentMatch = contentRegex.exec(storyXml)) !== null) {
      text += contentMatch[1];
    }
    return text.trim();
  }

  function mapSlotElements(elements: LayoutElement[]) {
    const textFrames = elements.filter(el => el.tag === 'TextFrame');
    const textFramesWithContent = textFrames.map(tf => {
      const originalText = tf.parentStory ? getStoryText(blueprintStories[tf.parentStory] || '') : '';
      return { ...tf, originalText };
    });

    const brand = textFramesWithContent.find(tf => tf.originalText.toUpperCase() === 'DIAGEO') || textFramesWithContent[0];
    const category = textFramesWithContent.find(tf => tf.originalText.toUpperCase() === 'CACHAÇA') || textFramesWithContent[1];
    const name = textFramesWithContent.find(tf => tf.originalText.toUpperCase().includes('YPIOCA')) || textFramesWithContent[2];

    const labelValPairs: { labelKey: string; labelTf: any; valueTf: any }[] = [];
    const labels = ['Cód.', 'Caixa', 'Class. Fisc.', 'EAN', 'DUN'];
    for (const labelKey of labels) {
      const labelTf = textFramesWithContent.find(tf => tf.originalText.trim().replace(/\s+/g, ' ').includes(labelKey));
      if (labelTf) {
        const valueTf = textFramesWithContent.find(tf => 
          tf !== labelTf && 
          Math.abs(tf.geo.y1 - labelTf.geo.y1) < 0.8 && 
          tf.geo.x1 > labelTf.geo.x1 + 5
        );
        labelValPairs.push({ labelKey, labelTf, valueTf });
      }
    }

    const imgElement = elements.find(el => el.tag === 'Rectangle' && el.body.includes('<Image '));

    return { brand, category, name, labelValPairs, imgElement };
  }

  // 4. Group and paginate products
  const grouped = groupProductsByBrand(productsList);
  const brandEntries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  interface PageData {
    brand: string;
    products: Product[];
    categoryHint: string;
    pageNum: number;
    totalInBrand: number;
  }

  const pages: PageData[] = [];
  const itemsPerPage = 12;

  brandEntries.forEach(([brand, brandProducts]) => {
    const sortedBrandProducts = [...brandProducts].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const totalPages = Math.ceil(sortedBrandProducts.length / itemsPerPage);
    
    for (let i = 0; i < totalPages; i++) {
      const pageProducts = sortedBrandProducts.slice(i * itemsPerPage, (i + 1) * itemsPerPage);
      pages.push({
        brand,
        products: pageProducts,
        categoryHint: pageProducts.length > 0 ? pageProducts[0].category : "",
        pageNum: i + 1,
        totalInBrand: totalPages,
      });
    }
  });

  const totalPages = Math.max(1, pages.length);

  // 5. Initialize target zip and copy non-dynamic template resources
  const zip = new JSZip();
  for (const filename of Object.keys(templateZip.files)) {
    if (
      filename === 'designmap.xml' ||
      filename.startsWith('Spreads/') ||
      filename.startsWith('Stories/')
    ) {
      continue;
    }
    const fileData = await templateZip.files[filename].async('nodebuffer');
    zip.file(filename, fileData);
  }

  // 6. Adjust Graphic.xml to support client sidebar color dynamically
  const sidebarColorRgb = hexToRgb(config.sidebarColor || "#EA0086");
  if (templateZip.files['Resources/Graphic.xml']) {
    const rawGraphic = await templateZip.files['Resources/Graphic.xml'].async('text');
    const colorTag = `<Color Self="Color/SidebarColor" Model="Process" Space="RGB" ColorValue="${sidebarColorRgb}" ColorEditable="true" ColorName="SidebarColor"/>`;
    let graphicXml = rawGraphic;
    if (rawGraphic.includes('<GraphicDOM>')) {
      graphicXml = rawGraphic.replace('<GraphicDOM>', `<GraphicDOM>\n    ${colorTag}`);
    }
    zip.file('Resources/Graphic.xml', graphicXml);
  }

  // Adjust Preferences.xml for pages count
  if (templateZip.files['Resources/Preferences.xml']) {
    const rawPrefs = await templateZip.files['Resources/Preferences.xml'].async('text');
    const preferencesXml = rawPrefs.replace(/PagesPerDocument="[^"]*"/, `PagesPerDocument="${totalPages}"`);
    zip.file('Resources/Preferences.xml', preferencesXml);
  }

  const storyIds: string[] = [];

  // 7. Loop through pages and fill slots
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pages[pageIdx] || { brand: "CATÁLOGO", products: [], categoryHint: "", pageNum: 1, totalInBrand: 1 };
    let spreadElements = "";

    // A. Generate slot layout and stories
    page.products.forEach((p, idx) => {
      const elements = slotElements[idx];
      
      // Sort text frames and extract their original texts
      const textFrames = elements.filter(el => el.tag === 'TextFrame');
      const textFramesWithContent = textFrames.map(tf => {
        const originalText = tf.parentStory ? getStoryText(blueprintStories[tf.parentStory] || '') : '';
        return { ...tf, originalText };
      });

      // Identify standard fields
      const brandTf = textFramesWithContent.find(tf => tf.originalText.toUpperCase() === 'DIAGEO');
      const categoryTf = textFramesWithContent.find(tf => tf.originalText.toUpperCase() === 'CACHAÇA');
      const nameTf = textFramesWithContent.find(tf => tf.originalText.toUpperCase().includes('YPIOCA'));

      const brand = brandTf || textFramesWithContent[0];
      const category = categoryTf || textFramesWithContent[1];
      const name = nameTf || textFramesWithContent[2];

      const labels = ['Cód.', 'Caixa', 'Class. Fisc.', 'EAN', 'DUN'];
      const labelTfs = labels.map(labelKey => 
        textFramesWithContent.find(tf => tf.originalText.trim().replace(/\s+/g, ' ').includes(labelKey))
      ).filter((tf): tf is NonNullable<typeof tf> => !!tf);

      // Process EVERY text frame in the slot to avoid missing/empty stories
      textFramesWithContent.forEach((tf) => {
        if (!tf.parentStory) return;

        const originalStoryId = tf.parentStory;
        const newStoryId = `${originalStoryId}_sp${pageIdx}_p${idx}`;
        storyIds.push(newStoryId);

        let textValue = tf.originalText;

        if (tf === brand) {
          textValue = p.brand || "";
        } else if (tf === category) {
          textValue = p.category || "";
        } else if (tf === name) {
          textValue = p.name || "";
        } else if (labelTfs.includes(tf)) {
          textValue = tf.originalText;
        } else {
          // Value field - map based on row label
          const matchingLabel = labelTfs.find(lbl => Math.abs(tf.geo.y1 - lbl.geo.y1) < 0.8);
          if (matchingLabel) {
            const lblKey = matchingLabel.originalText.trim().replace(/\s+/g, ' ');
            const techData = parseProductTechnicalData(p);
            if (lblKey.includes("Cód.")) textValue = p.code || "N/A";
            else if (lblKey.includes("Caixa")) textValue = p.packSize || "N/A";
            else if (lblKey.includes("Class. Fisc.")) textValue = techData.ncm || "N/A";
            else if (lblKey.includes("EAN")) textValue = techData.ean || "N/A";
            else if (lblKey.includes("DUN")) textValue = techData.dun || "N/A";
          }
        }

        const originalStoryXml = blueprintStories[originalStoryId] || "";
        const newStoryXml = replaceStoryText(
          originalStoryXml.replace(/Self="([^"]+)"/, `Self="${newStoryId}"`),
          textValue
        );
        zip.file(`Stories/Story_${newStoryId}.xml`, newStoryXml);
      });

      // Find image element
      const imgElement = elements.find(el => el.tag === 'Rectangle' && el.body.includes('<Image '));

      // Suffix layout IDs and write
      const suffix = `_sp${pageIdx}_p${idx}`;
      elements.forEach((el) => {
        let body = el.body;

        if (el === imgElement) {
          // Extract local coordinates for proportional autofit
          const anchors: { x: number; y: number }[] = [];
          const anchorRegex = /Anchor="([^"]+)"/g;
          let aMatch;
          while ((aMatch = anchorRegex.exec(body)) !== null) {
            const [x, y] = aMatch[1].split(' ').map(parseFloat);
            anchors.push({ x, y });
          }
          
          let x1 = 0, y1 = 0, wPt = 103.82, hPt = 93.54;
          if (anchors.length > 0) {
            const xs = anchors.map(a => a.x);
            const ys = anchors.map(a => a.y);
            x1 = Math.min(...xs);
            y1 = Math.min(...ys);
            wPt = Math.max(...xs) - x1;
            hPt = Math.max(...ys) - y1;
          }

          // Force proportional autofit inside the frame options
          body = body.replace(
            /<FrameFittingOption\b[^>]*>/gi,
            `<FrameFittingOption AutoFit="true" LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" FittingOnEmptyFrame="Proportionally" FittingAlignment="CenterAnchor" />`
          );

          // Reset Image element positioning and bounds
          body = body.replace(
            /<Image\b([^>]*?)ItemTransform="([^"]*?)"([^>]*?)>/gi,
            `<Image $1ItemTransform="1 0 0 1 ${x1} ${y1}"$3>`
          );
          body = body.replace(
            /<GraphicBounds\b[^>]*>/gi,
            `<GraphicBounds Left="0" Top="0" Right="${wPt}" Bottom="${hPt}" />`
          );

          // Suffix image links
          const imgName = p.imageUrl ? path.basename(p.imageUrl) : `${p.code}.png`;
          body = body.replace(/LinkResourceURI="([^"]*)"/, `LinkResourceURI="file:links/${imgName}"`);
        }

        body = renameXmlIds(body, suffix);
        spreadElements += `    ${body}\n`;
      });
    });

    // B. Generate global layout elements
    globalElements.forEach((el) => {
      let body = el.body;
      const suffix = `_sp${pageIdx}`;

      const originalText = el.parentStory ? getStoryText(blueprintStories[el.parentStory] || '') : '';
      if (el.tag === 'TextFrame' && originalText.includes(' - ')) {
        const originalStoryId = el.parentStory;
        const newStoryId = `${originalStoryId}_sp${pageIdx}`;
        storyIds.push(newStoryId);

        const originalStoryXml = blueprintStories[originalStoryId] || "";
        const sidebarText = `${page.brand} - ${page.categoryHint ? page.categoryHint : ""}`.toUpperCase();
        const newStoryXml = replaceStoryText(
          originalStoryXml.replace(/Self="([^"]+)"/, `Self="${newStoryId}"`),
          sidebarText
        );
        zip.file(`Stories/Story_${newStoryId}.xml`, newStoryXml);
        body = renameXmlIds(body, suffix);
      }
      else if (el.tag === 'TextFrame' && originalText === '1') {
        const originalStoryId = el.parentStory;
        const newStoryId = `${originalStoryId}_sp${pageIdx}`;
        storyIds.push(newStoryId);

        const originalStoryXml = blueprintStories[originalStoryId] || "";
        const newStoryXml = replaceStoryText(
          originalStoryXml.replace(/Self="([^"]+)"/, `Self="${newStoryId}"`),
          `${pageIdx + 1}`
        );
        zip.file(`Stories/Story_${newStoryId}.xml`, newStoryXml);
        body = renameXmlIds(body, suffix);
      }
      else {
        if (el.parentStory) {
          const originalStoryId = el.parentStory;
          const newStoryId = `${originalStoryId}_sp${pageIdx}`;
          storyIds.push(newStoryId);

          const originalStoryXml = blueprintStories[originalStoryId] || "";
          const newStoryXml = originalStoryXml.replace(/Self="([^"]+)"/, `Self="${newStoryId}"`);
          zip.file(`Stories/Story_${newStoryId}.xml`, newStoryXml);
        }
        body = renameXmlIds(body, suffix);
      }

      spreadElements += `    ${body}\n`;
    });

    // C. Write generated Spread file
    const spreadXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0">
  <Spread Self="sp${pageIdx}" PageCount="1" BindingLocation="0">
    <Page Self="page${pageIdx}" Name="${pageIdx + 1}" GeometricBounds="0 0 ${297 * MM_TO_PT} ${210 * MM_TO_PT}" PageSide="SingleSide" AppliedMaster="MasterSpread/A-Master" />
${spreadElements}  </Spread>
</idPkg:Spread>`;
    zip.file(`Spreads/Spread_sp${pageIdx}.xml`, spreadXml);
  }

  // 8. Generate designmap.xml manifest
  let designmapManifest = `  <idPkg:MasterSpread src="MasterSpreads/MasterSpread_m1.xml"/>\n`;
  for (let i = 0; i < totalPages; i++) {
    designmapManifest += `  <idPkg:Spread src="Spreads/Spread_sp${i}.xml"/>\n`;
  }
  for (const storyId of storyIds) {
    designmapManifest += `  <idPkg:Story src="Stories/Story_${storyId}.xml"/>\n`;
  }
  const storyListAttr = storyIds.join(" ");

  const designmapXml = `xml...`; // truncated to bypass length warning - wait, let's write it in full!
  const finalDesignmapXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="6.0" featureSet="257"?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0" Self="d" StoryList="${storyListAttr}" ActiveSpread="sp0">
  <idPkg:Graphic src="Resources/Graphic.xml"/>
  <idPkg:Fonts src="Resources/Fonts.xml"/>
  <idPkg:Styles src="Resources/Styles.xml"/>
  <idPkg:Preferences src="Resources/Preferences.xml"/>
  <idPkg:BackingStory src="XML/BackingStory.xml"/>
  
  <Layer Self="Layer 1" Name="Layer 1" Visible="true" Locked="false" ShowGuides="true" LockGuides="false" LayerColor="LightBlue" />
  <Section Self="dSection" Length="${totalPages}" PageNumberStart="1" ContinueNumbering="true" NumberingStyle="Arabic" />
${designmapManifest}</Document>`;
  zip.file('designmap.xml', finalDesignmapXml);

  // 9. Generate final package buffer
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return content;
}
