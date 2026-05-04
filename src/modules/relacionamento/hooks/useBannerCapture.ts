import { useCallback, useState } from "react";
import type { RefObject } from "react";
import html2canvas from "html2canvas";

type CaptureOptions = {
  ref: RefObject<HTMLElement | null>;
  filename: string;
  targetSize?: number;
  backgroundColor?: string;
};

type CaptureResult = {
  capture: () => Promise<void>;
  copy: () => Promise<void>;
  isCapturing: boolean;
  error: string | null;
};

async function waitForImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : img.decode().catch(() => null),
    ),
  );
}

async function renderCanvas(
  el: HTMLElement,
  targetSize: number,
  backgroundColor: string,
): Promise<HTMLCanvasElement> {
  await waitForImages(el);
  const baseWidth = el.offsetWidth || targetSize;
  const scale = targetSize / baseWidth;
  return html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor,
    logging: false,
    imageTimeout: 15000,
    allowTaint: false,
  });
}

export function useBannerCapture(options: CaptureOptions): CaptureResult {
  const { ref, filename, targetSize = 1500, backgroundColor = "#FFFFFF" } = options;
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    setIsCapturing(true);
    setError(null);
    try {
      const canvas = await renderCanvas(el, targetSize, backgroundColor);
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falha ao gerar PNG"));
              return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filename}.png`;
            link.type = "image/png";
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            resolve();
          },
          "image/png",
        );
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao capturar banner";
      console.error("[useBannerCapture]", e);
      setError(msg);
    } finally {
      setIsCapturing(false);
    }
  }, [ref, filename, targetSize, backgroundColor]);

  const copy = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    setIsCapturing(true);
    setError(null);
    try {
      const canvas = await renderCanvas(el, targetSize, backgroundColor);
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error("Falha ao gerar PNG"));
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error("Falha ao copiar"));
          }
        }, "image/png");
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao copiar banner";
      console.error("[useBannerCapture]", e);
      setError(msg);
    } finally {
      setIsCapturing(false);
    }
  }, [ref, targetSize, backgroundColor]);

  return { capture, copy, isCapturing, error };
}
