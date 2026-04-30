import { useRef, useState } from "react";
import { useAuth } from "../../../app/contexts/AuthContext";
import { getUserRoleLabel } from "../../../shared/types/role";
import { updateProfile, sendPasswordResetEmail } from "../../../infra/repositories/profileSupabaseRepository";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";

const LABEL: React.CSSProperties = { fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" };
const INPUT: React.CSSProperties = { width: "100%", background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "10px 14px", color: "var(--color-chalk)", fontSize: 13 };
const INPUT_RO: React.CSSProperties = { ...INPUT, color: "var(--color-fog)", cursor: "not-allowed" };
const BTN: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 20px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const BTN_S: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 20px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };

export default function ProfilePage() {
  const { authenticatedProfile } = useAuth();
  const isMobile = useIsMobile();
  const profile = authenticatedProfile;

  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!profile) return <p style={{ color: "var(--color-fog)" }}>Carregando perfil...</p>;

  const initials = (profile.fullName || profile.email || "N")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleAvatarUpload(file: File) {
    if (!supabase || !profile) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Imagem muito grande. Máximo: 2MB.");
      return;
    }
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setErrorMsg("Formato não suportado. Use JPG, PNG ou WebP.");
      return;
    }
    setUploading(true);
    setErrorMsg(null);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const fileName = `avatars/${profile.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("logos").getPublicUrl(fileName);
      const url = data.publicUrl;
      await updateProfile(profile.id, { avatarUrl: url });
      setAvatarUrl(url);
      setSuccessMsg("Foto atualizada.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro no upload.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateProfile(profile.id, {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      });
      setSuccessMsg("Dados atualizados com sucesso.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!profile) return;
    setPasswordMsg(null);
    setErrorMsg(null);
    try {
      await sendPasswordResetEmail(profile.email);
      setPasswordMsg("Link de redefinição enviado para seu email.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao enviar email.");
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 26, fontWeight: 400, color: "var(--color-bone)", margin: "0 0 24px" }}>
        Meu Perfil
      </h1>

      {/* Avatar */}
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 20, flexWrap: "wrap" }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--color-stone)" }}
            />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "var(--color-sprout)", color: "var(--color-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 800,
            }}>
              {initials}
            </div>
          )}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", marginBottom: 4 }}>{profile.fullName}</div>
            <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 10 }}>{profile.email}</div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              style={BTN_S}
            >
              {uploading ? "Enviando..." : "Alterar foto"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAvatarUpload(f); e.target.value = ""; }}
            />
          </div>
        </div>
      </div>

      {/* Success/Error */}
      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)" }}>
          {successMsg}
        </div>
      ) : null}
      {errorMsg ? (
        <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#F87171" }}>
          {errorMsg}
        </div>
      ) : null}

      {/* Personal data */}
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Dados pessoais</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <label>
            <span style={LABEL}>Nome completo</span>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} style={INPUT} />
          </label>
          <label>
            <span style={LABEL}>E-mail</span>
            <input type="email" value={profile.email} readOnly style={INPUT_RO} />
          </label>
          <label>
            <span style={LABEL}>Telefone</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" style={INPUT} />
          </label>
          <label>
            <span style={LABEL}>Perfil</span>
            <div style={{ padding: "10px 0" }}>
              <span className="nexa-badge" style={{ color: "var(--color-blue)", background: "var(--color-blue-muted)" }}>
                {getUserRoleLabel(profile.role)}
              </span>
            </div>
          </label>
        </div>
        <button type="button" disabled={saving || !fullName.trim()} onClick={() => void handleSave()} style={BTN}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>

      {/* Security */}
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Segurança</div>
        <button type="button" onClick={() => void handlePasswordReset()} style={BTN_S}>
          Alterar senha
        </button>
        {passwordMsg ? (
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--color-sprout)" }}>{passwordMsg}</div>
        ) : null}
      </div>
    </div>
  );
}
