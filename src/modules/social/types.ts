// NEXA Social v1 — Tipos do domínio. Espelham as 7 tabelas social_*
// no Supabase (production). Convenção: camelCase na UI, snake_case no
// banco; mapping é feito no repositório.

// ── Enums (espelham CHECK constraints do banco) ────────────────────

export type SocialPostCategory =
  | "visit_client"
  | "visit_broker"
  | "meeting_external"
  | "meeting_internal"
  | "training"
  | "event"
  | "announcement"
  | "free";

export type SocialPostStatus = "draft" | "published" | "hidden" | "deleted";

export type SocialReactionType =
  | "thumbs_up"
  | "heart"
  | "strong"
  | "celebrate";

export type SocialCommentStatus = "published" | "deleted";

export type SocialMentionSourceType = "post" | "comment";

export type SocialModerationAction = "hide" | "unhide";

// ── Entidades ──────────────────────────────────────────────────────

/** Um post do Mural. Contadores (reactions/comments/bookmarks) são
 *  mantidos por triggers no banco — não atualizar manualmente. */
export interface SocialPost {
  id: string;
  accountId: string;
  authorProfileId: string;
  category: SocialPostCategory;
  /** 1..5000 chars (validado por CHECK no banco). */
  content: string;
  mediaUrls: string[];
  mediaCaptions: string[];
  reactionsCount: number;
  commentsCount: number;
  bookmarksCount: number;
  status: SocialPostStatus;
  /** Setado por trigger quando reactionsCount cruza o limiar. */
  isFeatured: boolean;
  hiddenBy: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
  legacyActivityId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
}

export interface SocialReaction {
  id: string;
  postId: string;
  profileId: string;
  accountId: string;
  reactionType: SocialReactionType;
  createdAt: string;
}

export interface SocialComment {
  id: string;
  postId: string;
  profileId: string;
  accountId: string;
  /** Null = comentário raiz. Preenchido = reply (thread). */
  parentCommentId: string | null;
  /** 1..2000 chars (validado por CHECK no banco). */
  content: string;
  status: SocialCommentStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SocialMention {
  id: string;
  accountId: string;
  sourceType: SocialMentionSourceType;
  sourceId: string;
  mentionedProfileId: string;
  authorProfileId: string;
  createdAt: string;
}

export interface SocialBookmark {
  id: string;
  postId: string;
  profileId: string;
  accountId: string;
  createdAt: string;
}

export interface SocialUserPreferences {
  profileId: string;
  accountId: string;
  notifyOnReaction: boolean;
  notifyOnComment: boolean;
  notifyOnMention: boolean;
  notifyOnReply: boolean;
  notifyOnModeration: boolean;
  notifyOnNewPosts: boolean;
  updatedAt: string;
}

export interface SocialModerationLogEntry {
  id: string;
  postId: string;
  accountId: string;
  moderatedBy: string;
  action: SocialModerationAction;
  reason: string | null;
  createdAt: string;
}

// ── Agregados para a UI ────────────────────────────────────────────

/** Subset do profile exposto no card do post. */
export interface SocialPostAuthor {
  id: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  /** Role normalizada (owner/director/manager/commercial_consultant/broker/administrative). */
  role: string;
}

/** Post + contexto necessário para renderizar o card (autor + reações/
 *  bookmark do usuário atual, já resolvidos pelo repositório). */
export interface SocialPostWithContext {
  post: SocialPost;
  author: SocialPostAuthor;
  /** Reações que o usuário atual deu neste post (pode ter várias de tipos diferentes). */
  myReactions: SocialReactionType[];
  /** Se o usuário atual salvou o post. */
  isBookmarked: boolean;
}

// ── Inputs (create/update) ─────────────────────────────────────────

export interface CreateSocialPostInput {
  category: SocialPostCategory;
  content: string;
  mediaUrls?: string[];
  mediaCaptions?: string[];
}

export interface UpdateSocialPostInput {
  content?: string;
  category?: SocialPostCategory;
}

export interface UpdateSocialUserPreferencesInput {
  notifyOnReaction?: boolean;
  notifyOnComment?: boolean;
  notifyOnMention?: boolean;
  notifyOnReply?: boolean;
  notifyOnModeration?: boolean;
  notifyOnNewPosts?: boolean;
}

// ── Opções de listagem ─────────────────────────────────────────────

export interface ListPostsOptions {
  limit?: number;
  /** Paginação por timestamp — passa o `createdAt` do último post carregado. */
  cursorCreatedAt?: string;
  categories?: SocialPostCategory[];
}
