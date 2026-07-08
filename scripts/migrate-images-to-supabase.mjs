/**
 * Migra as imagens legadas de public/uploads/produtos/ para o Supabase Storage.
 *
 * Fonte de verdade: linhas de products_v2 com "imageUrl" LIKE '/uploads/produtos/%'.
 * A key no bucket é normalizada para `<code>.<ext>` (mesma convenção de
 * supabaseService.uploadProductImage e do fallback do ProductCard).
 *
 * O script NÃO altera o banco — só sobe os arquivos e gera um relatório
 * (scratch/migration-report.json) usado depois para o UPDATE em products_v2
 * e para reescrever src/products.json.
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=... node scripts/migrate-images-to-supabase.mjs [--dry-run]
 *
 * Requer policy de INSERT no bucket product-images para o role anon
 * (temporária durante a migração) ou uma service role key.
 */
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "product-images";
const PREFIX = "/uploads/produtos/";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "produtos");
const REPORT_PATH = path.join(process.cwd(), "scratch", "migration-report.json");
const CONCURRENCY = 8;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente.");
  process.exit(1);
}

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

async function fetchLegacyRows() {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const url =
      `${SUPABASE_URL}/rest/v1/products_v2` +
      `?select=id,code,imageUrl` +
      `&imageUrl=like.${encodeURIComponent(PREFIX + "*")}` +
      `&order=id.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`Falha ao ler products_v2: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function uploadFile(localPath, key, contentType) {
  const body = fs.readFileSync(localPath);
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        authorization: `Bearer ${SUPABASE_KEY}`,
        "content-type": contentType,
        "cache-control": "max-age=3600",
        "x-upsert": "false",
      },
      body,
    }
  );
  if (res.ok) return "uploaded";
  const text = await res.text();
  // 409 = objeto já existe (re-execução) — considerar migrado.
  if (res.status === 409 || text.includes("Duplicate")) return "already-exists";
  throw new Error(`HTTP ${res.status}: ${text}`);
}

const rows = await fetchLegacyRows();
console.log(`${rows.length} produtos com imageUrl legado encontrados no banco.`);

const tasks = [];
const missing = [];
const skipped = [];

for (const row of rows) {
  const basename = row.imageUrl.slice(PREFIX.length);
  const ext = path.extname(basename).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    skipped.push({ ...row, reason: `extensão não suportada: ${ext}` });
    continue;
  }
  const localPath = path.join(UPLOAD_DIR, basename);
  if (!fs.existsSync(localPath)) {
    missing.push({ ...row, basename });
    continue;
  }
  const key = `${row.code}${ext}`;
  const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;
  tasks.push({ id: row.id, code: row.code, oldUrl: row.imageUrl, localPath, key, contentType, newUrl });
}

console.log(`${tasks.length} arquivos para subir | ${missing.length} sem arquivo local | ${skipped.length} ignorados`);

const uploaded = [];
const failed = [];

if (!DRY_RUN) {
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        const status = await uploadFile(task.localPath, task.key, task.contentType);
        uploaded.push({ ...task, status });
        if (uploaded.length % 50 === 0) console.log(`  ${uploaded.length}/${tasks.length} enviados...`);
      } catch (err) {
        failed.push({ ...task, error: String(err) });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
} else {
  console.log("(dry-run: nenhum upload feito)");
}

const report = {
  generatedAt: new Date().toISOString(),
  supabaseUrl: SUPABASE_URL,
  dryRun: DRY_RUN,
  totals: { rows: rows.length, planned: tasks.length, uploaded: uploaded.length, failed: failed.length, missing: missing.length, skipped: skipped.length },
  uploaded,
  failed,
  missing,
  skipped,
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`Relatório salvo em ${REPORT_PATH}`);
console.log(JSON.stringify(report.totals));
if (failed.length > 0) {
  console.error("ATENÇÃO: houve falhas de upload — ver relatório.");
  process.exit(2);
}
