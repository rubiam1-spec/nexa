import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 40 40">
  <polygon points="0,0 28,0 40,12 40,40 0,40" fill="#12110F" stroke="#2A2822" stroke-width="0.5"/>
  <rect x="8" y="10" width="4" height="20" rx="1" fill="#4ADE80"/>
  <rect x="15" y="10" width="4" height="20" rx="1" fill="#4ADE80" transform="rotate(20 17 20)"/>
  <rect x="24" y="16" width="4" height="14" rx="1" fill="#4ADE80"/>
</svg>`;

await sharp(Buffer.from(svg))
  .resize(120, 120)
  .png()
  .toFile('nexa-logo-email.png');

console.log('Logo PNG gerado: nexa-logo-email.png');
