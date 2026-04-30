import { useState } from 'react';
import { supabase } from '../../infra/supabase/supabaseClient';
import { logSensitiveAccess } from '../../lib/security';

interface SensitiveFieldProps {
  label: string;
  maskedValue: string;
  fullValue: string;
  entityType: 'client' | 'broker';
  entityId: string;
  field: 'cpf' | 'rg' | 'renda_mensal' | 'conjuge_cpf' | 'conjuge_rg' | 'email' | 'phone';
  canReveal?: boolean;
}

export default function SensitiveField({
  maskedValue, fullValue, entityType, entityId, field, canReveal = true,
}: SensitiveFieldProps) {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = async () => {
    if (!canReveal || !fullValue || !supabase) return;
    setRevealed(true);
    await logSensitiveAccess(supabase, entityType, entityId, field);
    setTimeout(() => setRevealed(false), 30000);
  };

  const displayValue = revealed ? fullValue : maskedValue;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        {displayValue || '—'}
      </span>
      {canReveal && fullValue && !revealed && (
        <button
          type="button"
          onClick={handleReveal}
          style={{
            background: 'transparent',
            border: '1px solid rgba(74,222,128,0.3)',
            borderRadius: 4,
            color: 'var(--interactive-primary)',
            fontSize: 11,
            padding: '2px 8px',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Ver
        </button>
      )}
      {revealed && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Ocultar
        </button>
      )}
    </div>
  );
}
