// ── Máscaras (formatam enquanto digita) ──

export const maskCPF = (v: string): string => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export const maskCNPJ = (v: string): string => v.replace(/\D/g, "").slice(0, 14).replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");

export const maskPhone = (v: string): string => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 10) return n.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return n.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

export const maskCEP = (v: string): string => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

export const maskRG = (v: string): string => v.replace(/[^0-9.\-]/g, "").slice(0, 15);

export const maskCurrency = (v: string): string => { const n = Number(v.replace(/\D/g, "")) / 100; return n > 0 ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""; };

export const currencyToNumber = (v: string): number => Number(v.replace(/\D/g, "")) / 100;

export const maskCRECI = (v: string): string => v.replace(/[^0-9a-zA-Z/\-]/g, "").slice(0, 12);

export const maskNumero = (v: string): string => v.replace(/[^0-9a-zA-Z/\s]/g, "").slice(0, 10);

// ── Filtros (restringem caracteres) ──

export const filterName = (v: string): string => v.replace(/[^a-zA-ZÀ-ÿ\s'.\-]/g, "");

export const filterNumbers = (v: string): string => v.replace(/\D/g, "");

// ── Validações ──

export const validateEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const validateCPF = (cpf: string): boolean => {
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += parseInt(n[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0; if (r !== parseInt(n[9])) return false;
  s = 0; for (let i = 0; i < 10; i++) s += parseInt(n[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0; return r === parseInt(n[10]);
};

export const validateCNPJ = (cnpj: string): boolean => {
  const n = cnpj.replace(/\D/g, "");
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let s = 0; for (let i = 0; i < 12; i++) s += parseInt(n[i]) * w1[i];
  let r = s % 11; r = r < 2 ? 0 : 11 - r; if (r !== parseInt(n[12])) return false;
  s = 0; for (let i = 0; i < 13; i++) s += parseInt(n[i]) * w2[i];
  r = s % 11; r = r < 2 ? 0 : 11 - r; return r === parseInt(n[13]);
};

// ── Formatadores de display ──

export const formatCPF = (v: string | null): string => v ? maskCPF(v.replace(/\D/g, "")) : "—";
export const formatCNPJ = (v: string | null): string => v ? maskCNPJ(v.replace(/\D/g, "")) : "—";
export const formatPhone = (v: string | null): string => v ? maskPhone(v.replace(/\D/g, "")) : "—";
export const formatCEP = (v: string | null): string => v ? maskCEP(v.replace(/\D/g, "")) : "—";
export const formatCurrency = (v: number | null): string => v != null ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

// ── UF Options ──

export const UF_OPTIONS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"] as const;
