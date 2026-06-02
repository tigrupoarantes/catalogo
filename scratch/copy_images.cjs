const fs = require('fs');
const path = require('path');

// Generated master images paths (Only non-Purina ones)
const masters = {
  dustgBox: `C:\\Users\\philipe.zirnberger\\.gemini\\antigravity-ide\\brain\\7b49d2e4-dc6a-4384-95fe-827e89eb3926\\master_dustg_box_1779904240080.png`,
  genioS: `C:\\Users\\philipe.zirnberger\\.gemini\\antigravity-ide\\brain\\7b49d2e4-dc6a-4384-95fe-827e89eb3926\\master_genio_s_1779904259211.png`,
  neo: `C:\\Users\\philipe.zirnberger\\.gemini\\antigravity-ide\\brain\\7b49d2e4-dc6a-4384-95fe-827e89eb3926\\master_neo_1779904279091.png`,
  chocotrio: `C:\\Users\\philipe.zirnberger\\.gemini\\antigravity-ide\\brain\\7b49d2e4-dc6a-4384-95fe-827e89eb3926\\master_chocotrio_1779904297047.png`,
  negresco: `C:\\Users\\philipe.zirnberger\\.gemini\\antigravity-ide\\brain\\7b49d2e4-dc6a-4384-95fe-827e89eb3926\\master_negresco_1779904315934.png`
};

const mappings = {
  // Dolce Gusto boxes
  "12519987": masters.dustgBox,
  "12519988": masters.dustgBox,
  "12520004": masters.dustgBox,

  // Dolce Gusto machines
  "12520229": masters.genioS,
  "12520236": masters.genioS,
  "12562153": masters.genioS,
  "12562154": masters.genioS,
  "12562164": masters.neo,

  // Chocotrio & Negresco
  "13389256": masters.chocotrio,
  "13528301": masters.negresco
};

const destDir = './public/uploads/produtos';

let count = 0;
for (const [code, srcPath] of Object.entries(mappings)) {
  const destPath = path.join(destDir, `${code}.png`);
  try {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied master to ${destPath}`);
    count++;
  } catch (err) {
    console.error(`Error copying ${srcPath} to ${destPath}:`, err.message);
  }
}

console.log(`\nSuccessfully mapped and copied ${count} images!`);
