import type { Request, Response } from 'express';
import { products } from '../data/products';
import { generateIdmlPackage } from '../utils/idmlGenerator';
import { ExportConfig } from '../utils/exportConstants';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

/**
 * POST /api/export/idml
 * Expected body: { productIds: string[], config?: ExportConfig }
 * Returns: Binary zip package containing idml + links/ folder
 */
export async function idmlExportHandler(req: Request, res: Response) {
  try {
    const { productIds, config } = req.body as { productIds: string[]; config?: ExportConfig };
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds array is required' });
    }

    // Find and map selected product details
    const selectedProducts = productIds
      .map((id) => products.find((p) => p.code === id))
      .filter((p): p is typeof products[0] => !!p);

    const activeConfig: ExportConfig = {
      showBrand: true,
      showCategory: true,
      showName: true,
      showCode: true,
      showBox: true,
      showEan: true,
      sidebarColor: "#EA0086",
      ...config,
    };

    // 1. Generate the IDML file (internally uses "file:links/..." relative paths)
    const idmlBuffer = await generateIdmlPackage(selectedProducts, activeConfig);

    // 2. Create the outer package ZIP
    const outerZip = new JSZip();
    outerZip.file('catalogo.idml', idmlBuffer);

    const publicDir = path.join(process.cwd(), 'public');

    // 3. Add Logo to links/ folder
    const logoPath = path.join(publicDir, 'CHOK.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      outerZip.file('links/CHOK.png', logoBuffer);
    }

    // 4. Add product images to links/ folder
    selectedProducts.forEach((p) => {
      const imgRelativePath = p.imageUrl ? p.imageUrl : `/uploads/produtos/${p.code}.png`;
      const imgFullPath = path.join(publicDir, imgRelativePath);

      if (fs.existsSync(imgFullPath)) {
        const imgBuffer = fs.readFileSync(imgFullPath);
        const imgName = path.basename(imgFullPath);
        outerZip.file(`links/${imgName}`, imgBuffer);
      }
    });

    // 5. Add Document Fonts to auto-activate in InDesign
    try {
      const winFontsDir = path.join(process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows', 'Fonts');
      const arialRegularPath = path.join(winFontsDir, 'arial.ttf');
      const arialBoldPath = path.join(winFontsDir, 'arialbd.ttf');

      if (fs.existsSync(arialRegularPath)) {
        outerZip.file('Document Fonts/arial.ttf', fs.readFileSync(arialRegularPath));
      }
      if (fs.existsSync(arialBoldPath)) {
        outerZip.file('Document Fonts/arialbd.ttf', fs.readFileSync(arialBoldPath));
      }
    } catch (fontErr) {
      console.warn('Could not pack document fonts:', fontErr);
    }

    const finalZipBuffer = await outerZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="catalogo_pacote.zip"');
    return res.send(finalZipBuffer);
  } catch (e: any) {
    console.error('IDML export error:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
