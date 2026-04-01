import { useRef, useState } from "react";

interface PhotoFile { file: File; preview: string }

function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error("Blob creation failed")); }, "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export { compressImage };

export default function PhotoUpload({ photos, onChange, maxPhotos = 5 }: { photos: PhotoFile[]; onChange: (p: PhotoFile[]) => void; maxPhotos?: number }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    const newPhotos: PhotoFile[] = [];
    const remaining = maxPhotos - photos.length;
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const compressed = await compressImage(file, 1200, 0.8);
        const compressedFile = new File([compressed], file.name, { type: "image/jpeg" });
        newPhotos.push({ file: compressedFile, preview: URL.createObjectURL(compressed) });
      } catch { newPhotos.push({ file, preview: URL.createObjectURL(file) }); }
    }
    onChange([...photos, ...newPhotos]);
    setUploading(false);
  }

  function remove(idx: number) {
    URL.revokeObjectURL(photos[idx].preview);
    onChange(photos.filter((_, i) => i !== idx));
  }

  const canAdd = photos.length < maxPhotos;

  return (
    <div>
      {/* Buttons */}
      {canAdd && (
        <div style={{ display: "flex", gap: 8, marginBottom: photos.length > 0 ? 10 : 0 }}>
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={uploading} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--surface-base)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            📷 {uploading ? "Processando..." : "Tirar foto"}
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} disabled={uploading} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--surface-base)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            🖼 Galeria
          </button>
        </div>
      )}
      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
      {/* Previews */}
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative", width: 80, height: 80, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-default)" }}>
              <img src={p.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button type="button" onClick={() => remove(i)} style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
