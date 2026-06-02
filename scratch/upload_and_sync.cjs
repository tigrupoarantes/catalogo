const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || "https://imvrwcaxsapqhogjkalt.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const userListRaw = `12028625	NESCAFE DOPCAFE Forte 6x(20x50g) BR	NESCAFE SOLUVEL + T&M	SACHETS
12519987	NESCAFE DUSTG Espresso Intenso 3(16 caps)	SISTEMA DOLCE GUSTO	ESPRESSO
12519988	NESCAFE DUSTG Espresso Decaf 3(16 caps)	SISTEMA DOLCE GUSTO	ESPRESSO
12520004	NESCAFE DUSTG Ristretto Ardent 3(16caps)	SISTEMA DOLCE GUSTO	ESPRESSO
12520229	NESCAFE DUSTG Genio S Touch MqCinza 1x1	SISTEMA DOLCE GUSTO	MAQUINAS E ACESSORIOS G1
12520236	NESCAFE DUSTG Genio S Basic MqPreta 1x1	SISTEMA DOLCE GUSTO	MAQUINAS E ACESSORIOS G1
12534547	CARNATION Leite Evaporado Uht 12x410gBR	LEITES CULINARIOS	LEITE EVAPORADO
12535260	NESCAFE DUSTG Mochaccino 3(16 caps)	SISTEMA DOLCE GUSTO	ESPRESSO
12562153	NESCAFE DUSTG Genio S Plus MqPreta 1x1	SISTEMA DOLCE GUSTO	MAQUINAS E ACESSORIOS G1
12562154	NESCAFE DUSTG Genio S Plus MqVerm 1x1	SISTEMA DOLCE GUSTO	MAQUINAS E ACESSORIOS G1
12562164	NESCAFE DUSTG Neo MqBranca 1x1	SISTEMA DOLCE GUSTO	MAQUINAS E ACESSORIOS G1
13389256	NESTLE Chocotrio aoLeite ST 4(12x90g) BR	CHOCOLATES NESTLE	NESTLE CHOCOTRIO
13528301	NEGRESCO Biscoito Rech Mrg 66x90g N1 BR	BISCOITOS	BISCOITOS RECHEADOS NEGRESCO`;

const lines = userListRaw.split('\n').filter(l => l.trim().length > 0);
const codes = lines.map(line => line.split('\t')[0].trim());

const uploadDir = './public/uploads/produtos';

async function run() {
  console.log(`Starting upload and sync of ${codes.length} products to Supabase...`);
  
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const fileName = `${code}.png`;
    const localFilePath = path.join(uploadDir, fileName);
    
    if (!fs.existsSync(localFilePath)) {
      console.warn(`[${i+1}/${codes.length}] Warning: ${localFilePath} does not exist. Skipping.`);
      continue;
    }
    
    const buffer = fs.readFileSync(localFilePath);
    const storagePath = `${code}.png`;
    
    console.log(`[${i+1}/${codes.length}] Uploading ${fileName} to storage...`);
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: 'image/png',
        cacheControl: '3600'
      });
      
    if (uploadError) {
      console.error(`Error uploading ${fileName}:`, uploadError.message);
      continue;
    }
    
    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath);
      
    const publicUrl = publicUrlData.publicUrl;
    console.log(`Public URL: ${publicUrl}`);
    
    console.log(`Updating database for product ${code}...`);
    const { error: dbError } = await supabase
      .from('products_v2')
      .update({ imageUrl: publicUrl })
      .eq('code', code);
      
    if (dbError) {
      console.error(`Error updating DB for code ${code}:`, dbError.message);
    } else {
      console.log(`Successfully updated database for product ${code}!`);
    }
    
    // Add a tiny delay to avoid hitting rate limits
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log("\nFinished uploading and database synchronization!");
}

run();
