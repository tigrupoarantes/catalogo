/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import path from "path";
import multer from "multer";
import * as xlsx from "xlsx";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Set up Multer for Excel and Images upload
const storage = multer.memoryStorage(); // Keep files in memory temporarily
const upload = multer({ storage });

const extractFileToJSON = (file: Express.Multer.File) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext === '.md') {
    const mdString = file.buffer.toString('utf-8');
    const lines = mdString.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
    if (lines.length < 2) return [];
    
    const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
    const data = [];
    for (let i = 2; i < lines.length; i++) {
      // check if it is a separator line (e.g. |---|---|)
      if (lines[i].replace(/\|/g, '').replace(/-/g, '').replace(/:/g, '').trim() === '') continue;
      
      const rowRaw = lines[i].split('|').slice(1, -1).map(c => c.trim());
      const rowObj: any = {};
      headers.forEach((h, idx) => {
        rowObj[h] = rowRaw[idx] || "";
      });
      data.push(rowObj);
    }
    return data;
  }

  const workbook = xlsx.read(file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
};

// EAN uniqueness validation middleware
const validateUniqueEAN = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const files = (req as any).files;
    if (!files || !files.spreadsheet || files.spreadsheet.length === 0) {
      return next(); // Pass to main handler to deal with no spreadsheet
    }
    
    const file = files.spreadsheet[0];
    let rawData: any[] = [];
    try {
      rawData = extractFileToJSON(file);
    } catch(e) {
      console.warn("Could not parse file in validateUniqueEAN", e);
    }
    
    const eanSet = new Set<string>();
    const eanErrors: any[] = [];
    
    for (let i = 0; i < rawData.length; i++) {
        const row: any = rawData[i];
        let ean = String(row.ean || row.EAN || "");
        ean = ean.replace(/^0+/, ''); // strip leading zeros
        if (ean) {
           if (eanSet.has(ean)) {
              eanErrors.push({ row: i + 2, reason: "EAN duplicado encontrado na planilha", ean: ean });
           } else {
              eanSet.add(ean);
           }
        }
    }
    
    // Attach to request so we can report these later, or reject immediately
    (req as any).eanErrors = eanErrors;
    next();
  } catch (err: any) {
    console.error("Error in validateUniqueEAN:", err);
    return res.status(500).json({ status: "error", message: err.message || "Internal Validation Error" });
  }
};

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "public", "uploads", "produtos");
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Endpoint POST for single image
app.post(
  "/api/upload-image",
  upload.single("image"),
  async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: "error", message: "Nenhuma imagem enviada." });
      }

      const file = req.file;
      const ext = path.extname(file.originalname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const newImageName = `img-${uniqueSuffix}${ext}`;
      const destPath = path.join(uploadDir, newImageName);
      
      await fs.writeFile(destPath, file.buffer);
      const savedImagePath = `/uploads/produtos/${newImageName}`;

      return res.json({ status: "success", imageUrl: savedImagePath });
    } catch (error: any) {
      console.error("Upload image error:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
);

const extractCodeFromFilename = (filename: string): string => {
  // Remove file extension
  const nameWithoutExt = path.parse(filename).name;
  
  // Rule 1: Try splitting by ' - ' first (e.g. "418897 - TOSTINES Biscoito")
  if (nameWithoutExt.includes(" - ")) {
    return nameWithoutExt.split(" - ")[0].trim();
  }
  
  // Rule 2: Fallback to regex matching leading alphanumeric characters (e.g. "418897frente")
  const match = nameWithoutExt.match(/^([a-zA-Z0-9]+)/);
  if (match) {
    return match[1].trim();
  }
  
  return nameWithoutExt.trim();
};

// Endpoint POST
app.post(
  "/api/upload",
  upload.fields([
    { name: "spreadsheet", maxCount: 1 },
    { name: "images" },
  ]),
  validateUniqueEAN,
  async (req: any, res: any) => {
    try {
      const files = req.files as {
        spreadsheet?: Express.Multer.File[];
        images?: Express.Multer.File[];
      } || {};

      let productsList: any[] = [];
      const errors: any[] = req.eanErrors ? [...req.eanErrors] : [];
      const uploadedImages = files.images || [];

      const hasSpreadsheet = files.spreadsheet && files.spreadsheet.length > 0;

      if (hasSpreadsheet) {
        // Convert file (XLSX or MD) to JSON
        const rawData: any[] = extractFileToJSON(files.spreadsheet[0]);
        const eanSet = new Set<string>();

        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          
          // Flexible key mapping to handle various spreadsheet headers
          const codigo = String(row.codigo || row.CÓDIGO || row.code || "");
          let baseEan = String(row.ean || row.EAN || "");
          baseEan = baseEan.replace(/^0+/, ''); // strip leading zeros for uniqueness check
          const nome = String(row.nome || row.DESCRIÇÃO || row.name || "");
          const marca = String(row.marca || row.CATEGORIA || row.brand || "");
          const categoria = String(row.categoria || row['SUB CATEGORIA'] || row.category || "");
          const caixa = String(row.caixa || row.FATOR || row.packSize || "");
          const ncm = String(row.ncm || row['Classificação Fiscal'] || row['Classificação Fisc'] || row.NCM || "");
          const dunCode = String(row.dun || row.DUN || "");
          
          // Combine EAN, NCM, and DUN into the ean field: EAN|NCM|DUN
          const combinedEan = `${baseEan}|${ncm}|${dunCode}`;
          
          if (!codigo || !nome) {
             errors.push({ row: i + 2, reason: "Código ou Nome faltando", data: row });
             continue;
          }

          if (baseEan) {
             if (eanSet.has(baseEan)) {
                errors.push({ row: i + 2, reason: "EAN duplicado encontrado na planilha", data: row });
                continue; // Skip processing this duplicate product
             }
             eanSet.add(baseEan);
          }

          productsList.push({
             id: codigo,
             code: codigo,
             name: nome,
             brand: marca,
             category: categoria,
             packSize: caixa,
             ean: combinedEan,
             imageUrl: row.imageUrl || null
          });
        }
      } else if (req.body.existingProducts) {
        try {
          productsList = JSON.parse(req.body.existingProducts);
        } catch (e) {
          return res.status(400).json({ status: "error", message: "Lista de produtos existentes inválida." });
        }
      } else {
        return res.status(400).json({ status: "error", message: "Nenhum dado ou planilha foi enviado." });
      }

      // Matching Engine for Images
      const matchedCodes = new Set<string>();
      const unmatchedImages: string[] = [];
      const processedProducts = [...productsList];

      for (const img of uploadedImages) {
        const extractedCode = extractCodeFromFilename(img.originalname);
        
        // Find index of matching product (case-insensitive)
        const productIdx = processedProducts.findIndex(
          p => String(p.code).trim().toLowerCase() === extractedCode.toLowerCase()
        );

        if (productIdx !== -1) {
          const product = processedProducts[productIdx];
          const ext = path.extname(img.originalname).toLowerCase();
          const newImageName = `${product.code}${ext}`;
          const destPath = path.join(uploadDir, newImageName);
          
          await fs.writeFile(destPath, img.buffer);
          
          // Update imageUrl path
          processedProducts[productIdx] = {
            ...product,
            imageUrl: `/uploads/produtos/${newImageName}`
          };
          matchedCodes.add(product.code);
        } else {
          unmatchedImages.push(img.originalname);
        }
      }

      return res.json({
         status: "success",
         processedCount: hasSpreadsheet ? processedProducts.length : matchedCodes.size,
         matchedCount: matchedCodes.size,
         unmatchedCount: unmatchedImages.length,
         unmatchedImages: unmatchedImages,
         errorCount: errors.length,
         errors: errors,
         products: processedProducts
      });

    } catch (error: any) {
      console.error("Upload error:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
);


// Global error handler for API routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api/')) {
    console.error("Global API Error:", err);
    res.status(500).json({ status: "error", message: err.message || "Internal Server Error" });
  } else {
    next(err);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
