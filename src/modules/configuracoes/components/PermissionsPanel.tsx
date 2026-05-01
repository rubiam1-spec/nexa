import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useAccount } from "../../../app/contexts/AccountContext";
import {
  CATEGORY_LABELS,
  PERMISSION_CATEGORIES,
  PERMISSION_META,
  PERMISSION_PRESETS,
  diffFromPreset,
  diffFromBaseline,
  resolveAllPermissions,
  resolveBaselinePermissions,
  sanitizeOverrides,
  type PermissionCategory,
  type PermissionFlag,
  type PermissionOverrides,
  type RolePermissionOverrides,
} from "../../../shared/constants/permissionPresets";
import { getUserRoleLabel, normalizeUserRole } from "../../../shared/types/role";

// Ordem canonica dos roles na visao "Por categoria".
const ROLE_ORDER = [
  "owner",
  "director",
  "manager",
  "commercial_consultant",
  "broker",
  "administrative",
  "concierge",
] as const;

// Corretores sao equipe externa — nao aparecem na visao "Por membro" (ajuste
// individual). Fica apenas na visao "Por categoria".
const INTERNAL_MEMBER_ROLES = new Set<string>([
  "owner",
  "director",
  "manager",
  "commercial_consultant",
  "administrative",
  "concierge",
]);

const ROLE_BADGE_COLOR: Record<string, string> = {
  owner: "#4ADE80",
  director: "#4ADE80",
  manager: "#60A5FA",
  commercial_consultant: "#60A5FA",
  broker: "#D97706",
  administrative: "#A78BFA",
  concierge: "#9C9686",
};

interface Member {
  userId: string;
  role: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  overrides: PermissionOverrides | null;
}

interface ProfileRow {
  id?: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

type Tab = "category" | "member";

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  return getUserRoleLabel(normalizeUserRole(role)) ?? role;
}

interface PermissionsPanelProps {
  accountId: string | null;
  /** Se false, exibe mensagem de acesso restrito. */
  enabled: boolean;
}

export default function PermissionsPanel({ accountId, enabled }: PermissionsPanelProps) {
  const accountCtx = useAccount();
  const rolePermissionOverrides = accountCtx.rolePermissionOverrides;
  const [tab, setTab] = useState<Tab>("category");
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [brokerRegisteredCount, setBrokerRegisteredCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [savingFlag, setSavingFlag] = useState<PermissionFlag | null>(null);
  const [savingReset, setSavingReset] = useState<string | null>(null);

  const selectedMember = useMemo(
    () => members.find((m) => m.userId === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  // ── fetching members ──
  const fetchMembers = useCallback(async () => {
    if (!supabase || !accountId) return;
    setLoadingMembers(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from("user_account_access")
        .select(
          "user_id, role, permission_overrides, profiles!inner(id, name, full_name, email, avatar_url)",
        )
        .eq("account_id", accountId);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        user_id: string;
        role: string | null;
        permission_overrides: unknown;
        profiles: ProfileRow | ProfileRow[] | null;
      }>;
      const list: Member[] = rows
        .map((r) => {
          const p: ProfileRow | null = Array.isArray(r.profiles)
            ? (r.profiles[0] ?? null)
            : r.profiles;
          if (!p) return null;
          return {
            userId: r.user_id,
            role: r.role ?? "",
            fullName: p.full_name?.trim() || p.name?.trim() || p.email || "—",
            email: p.email ?? null,
            avatarUrl: p.avatar_url ?? null,
            overrides: sanitizeOverrides(r.permission_overrides),
          } satisfies Member;
        })
        .filter((m): m is Member => m !== null)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
      setMembers(list);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao carregar equipe.");
    } finally {
      setLoadingMembers(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!enabled) return;
    void fetchMembers();
  }, [enabled, fetchMembers]);

  // Corretores sao equipe externa: quase sempre ha muitos cadastrados na
  // tabela brokers sem login ativo. Exibimos a diferenca para evitar ambiguidade.
  useEffect(() => {
    if (!enabled || !supabase || !accountId) { setBrokerRegisteredCount(null); return; }
    let mounted = true;
    (async () => {
      try {
        const { count, error } = await supabase!
          .from("brokers")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId);
        if (!mounted) return;
        if (error) {
          setBrokerRegisteredCount(null);
          return;
        }
        setBrokerRegisteredCount(count ?? 0);
      } catch {
        if (mounted) setBrokerRegisteredCount(null);
      }
    })();
    return () => { mounted = false; };
  }, [enabled, accountId]);

  // Membros por role (para contagem na visao categoria).
  const membersByRole = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.role, (map.get(m.role) ?? 0) + 1));
    return map;
  }, [members]);

  // Membros visiveis na tab "Por membro".
  const internalMembers = useMemo(
    () => members.filter((m) => INTERNAL_MEMBER_ROLES.has(m.role)),
    [members],
  );

  function successFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2400);
  }

  // ── SAVE: role override ──
  async function persistRoleOverrides(next: RolePermissionOverrides | null) {
    if (!supabase || !accountId) return;
    const { error } = await supabase
      .from("account_settings")
      .upsert(
        {
          account_id: accountId,
          role_permission_overrides: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id" },
      );
    if (error) throw error;
    await accountCtx.reloadRolePermissionOverrides();
  }

  async function handleRoleToggle(role: string, flag: PermissionFlag, nextValue: boolean) {
    if (!PERMISSION_PRESETS[role]) return;
    setSavingFlag(flag);
    try {
      const current = rolePermissionOverrides?.[role] ?? null;
      const currentResolved = resolveBaselinePermissions(role, current);
      const desired: PermissionOverrides = { ...currentResolved, [flag]: nextValue };
      const diff = diffFromPreset(role, desired);
      const next: RolePermissionOverrides = { ...(rolePermissionOverrides ?? {}) };
      if (diff) next[role] = diff;
      else delete next[role];
      const cleaned = Object.keys(next).length > 0 ? (next as RolePermissionOverrides) : null;
      await persistRoleOverrides(cleaned);
      successFlash(
        diff
          ? "Override da categoria atualizado"
          : `Permissão restaurada ao padrão do perfil`,
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao salvar permissão.");
    } finally {
      setSavingFlag(null);
    }
  }

  async function handleResetRole(role: string) {
    if (!rolePermissionOverrides?.[role]) return;
    setSavingReset(`role:${role}`);
    try {
      const next: RolePermissionOverrides = { ...(rolePermissionOverrides ?? {}) };
      delete next[role];
      const cleaned = Object.keys(next).length > 0 ? (next as RolePermissionOverrides) : null;
      await persistRoleOverrides(cleaned);
      successFlash("Categoria restaurada ao padrão do sistema");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao restaurar categoria.");
    } finally {
      setSavingReset(null);
    }
  }

  // ── SAVE: individual override ──
  async function persistIndividualOverrides(userId: string, next: PermissionOverrides | null) {
    if (!supabase || !accountId) return;
    const { error } = await supabase
      .from("user_account_access")
      .update({ permission_overrides: next })
      .eq("user_id", userId)
      .eq("account_id", accountId);
    if (error) throw error;
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, overrides: next } : m)),
    );
  }

  async function handleMemberToggle(
    member: Member,
    flag: PermissionFlag,
    nextValue: boolean,
  ) {
    setSavingFlag(flag);
    try {
      const roleOv = rolePermissionOverrides?.[member.role] ?? null;
      const effective = resolveAllPermissions(member.role, member.overrides, roleOv);
      const desired: PermissionOverrides = { ...effective, [flag]: nextValue };
      const diff = diffFromBaseline(member.role, roleOv, desired);
      await persistIndividualOverrides(member.userId, diff);
      successFlash(diff ? "Override individual atualizado" : "Voltou ao padrão da categoria");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao salvar permissão.");
    } finally {
      setSavingFlag(null);
    }
  }

  async function handleResetMember(member: Member) {
    if (!member.overrides) return;
    setSavingReset(`member:${member.userId}`);
    try {
      await persistIndividualOverrides(member.userId, null);
      successFlash("Permissões individuais restauradas");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao restaurar permissões.");
    } finally {
      setSavingReset(null);
    }
  }

  if (!enabled) {
    return (
      <div style={{ padding: 24, color: "var(--color-fog)", fontSize: 13 }}>
        Acesso restrito a owner/director.
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--color-sprout)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          Permissões
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>
          Equipe · permissões
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-fog)", margin: "6px 0 0", lineHeight: 1.5 }}>
          Ajuste por <strong>categoria</strong> quando a mudança deve valer para todos os usuários de um perfil. Use <strong>por membro</strong> para abrir exceções individuais — o override individual prevalece sobre a categoria e sobre o preset do sistema.
        </p>
      </div>

      <Tabs value={tab} onChange={setTab} />

      {errorMessage ? (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171", fontSize: 12 }}>
          {errorMessage}
        </div>
      ) : null}
      {flash ? (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", color: "var(--color-sprout)", fontSize: 12 }}>
          {flash}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {tab === "category" ? (
          <CategoryView
            rolePermissionOverrides={rolePermissionOverrides}
            membersByRole={membersByRole}
            brokerRegisteredCount={brokerRegisteredCount}
            selectedRole={selectedRole}
            onSelectRole={setSelectedRole}
            onToggle={handleRoleToggle}
            onResetRole={handleResetRole}
            savingFlag={savingFlag}
            resettingRole={savingReset?.startsWith("role:") ? savingReset.slice(5) : null}
          />
        ) : (
          <MemberView
            members={internalMembers}
            loading={loadingMembers}
            rolePermissionOverrides={rolePermissionOverrides}
            selectedMember={selectedMember}
            onSelect={setSelectedMemberId}
            onToggle={handleMemberToggle}
            onResetMember={handleResetMember}
            savingFlag={savingFlag}
            resettingMemberId={savingReset?.startsWith("member:") ? savingReset.slice(7) : null}
          />
        )}
      </div>
    </div>
  );
}

// ── UI: Tabs ──

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const items: Array<{ key: Tab; label: string }> = [
    { key: "category", label: "Por categoria" },
    { key: "member", label: "Por membro" },
  ];
  return (
    <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--surface-overlay)", borderRadius: 10 }}>
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            style={{
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: active ? "var(--color-sprout-muted)" : "transparent",
              color: active ? "var(--color-sprout)" : "var(--color-fog)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ── View: por categoria ──

function CategoryView({
  rolePermissionOverrides,
  membersByRole,
  brokerRegisteredCount,
  selectedRole,
  onSelectRole,
  onToggle,
  onResetRole,
  savingFlag,
  resettingRole,
}: {
  rolePermissionOverrides: RolePermissionOverrides | null;
  membersByRole: Map<string, number>;
  brokerRegisteredCount: number | null;
  selectedRole: string | null;
  onSelectRole: (role: string | null) => void;
  onToggle: (role: string, flag: PermissionFlag, next: boolean) => void;
  onResetRole: (role: string) => void;
  savingFlag: PermissionFlag | null;
  resettingRole: string | null;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 20, alignItems: "start" }}>
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-default)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Categorias de acesso
        </div>
        {ROLE_ORDER.map((role) => {
          const count = membersByRole.get(role) ?? 0;
          const overrides = rolePermissionOverrides?.[role];
          const overrideCount = overrides ? Object.keys(overrides).length : 0;
          const active = selectedRole === role;
          const color = ROLE_BADGE_COLOR[role] ?? "var(--color-fog)";
          return (
            <button
              key={role}
              type="button"
              onClick={() => onSelectRole(role)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 14px",
                background: active ? "rgba(74,222,128,0.06)" : "transparent",
                borderLeft: `3px solid ${active ? "var(--color-sprout)" : "transparent"}`,
                border: "none",
                borderBottom: "1px solid var(--border-default)",
                cursor: "pointer",
                textAlign: "left",
                minHeight: 64,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                  boxShadow: `0 0 8px ${color}33`,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)" }}>
                  {roleLabel(role)}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>
                  {role === "broker" && brokerRegisteredCount !== null
                    ? `${count} com acesso · ${brokerRegisteredCount} cadastrado${brokerRegisteredCount !== 1 ? "s" : ""}`
                    : `${count} membro${count !== 1 ? "s" : ""}`}
                  {overrideCount > 0 ? ` · ${overrideCount} customizad${overrideCount !== 1 ? "as" : "a"}` : ""}
                </div>
              </div>
              {overrideCount > 0 ? (
                <span
                  title={`${overrideCount} permissão${overrideCount > 1 ? "es" : ""} customizada${overrideCount > 1 ? "s" : ""}`}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#60A5FA",
                    background: "rgba(96,165,250,0.10)",
                    border: "1px solid rgba(96,165,250,0.25)",
                    borderRadius: 4,
                    padding: "2px 6px",
                    flexShrink: 0,
                  }}
                >
                  {overrideCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ minWidth: 0 }}>
        {!selectedRole ? (
          <EmptyPanel message="Selecione uma categoria para ajustar permissões de todos os membros desse perfil." />
        ) : (
          <RolePermissionsEditor
            role={selectedRole}
            roleOverrides={rolePermissionOverrides?.[selectedRole] ?? null}
            memberCount={membersByRole.get(selectedRole) ?? 0}
            brokerRegisteredCount={brokerRegisteredCount}
            onToggle={(flag, next) => onToggle(selectedRole, flag, next)}
            onReset={() => onResetRole(selectedRole)}
            savingFlag={savingFlag}
            resetting={resettingRole === selectedRole}
          />
        )}
      </div>
    </div>
  );
}

function RolePermissionsEditor({
  role,
  roleOverrides,
  memberCount,
  brokerRegisteredCount,
  onToggle,
  onReset,
  savingFlag,
  resetting,
}: {
  role: string;
  roleOverrides: PermissionOverrides | null;
  memberCount: number;
  brokerRegisteredCount: number | null;
  onToggle: (flag: PermissionFlag, next: boolean) => void;
  onReset: () => void;
  savingFlag: PermissionFlag | null;
  resetting: boolean;
}) {
  const preset = PERMISSION_PRESETS[role];
  const effective = useMemo(
    () => resolveBaselinePermissions(role, roleOverrides),
    [role, roleOverrides],
  );
  const overrideCount = roleOverrides ? Object.keys(roleOverrides).length : 0;
  const color = ROLE_BADGE_COLOR[role] ?? "var(--color-fog)";

  const grouped = useMemo(() => buildGroupedMeta(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "var(--surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${color}20`,
            color,
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {roleLabel(role).slice(0, 1).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-bone)" }}>
            {roleLabel(role)}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-fog)" }}>
            {role === "broker" && brokerRegisteredCount !== null
              ? `${memberCount} com acesso · ${brokerRegisteredCount} cadastrado${brokerRegisteredCount !== 1 ? "s" : ""}`
              : `${memberCount} membro${memberCount !== 1 ? "s" : ""}`}
            {" · "}
            {overrideCount > 0 ? `${overrideCount} customizad${overrideCount !== 1 ? "as" : "a"}` : "preset do sistema"}
          </div>
        </div>
        {overrideCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            disabled={resetting}
            style={resetButtonStyle(resetting)}
          >
            {resetting ? "Restaurando..." : "Restaurar padrão"}
          </button>
        ) : null}
      </div>

      {role === "broker" ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-disabled)", lineHeight: 1.5 }}>
          Estas permissões se aplicam apenas aos corretores com acesso ao sistema. Corretores cadastrados sem login não são afetados.
        </p>
      ) : null}

      {!preset ? (
        <InfoBanner text={`Nao existe preset para o perfil "${role}".`} color="#D97706" />
      ) : (
        PERMISSION_CATEGORIES.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          const meta = CATEGORY_LABELS[cat];
          return (
            <CategoryGroup key={cat} meta={meta} count={items.length}>
              {items.map((item, idx) => {
                const presetValue = preset[item.flag];
                const effectiveValue = effective[item.flag];
                const isOverride = !!roleOverrides && item.flag in roleOverrides;
                const saving = savingFlag === item.flag;
                return (
                  <FlagRow
                    key={item.flag}
                    label={item.label}
                    description={item.description}
                    badge={isOverride ? { text: "CATEGORIA", color: "#60A5FA" } : null}
                    footnote={
                      isOverride
                        ? `Preset do sistema: ${presetValue ? "ligado" : "desligado"}`
                        : null
                    }
                    toggleValue={effectiveValue}
                    toggleColor={isOverride ? "#60A5FA" : undefined}
                    disabled={saving}
                    onToggle={(next) => onToggle(item.flag, next)}
                    isLast={idx === items.length - 1}
                  />
                );
              })}
            </CategoryGroup>
          );
        })
      )}
    </div>
  );
}

// ── View: por membro ──

function MemberView({
  members,
  loading,
  rolePermissionOverrides,
  selectedMember,
  onSelect,
  onToggle,
  onResetMember,
  savingFlag,
  resettingMemberId,
}: {
  members: Member[];
  loading: boolean;
  rolePermissionOverrides: RolePermissionOverrides | null;
  selectedMember: Member | null;
  onSelect: (id: string | null) => void;
  onToggle: (member: Member, flag: PermissionFlag, next: boolean) => void;
  onResetMember: (member: Member) => void;
  savingFlag: PermissionFlag | null;
  resettingMemberId: string | null;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 20, alignItems: "start" }}>
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-default)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Equipe interna {members.length > 0 ? `(${members.length})` : ""}
        </div>
        {loading && members.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: "var(--color-fog)" }}>Carregando equipe...</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: "var(--color-fog)" }}>Nenhum membro interno nesta conta.</div>
        ) : (
          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            {members.map((m) => {
              const active = m.userId === selectedMember?.userId;
              const indivCount = m.overrides ? Object.keys(m.overrides).length : 0;
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => onSelect(m.userId)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: active ? "rgba(74,222,128,0.06)" : "transparent",
                    borderLeft: `3px solid ${active ? "var(--color-sprout)" : "transparent"}`,
                    border: "none",
                    borderBottom: "1px solid var(--border-default)",
                    cursor: "pointer",
                    textAlign: "left",
                    minHeight: 48,
                  }}
                >
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(74,222,128,0.12)", color: "var(--color-sprout)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {memberInitials(m.fullName)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.fullName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-fog)" }}>{roleLabel(m.role)}</div>
                  </div>
                  {indivCount > 0 ? (
                    <span
                      title={`${indivCount} permissão${indivCount > 1 ? "es" : ""} individual${indivCount > 1 ? "is" : ""}`}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-sprout)",
                        background: "rgba(74,222,128,0.10)",
                        border: "1px solid rgba(74,222,128,0.25)",
                        borderRadius: 4,
                        padding: "2px 6px",
                        flexShrink: 0,
                      }}
                    >
                      {indivCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        {!selectedMember ? (
          <EmptyPanel message="Selecione um membro interno para abrir exceções individuais. Corretores são ajustados apenas pela visão 'Por categoria'." />
        ) : (
          <MemberPermissionsEditor
            member={selectedMember}
            roleOverrides={rolePermissionOverrides?.[selectedMember.role] ?? null}
            onToggle={(flag, next) => onToggle(selectedMember, flag, next)}
            onReset={() => onResetMember(selectedMember)}
            savingFlag={savingFlag}
            resetting={resettingMemberId === selectedMember.userId}
          />
        )}
      </div>
    </div>
  );
}

function MemberPermissionsEditor({
  member,
  roleOverrides,
  onToggle,
  onReset,
  savingFlag,
  resetting,
}: {
  member: Member;
  roleOverrides: PermissionOverrides | null;
  onToggle: (flag: PermissionFlag, next: boolean) => void;
  onReset: () => void;
  savingFlag: PermissionFlag | null;
  resetting: boolean;
}) {
  const preset = PERMISSION_PRESETS[member.role];
  const baseline = useMemo(
    () => resolveBaselinePermissions(member.role, roleOverrides),
    [member.role, roleOverrides],
  );
  const effective = useMemo(
    () => resolveAllPermissions(member.role, member.overrides, roleOverrides),
    [member.role, member.overrides, roleOverrides],
  );
  const indivCount = member.overrides ? Object.keys(member.overrides).length : 0;
  const grouped = useMemo(() => buildGroupedMeta(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "var(--surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
        }}
      >
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(74,222,128,0.12)", color: "var(--color-sprout)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>
            {memberInitials(member.fullName)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-bone)" }}>{member.fullName}</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)" }}>
            {roleLabel(member.role)}
            {indivCount > 0 ? ` · ${indivCount} individual${indivCount !== 1 ? "is" : ""}` : " · herda da categoria"}
          </div>
        </div>
        {indivCount > 0 ? (
          <button type="button" onClick={onReset} disabled={resetting} style={resetButtonStyle(resetting)}>
            {resetting ? "Restaurando..." : "Restaurar individual"}
          </button>
        ) : null}
      </div>

      {!preset ? (
        <InfoBanner text={`Nao existe preset para o perfil "${member.role}".`} color="#D97706" />
      ) : (
        PERMISSION_CATEGORIES.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          const meta = CATEGORY_LABELS[cat];
          return (
            <CategoryGroup key={cat} meta={meta} count={items.length}>
              {items.map((item, idx) => {
                const presetValue = preset[item.flag];
                const baselineValue = baseline[item.flag];
                const effectiveValue = effective[item.flag];
                const isIndividual = !!member.overrides && item.flag in member.overrides;
                const isCategory = !isIndividual && baselineValue !== presetValue;
                const saving = savingFlag === item.flag;
                const badge = isIndividual
                  ? { text: "INDIVIDUAL", color: "var(--color-sprout)" }
                  : isCategory
                  ? { text: "CATEGORIA", color: "#60A5FA" }
                  : null;
                const footnote = isIndividual
                  ? `Categoria atual: ${baselineValue ? "ligado" : "desligado"}`
                  : isCategory
                  ? `Definido pela categoria ${roleLabel(member.role)}`
                  : null;
                return (
                  <FlagRow
                    key={item.flag}
                    label={item.label}
                    description={item.description}
                    badge={badge}
                    footnote={footnote}
                    toggleValue={effectiveValue}
                    toggleColor={isIndividual ? "var(--color-sprout)" : isCategory ? "#60A5FA" : undefined}
                    disabled={saving}
                    onToggle={(next) => onToggle(item.flag, next)}
                    isLast={idx === items.length - 1}
                  />
                );
              })}
            </CategoryGroup>
          );
        })
      )}
    </div>
  );
}

// ── Atoms ──

function CategoryGroup({
  meta,
  count,
  children,
}: {
  meta: { label: string; color: string };
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-default)",
          background: `${meta.color}12`,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
            color: meta.color,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {meta.label}
        </span>
        <span style={{ fontSize: 10, color: "var(--color-fog)" }}>{count}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function FlagRow({
  label,
  description,
  badge,
  footnote,
  toggleValue,
  toggleColor,
  disabled,
  onToggle,
  isLast,
}: {
  label: string;
  description: string;
  badge: { text: string; color: string } | null;
  footnote: string | null;
  toggleValue: boolean;
  toggleColor?: string;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderBottom: isLast ? "none" : "1px solid var(--border-default)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)" }}>{label}</span>
          {badge ? (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 700,
                color: badge.color,
                background: `${badge.color}1a`,
                border: `1px solid ${badge.color}4d`,
                borderRadius: 4,
                padding: "1px 6px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {badge.text}
            </span>
          ) : null}
        </div>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-fog)", lineHeight: 1.4 }}>
          {description}
        </p>
        {footnote ? (
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--text-disabled)", letterSpacing: "0.02em" }}>
            {footnote}
          </p>
        ) : null}
      </div>
      <Toggle
        value={toggleValue}
        onChange={onToggle}
        disabled={disabled}
        highlightColor={toggleColor}
      />
    </div>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
  highlightColor,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  highlightColor?: string;
}) {
  const onBg = "var(--color-sprout)";
  const offBg = "var(--border-strong)";
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: value ? onBg : offBg,
        border: highlightColor ? `1.5px solid ${highlightColor}` : "1px solid transparent",
        position: "relative",
        cursor: disabled ? "wait" : "pointer",
        transition: "background 0.2s ease",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 1,
          left: value ? 20 : 2,
          transition: "left 0.2s ease",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 24,
        background: "var(--surface-raised)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        color: "var(--color-fog)",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {message}
    </div>
  );
}

function InfoBanner({ text, color }: { text: string; color: string }) {
  return (
    <div
      style={{
        padding: 16,
        background: `${color}14`,
        border: `1px solid ${color}4d`,
        borderRadius: 10,
        color,
        fontSize: 12,
      }}
    >
      {text}
    </div>
  );
}

function resetButtonStyle(disabled: boolean | undefined): CSSProperties {
  return {
    border: "1px solid var(--border-default)",
    background: "transparent",
    color: "var(--color-bone)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "wait" : "pointer",
  };
}

function buildGroupedMeta() {
  const map = new Map<PermissionCategory, typeof PERMISSION_META>();
  PERMISSION_CATEGORIES.forEach((c) => map.set(c, []));
  PERMISSION_META.forEach((m) => {
    const arr = map.get(m.category);
    if (arr) arr.push(m);
  });
  return map;
}
