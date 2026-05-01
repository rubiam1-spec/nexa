import { useState, useEffect, useCallback } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import Avatar from "../../../shared/components/Avatar";

const T = {
  ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)",
  chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)",
  slate: "var(--text-disabled)", sprout: "var(--interactive-primary)",
};

const TYPE_LABELS: Record<string, string> = { visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.", training: "Treinamento", phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião interna", meeting_external: "Reunião externa", other: "Outro" };
const REACTIONS = [
  { type: "like", emoji: "👍", label: "Curtir" },
  { type: "fire", emoji: "🔥", label: "Incrível" },
  { type: "strong", emoji: "💪", label: "Mandou bem" },
  { type: "celebrate", emoji: "🎉", label: "Parabéns" },
];

interface FeedPost {
  id: string; type: string; title: string; activity_date: string; description: string | null;
  contact_name: string | null; outcome: string | null;
  profile_name: string; profile_role: string; profile_avatar: string | null; profile_id: string; created_at: string;
  photos: { id: string; photo_url: string; storage_path: string; caption: string | null }[];
  reactions: { user_id: string; reaction_type: string }[];
  comments: { id: string; user_id: string; user_name: string; user_avatar: string | null; content: string; created_at: string }[];
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000); if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60); if (h < 24) return `há ${h}h`;
  const dd = Math.floor(h / 24); return `há ${dd}d`;
}

const ROLE_LABELS: Record<string, string> = { owner: "Diretor", director: "Diretor", manager: "Gestor", commercial_consultant: "Consultora", broker: "Corretor", administrative: "Administrativo" };

export default function FeedPage() {
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;
  const userId = authenticatedProfile?.id ?? null;

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);

  const loadFeed = useCallback(async () => {
    if (!supabase || !accountId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Get activities that have photos
      const { data: photosRaw } = await supabase.from("activity_photos").select("activity_id, id, photo_url, storage_path, caption").order("created_at", { ascending: true });
      if (!photosRaw || photosRaw.length === 0) { setPosts([]); setLoading(false); return; }

      const activityIds = [...new Set((photosRaw as Record<string, unknown>[]).map((p) => p.activity_id as string))];

      const { data: actsRaw } = await supabase.from("activities").select("id, type, title, activity_date, description, contact_name, outcome, created_at, profile_id, profiles!activities_profile_id_fkey(name, role, avatar_url)").eq("account_id", accountId).in("id", activityIds).order("created_at", { ascending: false }).limit(30);

      // Get reactions and comments
      const { data: reactionsRaw } = await supabase.from("feed_reactions").select("activity_id, user_id, reaction_type").in("activity_id", activityIds);
      const { data: commentsRaw } = await supabase.from("feed_comments").select("id, activity_id, user_id, content, created_at, profiles:user_id(name, avatar_url)").in("activity_id", activityIds).order("created_at", { ascending: true });

      // Group photos by activity
      const photosByActivity: Record<string, { id: string; photo_url: string; storage_path: string; caption: string | null }[]> = {};
      for (const p of photosRaw as Record<string, unknown>[]) {
        const aid = p.activity_id as string;
        if (!photosByActivity[aid]) photosByActivity[aid] = [];
        photosByActivity[aid].push({ id: p.id as string, photo_url: p.photo_url as string, storage_path: (p.storage_path as string) || "", caption: p.caption as string | null });
      }

      // Group reactions by activity
      const reactionsByActivity: Record<string, { user_id: string; reaction_type: string }[]> = {};
      for (const r of (reactionsRaw ?? []) as Record<string, unknown>[]) {
        const aid = r.activity_id as string;
        if (!reactionsByActivity[aid]) reactionsByActivity[aid] = [];
        reactionsByActivity[aid].push({ user_id: r.user_id as string, reaction_type: r.reaction_type as string });
      }

      // Group comments by activity
      const commentsByActivity: Record<string, { id: string; user_id: string; user_name: string; user_avatar: string | null; content: string; created_at: string }[]> = {};
      for (const c of (commentsRaw ?? []) as Record<string, unknown>[]) {
        const aid = c.activity_id as string;
        if (!commentsByActivity[aid]) commentsByActivity[aid] = [];
        const prof = (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles) as Record<string, unknown> | null;
        commentsByActivity[aid].push({ id: c.id as string, user_id: c.user_id as string, user_name: (prof?.name as string) || "—", user_avatar: (prof?.avatar_url as string) || null, content: c.content as string, created_at: c.created_at as string });
      }

      const feedPosts: FeedPost[] = ((actsRaw ?? []) as Record<string, unknown>[]).map((a) => {
        const prof = (Array.isArray(a.profiles) ? a.profiles[0] : a.profiles) as Record<string, unknown> | null;
        return {
          id: a.id as string, type: a.type as string, title: a.title as string,
          activity_date: a.activity_date as string, description: a.description as string | null,
          contact_name: a.contact_name as string | null, outcome: a.outcome as string | null,
          profile_name: (prof?.name as string) || "—", profile_role: (prof?.role as string) || "",
          profile_avatar: (prof?.avatar_url as string) || null, profile_id: a.profile_id as string,
          created_at: a.created_at as string,
          photos: photosByActivity[a.id as string] || [],
          reactions: reactionsByActivity[a.id as string] || [],
          comments: commentsByActivity[a.id as string] || [],
        };
      }).filter((p) => p.photos.length > 0);

      setPosts(feedPosts);
    } catch (err) { console.error("Feed load error:", err); }
    finally { setLoading(false); }
  }, [accountId]);

  useEffect(() => { void loadFeed(); }, [loadFeed]);

  function toggleReaction(postId: string, type: string) {
    if (!supabase || !userId) return;
    const userName = authenticatedProfile?.fullName || "Você";

    // Optimistic update
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const existing = p.reactions.find((r) => r.user_id === userId);
      if (existing) {
        return { ...p, reactions: p.reactions.filter((r) => r.user_id !== userId) };
      }
      return { ...p, reactions: [...p.reactions, { user_id: userId, reaction_type: type }] };
    }));
    setShowReactionPicker(null);

    // Background save
    const post = posts.find((p) => p.id === postId);
    const wasReacted = post?.reactions.some((r) => r.user_id === userId);
    if (wasReacted) {
      supabase.from("feed_reactions").delete().eq("activity_id", postId).eq("user_id", userId).then(({ error }) => {
        if (error) setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reactions: [...p.reactions, { user_id: userId!, reaction_type: type }] } : p));
      });
    } else {
      supabase.from("feed_reactions").upsert({ activity_id: postId, user_id: userId, reaction_type: type }, { onConflict: "activity_id,user_id" }).then(({ error }) => {
        if (error) setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reactions: p.reactions.filter((r) => r.user_id !== userId) } : p));
        // Notify activity author (only for new reactions, not removes)
        if (!error && post?.profile_id && post.profile_id !== userId && accountId) {
          supabase!.from("notifications").insert({ account_id: accountId, recipient_id: post.profile_id, sender_id: userId, type: "feed_reaction", title: `${userName} reagiu à sua atividade`, message: `${type === "like" ? "👍" : type === "celebrate" ? "🎉" : type === "fire" ? "🔥" : "❤️"} em "${post.title?.slice(0, 60) || "atividade"}"`, read: false, action_url: "/feed" }).then(() => {}, () => {});
        }
      });
    }
  }

  function addComment(postId: string) {
    if (!supabase || !userId) return;
    const text = (commentText[postId] || "").trim();
    if (!text) return;
    const userName = authenticatedProfile?.fullName || "Você";

    // Optimistic update
    const tempId = "temp-" + Date.now();
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      return { ...p, comments: [...p.comments, { id: tempId, user_id: userId, user_name: userName, user_avatar: null, content: text, created_at: new Date().toISOString() }] };
    }));
    setCommentText((prev) => ({ ...prev, [postId]: "" }));

    // Background save
    const commentPost = posts.find((p) => p.id === postId);
    supabase.from("feed_comments").insert({ activity_id: postId, user_id: userId, content: text }).select("id").single().then(({ data, error }) => {
      if (data) {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: p.comments.map((c) => c.id === tempId ? { ...c, id: data.id } : c) } : p));
        // Notify activity author
        if (commentPost?.profile_id && commentPost.profile_id !== userId && accountId) {
          supabase!.from("notifications").insert({ account_id: accountId, recipient_id: commentPost.profile_id, sender_id: userId, type: "feed_comment", title: `${userName} comentou na sua atividade`, message: `"${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`, read: false, action_url: "/feed" }).then(() => {}, () => {});
        }
      }
      if (error) console.error("Comment save error:", error);
    });
  }

  function deleteComment(commentId: string, postId: string) {
    if (!supabase) return;

    // Optimistic update
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p));

    // Background delete
    if (!commentId.startsWith("temp-")) {
      supabase.from("feed_comments").delete().eq("id", commentId).then(() => {});
    }
  }

  const userRole = account?.role as string ?? "";
  const canManagePhotos = ["owner", "director", "manager"].includes(userRole);

  function deletePhoto(photoId: string, storagePath: string, postId: string) {
    if (!supabase) return;
    // Optimistic
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, photos: p.photos.filter((ph) => ph.id !== photoId) } : p).filter((p) => p.photos.length > 0));
    // Background
    supabase.from("activity_photos").delete().eq("id", photoId).then(() => {});
    if (storagePath) supabase.storage.from("activity-photos").remove([storagePath]).then(() => {});
  }

  if (loading) return <div style={{ padding: 32, textAlign: "center" }}><div style={{ fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>Carregando mural...</div></div>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: isMobile ? "16px 0" : "24px 0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: T.bone, margin: 0, padding: isMobile ? "0 16px" : 0, marginBottom: 20 }}>Mural do Time</h1>

      {posts.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📷</div>
          <div style={{ fontSize: 16, color: T.bone, fontWeight: 500, marginBottom: 8 }}>Nenhuma atividade com foto</div>
          <div style={{ fontSize: 13, color: T.fog }}>Ao registrar uma atividade com foto, ela aparece aqui para todo o time.</div>
        </div>
      )}

      {posts.map((post) => {
        const myReaction = post.reactions.find((r) => r.user_id === userId);
        const reactionCounts: Record<string, number> = {};
        post.reactions.forEach((r) => { reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1; });

        return (
          <div key={post.id} style={{ background: T.carbon, border: isMobile ? "none" : `1px solid ${T.stone}`, borderTop: isMobile ? `1px solid ${T.stone}` : undefined, borderRadius: isMobile ? 0 : 12, marginBottom: isMobile ? 0 : 16, overflow: "hidden" }}>
            {/* Author */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 10px" }}>
              <Avatar name={post.profile_name} avatarUrl={post.profile_avatar} size={36} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.chalk }}>{post.profile_name}</div>
                <div style={{ fontSize: 11, color: T.slate }}>{ROLE_LABELS[post.profile_role] || post.profile_role} · {timeAgo(post.created_at)}</div>
              </div>
            </div>

            {/* Type badge + title */}
            <div style={{ padding: "0 16px 8px" }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: T.sprout + "15", color: T.sprout, textTransform: "uppercase", letterSpacing: "0.04em" }}>{TYPE_LABELS[post.type] || post.type}</span>
              <div style={{ fontSize: 15, fontWeight: 500, color: T.chalk, marginTop: 6 }}>{post.title}</div>
            </div>

            {/* Photos */}
            <div style={{ position: "relative" }}>
              {post.photos.length === 1 ? (
                <div style={{ position: "relative" }}>
                  <img src={post.photos[0].photo_url} alt="" onClick={() => setLightbox({ urls: post.photos.map((p) => p.photo_url), idx: 0 })} style={{ width: "100%", maxHeight: 400, objectFit: "cover", cursor: "pointer" }} />
                  {(post.profile_id === userId || canManagePhotos) && <button type="button" onClick={() => deletePhoto(post.photos[0].id, post.photos[0].storage_path, post.id)} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  {post.photos.slice(0, 4).map((p, i) => (
                    <div key={p.id} style={{ position: "relative" }}>
                      <img src={p.photo_url} alt="" onClick={() => setLightbox({ urls: post.photos.map((ph) => ph.photo_url), idx: i })} style={{ width: "100%", height: 180, objectFit: "cover", cursor: "pointer" }} />
                      {(post.profile_id === userId || canManagePhotos) && <button type="button" onClick={() => deletePhoto(p.id, p.storage_path, post.id)} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Caption / description */}
            {(post.photos[0]?.caption || post.description || post.outcome) && (
              <div style={{ padding: "10px 16px 4px", fontSize: 13, color: T.bone, lineHeight: 1.5 }}>
                {post.photos[0]?.caption || post.outcome || post.description}
              </div>
            )}

            {/* Reaction counts */}
            {post.reactions.length > 0 && (
              <div style={{ padding: "6px 16px", fontSize: 12, color: T.fog, display: "flex", gap: 8 }}>
                {Object.entries(reactionCounts).map(([type, count]) => {
                  const emoji = REACTIONS.find((r) => r.type === type)?.emoji || "👍";
                  return <span key={type}>{emoji} {count}</span>;
                })}
              </div>
            )}

            {/* Actions bar */}
            <div style={{ borderTop: `1px solid ${T.stone}`, display: "flex", position: "relative" }}>
              <button type="button" onClick={() => myReaction ? toggleReaction(post.id, myReaction.reaction_type) : setShowReactionPicker(showReactionPicker === post.id ? null : post.id)} style={{ flex: 1, padding: "10px", background: "none", border: "none", color: myReaction ? T.sprout : T.fog, fontSize: 13, cursor: "pointer", fontWeight: myReaction ? 600 : 400 }}>
                {myReaction ? (REACTIONS.find((r) => r.type === myReaction.reaction_type)?.emoji || "👍") : "👍"} {myReaction ? "Curtido" : "Curtir"}
              </button>
              <button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()} style={{ flex: 1, padding: "10px", background: "none", border: "none", color: T.fog, fontSize: 13, cursor: "pointer" }}>
                💬 {post.comments.length > 0 ? post.comments.length : "Comentar"}
              </button>
              {/* Reaction picker */}
              {showReactionPicker === post.id && (
                <div style={{ position: "absolute", bottom: "100%", left: 8, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 20, padding: "6px 8px", display: "flex", gap: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", zIndex: 10 }}>
                  {REACTIONS.map((r) => (
                    <button key={r.type} type="button" title={r.label} onClick={() => toggleReaction(post.id, r.type)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: "4px 6px", borderRadius: 8 }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>{r.emoji}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            {post.comments.length > 0 && (
              <div style={{ borderTop: `1px solid ${T.stone}`, padding: "8px 16px" }}>
                {post.comments.slice(-3).map((c) => (
                  <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <Avatar name={c.user_name} avatarUrl={c.user_avatar} size={28} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.bone }}>{c.user_name}</span>
                      <span style={{ fontSize: 11, color: T.slate, marginLeft: 6 }}>{timeAgo(c.created_at)}</span>
                      {c.user_id === userId && <button type="button" onClick={() => deleteComment(c.id, post.id)} style={{ background: "none", border: "none", color: T.slate, fontSize: 10, cursor: "pointer", marginLeft: 6 }}>excluir</button>}
                      <div style={{ fontSize: 13, color: T.chalk, marginTop: 2 }}>{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            <div style={{ borderTop: `1px solid ${T.stone}`, padding: "8px 16px", display: "flex", gap: 8 }}>
              <input id={`comment-${post.id}`} value={commentText[post.id] || ""} onChange={(e) => setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addComment(post.id); }} placeholder="Escrever comentário..." maxLength={500} style={{ flex: 1, background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 20, padding: "8px 14px", color: T.chalk, fontSize: 13, outline: "none" }} />
              <button type="button" onClick={() => addComment(post.id)} disabled={!(commentText[post.id] || "").trim()} style={{ background: T.sprout, color: "var(--interactive-on-primary)", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (commentText[post.id] || "").trim() ? 1 : 0.4 }}>Enviar</button>
            </div>
          </div>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={lightbox.urls[lightbox.idx]} alt="" style={{ maxWidth: "95vw", maxHeight: "95vh", objectFit: "contain" }} onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#fff", fontSize: 28, cursor: "pointer" }}>×</button>
          {lightbox.urls.length > 1 && (
            <>
              {lightbox.idx > 0 && <button type="button" onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, idx: lightbox.idx - 1 }); }} style={{ position: "absolute", left: 16, background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: 24, padding: "12px 16px", borderRadius: 8, cursor: "pointer" }}>‹</button>}
              {lightbox.idx < lightbox.urls.length - 1 && <button type="button" onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, idx: lightbox.idx + 1 }); }} style={{ position: "absolute", right: 16, background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: 24, padding: "12px 16px", borderRadius: 8, cursor: "pointer" }}>›</button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
