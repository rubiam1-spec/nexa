// Documentos Temáveis v3 · carregamento de fontes por font_pair (offline-safe —
// ZERO rede em runtime; os TTF vivem embedados). 'nexa' = built-ins do jsPDF
// (helvetica/courier). 'bomm_editorial' = Newsreader/Geist/JetBrains Mono, TTF
// base64 importados LAZY. Falha no import → degrada para o par neutro + warn.
import type { jsPDF } from "jspdf";
import type { DocumentFontPair } from "./documentTheme";

export type DocumentFonts = { serif: string; sans: string; mono: string };

// Par neutro do sistema — built-ins, sempre disponíveis.
const NEXA_FONTS: DocumentFonts = { serif: "helvetica", sans: "helvetica", mono: "courier" };

export async function registerDocumentFonts(doc: jsPDF, pair: DocumentFontPair): Promise<DocumentFonts> {
  if (pair !== "bomm_editorial") return NEXA_FONTS;
  try {
    const f = await import("./fonts/bommEditorialFonts");
    const add = (b64: string, file: string, family: string, style: string) => {
      doc.addFileToVFS(file, b64);
      doc.addFont(file, family, style);
    };
    add(f.newsreaderRegular, "Newsreader-Regular.ttf", "Newsreader", "normal");
    add(f.newsreaderMedium, "Newsreader-Medium.ttf", "Newsreader", "bold");
    add(f.newsreaderItalic, "Newsreader-Italic.ttf", "Newsreader", "italic");
    add(f.geistRegular, "Geist-Regular.ttf", "Geist", "normal");
    add(f.geistMedium, "Geist-Medium.ttf", "Geist", "bold");
    add(f.jetBrainsMonoRegular, "JetBrainsMono-Regular.ttf", "JetBrainsMono", "normal");
    return { serif: "Newsreader", sans: "Geist", mono: "JetBrainsMono" };
  } catch (e) {
    console.warn("[docs-v3] fontes bomm_editorial indisponíveis — degradando para o par neutro.", e);
    return NEXA_FONTS;
  }
}
