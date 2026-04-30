// ============================================================
// NEXA — Utilitários de segurança e mascaramento de dados
// ============================================================

/**
 * Mascara CPF mostrando apenas últimos 2 dígitos
 * "12345678900" → "***.***.***-00"
 * "123.456.789-00" → "***.***.***-00"
 */
export function secureMaskCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length < 2) return '***';
  const last2 = clean.slice(-2);
  return `***.***.***-${last2}`;
}

/**
 * Mascara RG mostrando apenas últimos 4 caracteres
 * "1234567890" → "******7890"
 */
export function secureMaskRG(rg: string | null | undefined): string {
  if (!rg) return '';
  if (rg.length <= 4) return rg;
  return '*'.repeat(rg.length - 4) + rg.slice(-4);
}

/**
 * Mascara renda mensal em faixas
 */
export function secureMaskRenda(valor: number | null | undefined): string {
  if (!valor || valor <= 0) return '';
  if (valor < 3000) return 'Até R$ 3.000';
  if (valor < 5000) return 'R$ 3.000 — R$ 5.000';
  if (valor < 10000) return 'R$ 5.000 — R$ 10.000';
  if (valor < 20000) return 'R$ 10.000 — R$ 20.000';
  if (valor < 50000) return 'R$ 20.000 — R$ 50.000';
  return 'Acima de R$ 50.000';
}

/**
 * Mascara email mostrando apenas primeira letra + domínio
 * "rubiam@gmail.com" → "r***@gmail.com"
 */
export function secureMaskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 1) return `${user}***@${domain}`;
  return `${user[0]}***@${domain}`;
}

/**
 * Mascara telefone mostrando apenas últimos 4 dígitos
 * "(45) 99999-1234" → "••••••-1234"
 */
export function secureMaskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 4) return phone;
  const last4 = clean.slice(-4);
  return `••••••-${last4}`;
}

/**
 * Registra acesso a dado sensível no banco via RPC
 */
export async function logSensitiveAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { rpc: (fn: string, params: Record<string, string>) => any },
  entityType: 'client' | 'broker',
  entityId: string,
  field: 'cpf' | 'rg' | 'renda_mensal' | 'conjuge_cpf' | 'conjuge_rg' | 'email' | 'phone',
  accessType: 'view' | 'export' | 'pdf' = 'view',
): Promise<void> {
  try {
    await supabase.rpc('log_sensitive_access', {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_field: field,
      p_access_type: accessType,
    });
  } catch (e) {
    console.warn('Failed to log sensitive access:', e);
  }
}
