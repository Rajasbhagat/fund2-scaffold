import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
// pdf-parse v2 uses PDFParse class with url constructor + getText()
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as { PDFParse: new (opts: { url: string }) => { load(): Promise<unknown>; getText(): Promise<{ pages: Array<{ text: string }> }> } };

const DOCS_DIR = path.join(__dirname, '..', 'Trend Mapper', 'MEGATRENDS Docs for TrendMapper');
const OUT_DIR = path.join(__dirname, '..', 'src', 'context');

const FILES = [
  'Deep Research Report ChaqtGPT.docx',
  'Global_Megatrends_Impact_Impulse_Matrix_2025-2050 (Claude).docx',
  'The Great Fragmentation GEMINI Deep Research.docx',
  'Spotting_Big_Trends_Megatrends_Handout.pdf',
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (let i = 0; i < FILES.length; i++) {
    const filename = FILES[i];
    const inputPath = path.join(DOCS_DIR, filename);
    const outputPath = path.join(OUT_DIR, `megatrend-${i + 1}.txt`);

    console.log(`Processing [${i + 1}]: ${filename}`);

    let text = '';
    if (filename.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ path: inputPath });
      text = result.value;
    } else if (filename.endsWith('.pdf')) {
      const parser = new PDFParse({ url: inputPath });
      await parser.load();
      const pageData = await parser.getText();
      text = pageData.pages.map((p) => p.text).join('\n\n');
    } else {
      console.warn(`Unknown file type: ${filename}`);
      continue;
    }

    fs.writeFileSync(outputPath, text, 'utf-8');
    console.log(`  -> Written: ${outputPath} (${text.length} chars)`);
  }

  console.log('\nDone. All megatrend docs extracted.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
