import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

/**
 * POST /api/export/idml
 * Expected body: { productIds: string[] }
 * Returns: Binary stream file download
 */
export async function idmlExportHandler(req: Request, res: Response) {
  try {
    const { productIds } = req.body as { productIds: string[] };
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds array is required' });
    }

    const baseTemplatePath = path.resolve(process.cwd(), 'templates', 'base.idml');
    let buffer: Buffer;

    if (fs.existsSync(baseTemplatePath)) {
      buffer = fs.readFileSync(baseTemplatePath);
    } else {
      // If template missing, create a minimal placeholder content
      const idmlContent = `IDML placeholder\nProducts: ${productIds.join(', ')}`;
      buffer = Buffer.from(idmlContent, 'utf-8');
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="catalogo_export.idml"');
    return res.send(buffer);
  } catch (e: any) {
    console.error('IDML export error:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
