// generate-pdf-logos.mjs — Gera pdfLogos.ts a partir de PNGs pré-renderizados
// Os PNGs em public/ foram renderizados com rsvg-convert (alta qualidade)
// NÃO usar sharp para re-renderizar SVG — o sharp distorce o isotipo
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

let findResult = '';
try { findResult = execSync('find src -name "pdfLogos*" 2>/dev/null | head -1', { stdio: ['pipe','pipe','pipe'] }).toString().trim(); } catch {};
const targetPath = findResult || 'src/shared/utils/pdfLogos.ts';

const headerPath = 'public/nexa-pdf-header.png';
const footerPath = 'public/nexa-pdf-footer.png';

if (!existsSync(headerPath)) {
  console.error(`❌ Arquivo não encontrado: ${headerPath}`);
  console.error('Coloque nexa-pdf-header.png em public/');
  process.exit(1);
}
if (!existsSync(footerPath)) {
  console.error(`❌ Arquivo não encontrado: ${footerPath}`);
  console.error('Coloque nexa-pdf-footer.png em public/');
  process.exit(1);
}

const headerB64 = readFileSync(headerPath).toString('base64');
const footerB64 = readFileSync(footerPath).toString('base64');

console.log(`Header: ${headerPath} → ${headerB64.length} chars base64`);
console.log(`Footer: ${footerPath} → ${footerB64.length} chars base64`);

if (!headerB64.startsWith('iVBORw0KGgo')) {
  console.error('❌ Header não é PNG válido');
  process.exit(1);
}
if (!footerB64.startsWith('iVBORw0KGgo')) {
  console.error('❌ Footer não é PNG válido');
  process.exit(1);
}

const content = `// NEXA PDF Logos — gerado de PNGs pré-renderizados (rsvg-convert, alta qualidade)
// NÃO editar manualmente. Regenerar: node generate-pdf-logos.mjs
// Header: nexa-pdf-header.png (2460x540, corte 45 correto)
// Footer: nexa-pdf-footer.png (1020x180, cores para fundo claro)
// Gerado em: ${new Date().toISOString()}

export const NEXA_LOGO_HEADER = 'data:image/png;base64,${headerB64}';

export const NEXA_LOGO_FOOTER = 'data:image/png;base64,${footerB64}';
`;

writeFileSync(targetPath, content);
console.log(`✅ Escrito: ${targetPath}`);
console.log(`✅ Header: ${headerB64.length} chars`);
console.log(`✅ Footer: ${footerB64.length} chars`);
