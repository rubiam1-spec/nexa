import type { Participant } from "../../../shared/components/ParticipantInput";
import ParticipantAvatar from "../components/ParticipantAvatar";

// Seleção múltipla da equipe (chips com avatar). Grava em participants
// como participant_type='user'. Toque-primeiro, sem digitação.
export default function TeamMultiSelect({
  teamProfiles,
  participants,
  onChange,
}: {
  teamProfiles: { id: string; name: string }[];
  participants: Participant[];
  onChange: (next: Participant[]) => void;
}) {
  const selected = new Set(participants.filter((p) => p.type === "user" && p.id).map((p) => p.id as string));
  const toggle = (tp: { id: string; name: string }) => {
    if (selected.has(tp.id)) {
      onChange(participants.filter((p) => !(p.type === "user" && p.id === tp.id)));
    } else {
      onChange([...participants, { type: "user", id: tp.id, name: tp.name }]);
    }
  };
  const T = { stone: "var(--border-default)", bone: "var(--text-secondary)", purple: "#A78BFA" };

  if (teamProfiles.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--text-disabled)", fontStyle: "italic" }}>Sem equipe disponível</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {teamProfiles.map((tp) => {
        const on = selected.has(tp.id);
        return (
          <button
            key={tp.id}
            type="button"
            onClick={() => toggle(tp)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px 5px 5px",
              borderRadius: 18,
              minHeight: 36,
              border: `1px solid ${on ? T.purple : T.stone}`,
              background: on ? "rgba(167,139,250,0.16)" : "transparent",
              color: on ? T.purple : T.bone,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
          >
            <ParticipantAvatar name={tp.name} size={24} ring={on ? "rgba(167,139,250,0.16)" : "transparent"} />
            {tp.name.split(" ")[0]}
            {on && <span style={{ marginLeft: 2 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}
