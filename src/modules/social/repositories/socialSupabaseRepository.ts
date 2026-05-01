// NEXA Social v1 — Único ponto de contato com o Supabase para o módulo
// social. Nenhuma camada acima (hooks, componentes, páginas) pode
// chamar supabase.from('social_*') diretamente.
//
// Padrão: named function exports + RowType + mapRowToEntity por
// entidade (mesmo estilo de src/infra/repositories/*SupabaseRepository).

import { getSupabaseClientOrThrow } from "../../../infra/repositories/baseRepository";
import type {
  CreateSocialPostInput,
  ListPostsOptions,
  SocialBookmark,
  SocialComment,
  SocialCommentStatus,
  SocialMention,
  SocialMentionSourceType,
  SocialModerationAction,
  SocialModerationLogEntry,
  SocialPost,
  SocialPostAuthor,
  SocialPostCategory,
  SocialPostStatus,
  SocialPostWithContext,
  SocialReaction,
  SocialReactionType,
  SocialUserPreferences,
  UpdateSocialPostInput,
  UpdateSocialUserPreferencesInput,
} from "../types";

// ── Row types (snake_case, espelho do schema) ─────────────────────

type SocialPostRow = {
  id: string;
  account_id: string;
  author_profile_id: string;
  category: SocialPostCategory;
  content: string;
  media_urls: string[] | null;
  media_captions: string[] | null;
  reactions_count: number | null;
  comments_count: number | null;
  bookmarks_count: number | null;
  status: SocialPostStatus;
  is_featured: boolean | null;
  hidden_by: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
  legacy_activity_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  deleted_at: string | null;
};

type ProfileEmbeddedRow = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
};

type SocialPostWithAuthorRow = SocialPostRow & {
  author: ProfileEmbeddedRow | ProfileEmbeddedRow[] | null;
};

type SocialReactionRow = {
  id: string;
  post_id: string;
  profile_id: string;
  account_id: string;
  reaction_type: SocialReactionType;
  created_at: string;
};

type SocialCommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  account_id: string;
  parent_comment_id: string | null;
  content: string;
  status: SocialCommentStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SocialMentionRow = {
  id: string;
  account_id: string;
  source_type: SocialMentionSourceType;
  source_id: string;
  mentioned_profile_id: string;
  author_profile_id: string;
  created_at: string;
};

type SocialBookmarkRow = {
  id: string;
  post_id: string;
  profile_id: string;
  account_id: string;
  created_at: string;
};

type SocialUserPreferencesRow = {
  profile_id: string;
  account_id: string;
  notify_on_reaction: boolean;
  notify_on_comment: boolean;
  notify_on_mention: boolean;
  notify_on_reply: boolean;
  notify_on_moderation: boolean;
  notify_on_new_posts: boolean;
  updated_at: string;
};

type SocialModerationLogRow = {
  id: string;
  post_id: string;
  account_id: string;
  moderated_by: string;
  action: SocialModerationAction;
  reason: string | null;
  created_at: string;
};

// ── Mappers (snake_case → camelCase) ──────────────────────────────

function mapPostRowToPost(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    accountId: row.account_id,
    authorProfileId: row.author_profile_id,
    category: row.category,
    content: row.content,
    mediaUrls: row.media_urls ?? [],
    mediaCaptions: row.media_captions ?? [],
    reactionsCount: row.reactions_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    bookmarksCount: row.bookmarks_count ?? 0,
    status: row.status,
    isFeatured: row.is_featured ?? false,
    hiddenBy: row.hidden_by,
    hiddenAt: row.hidden_at,
    hiddenReason: row.hidden_reason,
    legacyActivityId: row.legacy_activity_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    deletedAt: row.deleted_at,
  };
}

function mapEmbeddedProfileToAuthor(
  raw: ProfileEmbeddedRow | ProfileEmbeddedRow[] | null,
  fallbackId: string,
): SocialPostAuthor {
  const row = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  if (!row) {
    return {
      id: fallbackId,
      fullName: null,
      email: "",
      avatarUrl: null,
      role: "",
    };
  }
  return {
    id: row.id,
    fullName: row.name ?? row.full_name ?? null,
    email: row.email,
    avatarUrl: row.avatar_url ?? null,
    role: row.role ?? "",
  };
}

function mapReactionRow(row: SocialReactionRow): SocialReaction {
  return {
    id: row.id,
    postId: row.post_id,
    profileId: row.profile_id,
    accountId: row.account_id,
    reactionType: row.reaction_type,
    createdAt: row.created_at,
  };
}

function mapCommentRow(row: SocialCommentRow): SocialComment {
  return {
    id: row.id,
    postId: row.post_id,
    profileId: row.profile_id,
    accountId: row.account_id,
    parentCommentId: row.parent_comment_id,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapMentionRow(row: SocialMentionRow): SocialMention {
  return {
    id: row.id,
    accountId: row.account_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    mentionedProfileId: row.mentioned_profile_id,
    authorProfileId: row.author_profile_id,
    createdAt: row.created_at,
  };
}

function mapBookmarkRow(row: SocialBookmarkRow): SocialBookmark {
  return {
    id: row.id,
    postId: row.post_id,
    profileId: row.profile_id,
    accountId: row.account_id,
    createdAt: row.created_at,
  };
}

function mapPreferencesRow(
  row: SocialUserPreferencesRow,
): SocialUserPreferences {
  return {
    profileId: row.profile_id,
    accountId: row.account_id,
    notifyOnReaction: row.notify_on_reaction,
    notifyOnComment: row.notify_on_comment,
    notifyOnMention: row.notify_on_mention,
    notifyOnReply: row.notify_on_reply,
    notifyOnModeration: row.notify_on_moderation,
    notifyOnNewPosts: row.notify_on_new_posts,
    updatedAt: row.updated_at,
  };
}

function mapModerationLogRow(
  row: SocialModerationLogRow,
): SocialModerationLogEntry {
  return {
    id: row.id,
    postId: row.post_id,
    accountId: row.account_id,
    moderatedBy: row.moderated_by,
    action: row.action,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

// ── Colunas projetadas ────────────────────────────────────────────

const POST_COLUMNS =
  "id, account_id, author_profile_id, category, content, media_urls, media_captions, reactions_count, comments_count, bookmarks_count, status, is_featured, hidden_by, hidden_at, hidden_reason, legacy_activity_id, created_at, updated_at, published_at, deleted_at";

const POST_WITH_AUTHOR_COLUMNS =
  `${POST_COLUMNS}, author:profiles!author_profile_id(id, name, full_name, email, avatar_url, role)`;

// ── Helpers para montar SocialPostWithContext ─────────────────────

async function attachContextToPosts(
  rows: SocialPostWithAuthorRow[],
  currentProfileId: string | null,
): Promise<SocialPostWithContext[]> {
  if (rows.length === 0) return [];

  const supabase = getSupabaseClientOrThrow("social repository");
  const postIds = rows.map((r) => r.id);

  const myReactionsByPost = new Map<string, SocialReactionType[]>();
  const bookmarkedPostIds = new Set<string>();

  if (currentProfileId) {
    const [reactionsRes, bookmarksRes] = await Promise.all([
      supabase
        .from("social_reactions")
        .select("post_id, reaction_type")
        .eq("profile_id", currentProfileId)
        .in("post_id", postIds),
      supabase
        .from("social_bookmarks")
        .select("post_id")
        .eq("profile_id", currentProfileId)
        .in("post_id", postIds),
    ]);

    if (reactionsRes.error) {
      throw new Error(
        `Failed to load social reactions context: ${reactionsRes.error.message}`,
      );
    }
    if (bookmarksRes.error) {
      throw new Error(
        `Failed to load social bookmarks context: ${bookmarksRes.error.message}`,
      );
    }

    for (const r of (reactionsRes.data ?? []) as Array<{
      post_id: string;
      reaction_type: SocialReactionType;
    }>) {
      const list = myReactionsByPost.get(r.post_id) ?? [];
      list.push(r.reaction_type);
      myReactionsByPost.set(r.post_id, list);
    }
    for (const b of (bookmarksRes.data ?? []) as Array<{ post_id: string }>) {
      bookmarkedPostIds.add(b.post_id);
    }
  }

  return rows.map((row) => ({
    post: mapPostRowToPost(row),
    author: mapEmbeddedProfileToAuthor(row.author, row.author_profile_id),
    myReactions: myReactionsByPost.get(row.id) ?? [],
    isBookmarked: bookmarkedPostIds.has(row.id),
  }));
}

// ── Posts: listagem e leitura ─────────────────────────────────────

export async function listPosts(
  accountId: string,
  currentProfileId: string | null,
  options: ListPostsOptions = {},
): Promise<SocialPostWithContext[]> {
  const supabase = getSupabaseClientOrThrow("social repository");
  const limit = options.limit ?? 20;

  let query = supabase
    .from("social_posts")
    .select(POST_WITH_AUTHOR_COLUMNS)
    .eq("account_id", accountId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.cursorCreatedAt) {
    query = query.lt("created_at", options.cursorCreatedAt);
  }
  if (options.categories && options.categories.length > 0) {
    query = query.in("category", options.categories);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list social posts: ${error.message}`);
  }

  return attachContextToPosts(
    (data ?? []) as SocialPostWithAuthorRow[],
    currentProfileId,
  );
}

export async function getPostById(
  postId: string,
  currentProfileId: string | null,
): Promise<SocialPostWithContext | null> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { data, error } = await supabase
    .from("social_posts")
    .select(POST_WITH_AUTHOR_COLUMNS)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load social post: ${error.message}`);
  }
  if (!data) return null;

  const withContext = await attachContextToPosts(
    [data as SocialPostWithAuthorRow],
    currentProfileId,
  );
  return withContext[0] ?? null;
}

// ── Posts: mutações ───────────────────────────────────────────────

export async function createPost(
  input: CreateSocialPostInput & {
    accountId: string;
    authorProfileId: string;
  },
): Promise<SocialPost> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const payload = {
    account_id: input.accountId,
    author_profile_id: input.authorProfileId,
    category: input.category,
    content: input.content,
    media_urls: input.mediaUrls ?? [],
    media_captions: input.mediaCaptions ?? [],
    status: "published" as SocialPostStatus,
    published_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("social_posts")
    .insert(payload)
    .select(POST_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to create social post: ${error.message}`);
  }
  return mapPostRowToPost(data as SocialPostRow);
}

export async function updatePost(
  postId: string,
  input: UpdateSocialPostInput,
): Promise<SocialPost> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const payload: Record<string, unknown> = {};
  if (input.content !== undefined) payload.content = input.content;
  if (input.category !== undefined) payload.category = input.category;

  const { data, error } = await supabase
    .from("social_posts")
    .update(payload)
    .eq("id", postId)
    .select(POST_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to update social post: ${error.message}`);
  }
  return mapPostRowToPost(data as SocialPostRow);
}

/** Soft delete — mantém a linha, marca status/deleted_at. */
export async function deletePost(postId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { error } = await supabase
    .from("social_posts")
    .update({
      status: "deleted" as SocialPostStatus,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) {
    throw new Error(`Failed to delete social post: ${error.message}`);
  }
}

// ── Posts: moderação ──────────────────────────────────────────────

/**
 * Esconde um post (moderação).
 *
 * Limitação atual: sem RPC em transação, o UPDATE e o INSERT no
 * moderation_log são sequenciais. Se o INSERT falhar após o UPDATE,
 * o log fica inconsistente mas o post fica escondido. Uma RPC
 * `social_hide_post(post_id, reason)` que envolva ambos numa
 * transação deve ser criada quando a Fase 3B entregar permissões.
 */
export async function hidePost(
  postId: string,
  moderatorProfileId: string,
  accountId: string,
  reason: string | null = null,
): Promise<void> {
  const supabase = getSupabaseClientOrThrow("social repository");
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      status: "hidden" as SocialPostStatus,
      hidden_by: moderatorProfileId,
      hidden_at: now,
      hidden_reason: reason,
    })
    .eq("id", postId);

  if (updateError) {
    throw new Error(`Failed to hide social post: ${updateError.message}`);
  }

  const { error: logError } = await supabase
    .from("social_moderation_log")
    .insert({
      post_id: postId,
      account_id: accountId,
      moderated_by: moderatorProfileId,
      action: "hide" as SocialModerationAction,
      reason,
    });

  if (logError) {
    throw new Error(
      `Social post hidden but moderation log failed: ${logError.message}`,
    );
  }
}

export async function unhidePost(
  postId: string,
  moderatorProfileId: string,
  accountId: string,
): Promise<void> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      status: "published" as SocialPostStatus,
      hidden_by: null,
      hidden_at: null,
      hidden_reason: null,
    })
    .eq("id", postId);

  if (updateError) {
    throw new Error(`Failed to unhide social post: ${updateError.message}`);
  }

  const { error: logError } = await supabase
    .from("social_moderation_log")
    .insert({
      post_id: postId,
      account_id: accountId,
      moderated_by: moderatorProfileId,
      action: "unhide" as SocialModerationAction,
      reason: null,
    });

  if (logError) {
    throw new Error(
      `Social post unhidden but moderation log failed: ${logError.message}`,
    );
  }
}

// ── Reações ───────────────────────────────────────────────────────

export async function addReaction(
  postId: string,
  profileId: string,
  accountId: string,
  reactionType: SocialReactionType,
): Promise<void> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { error } = await supabase.from("social_reactions").upsert(
    {
      post_id: postId,
      profile_id: profileId,
      account_id: accountId,
      reaction_type: reactionType,
    },
    { onConflict: "post_id,profile_id,reaction_type" },
  );

  if (error) {
    throw new Error(`Failed to add reaction: ${error.message}`);
  }
}

export async function removeReaction(
  postId: string,
  profileId: string,
  reactionType: SocialReactionType,
): Promise<void> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { error } = await supabase
    .from("social_reactions")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId)
    .eq("reaction_type", reactionType);

  if (error) {
    throw new Error(`Failed to remove reaction: ${error.message}`);
  }
}

// ── Comentários ───────────────────────────────────────────────────

const COMMENT_COLUMNS =
  "id, post_id, profile_id, account_id, parent_comment_id, content, status, created_at, updated_at, deleted_at";

export async function listComments(postId: string): Promise<SocialComment[]> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { data, error } = await supabase
    .from("social_comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list social comments: ${error.message}`);
  }
  return ((data ?? []) as SocialCommentRow[]).map(mapCommentRow);
}

export async function addComment(input: {
  postId: string;
  profileId: string;
  accountId: string;
  content: string;
  parentCommentId?: string | null;
}): Promise<SocialComment> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { data, error } = await supabase
    .from("social_comments")
    .insert({
      post_id: input.postId,
      profile_id: input.profileId,
      account_id: input.accountId,
      parent_comment_id: input.parentCommentId ?? null,
      content: input.content,
      status: "published" as SocialCommentStatus,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to add social comment: ${error.message}`);
  }
  return mapCommentRow(data as SocialCommentRow);
}

export async function updateComment(
  commentId: string,
  content: string,
): Promise<SocialComment> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { data, error } = await supabase
    .from("social_comments")
    .update({ content })
    .eq("id", commentId)
    .select(COMMENT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to update social comment: ${error.message}`);
  }
  return mapCommentRow(data as SocialCommentRow);
}

/** Soft delete — status='deleted' + deleted_at. */
export async function deleteComment(commentId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { error } = await supabase
    .from("social_comments")
    .update({
      status: "deleted" as SocialCommentStatus,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", commentId);

  if (error) {
    throw new Error(`Failed to delete social comment: ${error.message}`);
  }
}

// ── Bookmarks ─────────────────────────────────────────────────────

/** Checa existência, alterna. Retorna o estado final para a UI. */
export async function toggleBookmark(
  postId: string,
  profileId: string,
  accountId: string,
): Promise<{ bookmarked: boolean }> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { data: existing, error: selectError } = await supabase
    .from("social_bookmarks")
    .select("id")
    .eq("post_id", postId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to check bookmark: ${selectError.message}`);
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("social_bookmarks")
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (deleteError) {
      throw new Error(`Failed to remove bookmark: ${deleteError.message}`);
    }
    return { bookmarked: false };
  }

  const { error: insertError } = await supabase.from("social_bookmarks").insert({
    post_id: postId,
    profile_id: profileId,
    account_id: accountId,
  });
  if (insertError) {
    throw new Error(`Failed to add bookmark: ${insertError.message}`);
  }
  return { bookmarked: true };
}

export async function listBookmarks(
  profileId: string,
): Promise<SocialPostWithContext[]> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("social_bookmarks")
    .select("post_id, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (bookmarksError) {
    throw new Error(
      `Failed to list bookmarks: ${bookmarksError.message}`,
    );
  }
  const ids = ((bookmarks ?? []) as Array<{ post_id: string }>).map(
    (b) => b.post_id,
  );
  if (ids.length === 0) return [];

  const { data: posts, error: postsError } = await supabase
    .from("social_posts")
    .select(POST_WITH_AUTHOR_COLUMNS)
    .in("id", ids)
    .eq("status", "published");

  if (postsError) {
    throw new Error(
      `Failed to load bookmarked posts: ${postsError.message}`,
    );
  }

  return attachContextToPosts(
    (posts ?? []) as SocialPostWithAuthorRow[],
    profileId,
  );
}

// ── Preferências do usuário ───────────────────────────────────────

const PREFS_COLUMNS =
  "profile_id, account_id, notify_on_reaction, notify_on_comment, notify_on_mention, notify_on_reply, notify_on_moderation, notify_on_new_posts, updated_at";

export async function getUserPreferences(
  profileId: string,
  accountId: string,
): Promise<SocialUserPreferences | null> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const { data, error } = await supabase
    .from("social_user_preferences")
    .select(PREFS_COLUMNS)
    .eq("profile_id", profileId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load social preferences: ${error.message}`);
  }
  return data
    ? mapPreferencesRow(data as SocialUserPreferencesRow)
    : null;
}

export async function upsertUserPreferences(
  profileId: string,
  accountId: string,
  prefs: UpdateSocialUserPreferencesInput,
): Promise<SocialUserPreferences> {
  const supabase = getSupabaseClientOrThrow("social repository");

  const payload: Record<string, unknown> = {
    profile_id: profileId,
    account_id: accountId,
  };
  if (prefs.notifyOnReaction !== undefined)
    payload.notify_on_reaction = prefs.notifyOnReaction;
  if (prefs.notifyOnComment !== undefined)
    payload.notify_on_comment = prefs.notifyOnComment;
  if (prefs.notifyOnMention !== undefined)
    payload.notify_on_mention = prefs.notifyOnMention;
  if (prefs.notifyOnReply !== undefined)
    payload.notify_on_reply = prefs.notifyOnReply;
  if (prefs.notifyOnModeration !== undefined)
    payload.notify_on_moderation = prefs.notifyOnModeration;
  if (prefs.notifyOnNewPosts !== undefined)
    payload.notify_on_new_posts = prefs.notifyOnNewPosts;

  const { data, error } = await supabase
    .from("social_user_preferences")
    .upsert(payload, { onConflict: "profile_id,account_id" })
    .select(PREFS_COLUMNS)
    .single();

  if (error) {
    throw new Error(
      `Failed to upsert social preferences: ${error.message}`,
    );
  }
  return mapPreferencesRow(data as SocialUserPreferencesRow);
}

// ── Exports para testes / futuro ──────────────────────────────────

export const __INTERNAL__ = {
  mapPostRowToPost,
  mapReactionRow,
  mapCommentRow,
  mapMentionRow,
  mapBookmarkRow,
  mapPreferencesRow,
  mapModerationLogRow,
  mapEmbeddedProfileToAuthor,
};
