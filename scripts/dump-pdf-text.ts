import fs from 'node:fs';
import path from 'node:path';

const artifactDir = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\4923da1a-4a97-47ad-b222-c804420cf9c3';
const pdfPath = path.join(artifactDir, 'contrato-ficticio-definitivo-storage.pdf');
const buf = fs.readFileSync(pdfPath);
const str = buf.toString('latin1');

const lines: string[] = [];
const regex = /\((.*?)\)\s*Tj/g;
let m;
while ((m = regex.exec(str)) !== null) {
  lines.push(m[1]);
}
console.log('=== TOTAL DE BLOCOS DE TEXTO:', lines.length, '===');
for (let i = 0; i < lines.length; i++) {
  console.log(`[${i + 1}] ${lines[i]}`);
}

