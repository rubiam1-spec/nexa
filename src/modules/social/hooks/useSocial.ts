// NEXA Social v1 — Hooks de consumo da UI. Padrão do projeto:
// useState + useEffect com flag isMounted para cleanup (mesmo estilo
// de src/modules/negociacoes/hooks/useNegotiations.ts).
//
// Sem TanStack Query / SWR — o projeto não usa lib de data fetching.
// Invalidação de cache após mutations é feita via função `refresh()`
// exposta pelos hooks de listagem, que a UI chama manualmente.

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import type {
  CreateSocialPostInput,
  ListPostsOptions,
  SocialComment,
  SocialPostCategory,
  SocialPostWithContext,
  SocialReactionType,
  SocialUserPreferences,
  UpdateSocialPostInput,
  UpdateSocialUserPreferencesInput,
} from "../types";
import {
  addComment as repoAddComment,
  addReaction as repoAddReaction,
  createPost as repoCreatePost,
  deleteComment as repoDeleteComment,
  deletePost as repoDeletePost,
  getPostById as repoGetPostById,
  getUserPreferences as repoGetUserPreferences,
  hidePost as repoHidePost,
  listBookmarks as repoListBookmarks,
  listComments as repoListComments,
  listPosts as repoListPosts,
  removeReaction as repoRemoveReaction,
  toggleBookmark as repoToggleBookmark,
  unhidePost as repoUnhidePost,
  updateComment as repoUpdateComment,
  updatePost as repoUpdatePost,
  upsertUserPreferences as repoUpsertUserPreferences,
} from "../repositories/socialSupabaseRepository";

type FetchStatus = "idle" | "loading" | "ready" | "empty" | "error";

// ── useSocialFeed ─────────────────────────────────────────────────

export interface UseSocialFeedFilters {
  categories?: SocialPostCategory[];
  limit?: number;
}

export interface UseSocialFeedResult {
  posts: SocialPostWithContext[];
  isLoading: boolean;
  status: FetchStatus;
  errorMessage: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Lista posts publicados do feed do Mural, paginados por timestamp.
 * `accountId` define o tenant. `currentProfileId` é usado para
 * popular `myReactions` e `isBookmarked` em cada post.
 */
export function useSocialFeed(
  accountId: string | null,
  currentProfileId: string | null,
  filters: UseSocialFeedFilters = {},
): UseSocialFeedResult {
  const [posts, setPosts] = useState<SocialPostWithContext[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const limit = filters.limit ?? 20;
  // Dependência estável para useEffect.
  const categoriesKey = (filters.categories ?? []).slice().sort().join(",");

  const fetchPage = useCallback(
    async (options: ListPostsOptions, mode: "replace" | "append") => {
      if (!accountId) {
        setPosts([]);
        setStatus("idle");
        setHasMore(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);
      if (mode === "replace") setStatus("loading");

      try {
        const page = await repoListPosts(accountId, currentProfileId, options);

        if (mode === "replace") {
          setPosts(page);
          setStatus(page.length > 0 ? "ready" : "empty");
        } else {
          setPosts((current) => [...current, ...page]);
          setStatus("ready");
        }
        setHasMore(page.length === (options.limit ?? limit));
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar feed do Mural.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [accountId, currentProfileId, limit],
  );

  useEffect(() => {
    let isMounted = true;

    async function initialLoad() {
      if (!accountId) {
        if (!isMounted) return;
        setPosts([]);
        setStatus("idle");
        setHasMore(false);
        return;
      }

      const parsedCategories = categoriesKey
        ? (categoriesKey.split(",") as SocialPostCategory[])
        : undefined;

      try {
        if (!isMounted) return;
        setIsLoading(true);
        setErrorMessage(null);
        setStatus("loading");

        const page = await repoListPosts(accountId, currentProfileId, {
          limit,
          categories: parsedCategories,
        });

        if (!isMounted) return;
        setPosts(page);
        setStatus(page.length > 0 ? "ready" : "empty");
        setHasMore(page.length === limit);
      } catch (error) {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar feed do Mural.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void initialLoad();
    return () => {
      isMounted = false;
    };
  }, [accountId, currentProfileId, limit, categoriesKey]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || posts.length === 0) return;
    const last = posts[posts.length - 1];
    const parsedCategories = categoriesKey
      ? (categoriesKey.split(",") as SocialPostCategory[])
      : undefined;
    await fetchPage(
      {
        limit,
        categories: parsedCategories,
        cursorCreatedAt: last.post.createdAt,
      },
      "append",
    );
  }, [hasMore, isLoading, posts, categoriesKey, limit, fetchPage]);

  const refresh = useCallback(async () => {
    const parsedCategories = categoriesKey
      ? (categoriesKey.split(",") as SocialPostCategory[])
      : undefined;
    await fetchPage({ limit, categories: parsedCategories }, "replace");
  }, [categoriesKey, limit, fetchPage]);

  return {
    posts,
    isLoading,
    status,
    errorMessage,
    hasMore,
    loadMore,
    refresh,
  };
}

// ── useSocialPost ─────────────────────────────────────────────────

export interface UseSocialPostResult {
  post: SocialPostWithContext | null;
  comments: SocialComment[];
  isLoading: boolean;
  status: FetchStatus;
  errorMessage: string | null;
  refresh: () => Promise<void>;
}

/** Carrega um post isolado + seus comentários. */
export function useSocialPost(
  postId: string | null,
  currentProfileId: string | null,
): UseSocialPostResult {
  const [post, setPost] = useState<SocialPostWithContext | null>(null);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) {
      setPost(null);
      setComments([]);
      setStatus("idle");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setStatus("loading");
    try {
      const [loadedPost, loadedComments] = await Promise.all([
        repoGetPostById(postId, currentProfileId),
        repoListComments(postId),
      ]);
      setPost(loadedPost);
      setComments(loadedComments);
      setStatus(loadedPost ? "ready" : "empty");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao carregar post do Mural.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [postId, currentProfileId]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (!isMounted) return;
      await load();
    })();
    return () => {
      isMounted = false;
    };
  }, [load]);

  return { post, comments, isLoading, status, errorMessage, refresh: load };
}

// ── useSocialMutations ────────────────────────────────────────────

export interface UseSocialMutations {
  createPost: (input: CreateSocialPostInput) => Promise<void>;
  updatePost: (postId: string, input: UpdateSocialPostInput) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  hidePost: (postId: string, reason?: string | null) => Promise<void>;
  unhidePost: (postId: string) => Promise<void>;
  addReaction: (postId: string, reactionType: SocialReactionType) => Promise<void>;
  removeReaction: (postId: string, reactionType: SocialReactionType) => Promise<void>;
  addComment: (postId: string, content: string, parentCommentId?: string | null) => Promise<SocialComment | null>;
  updateComment: (commentId: string, content: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleBookmark: (postId: string) => Promise<{ bookmarked: boolean } | null>;
  isMutating: boolean;
  errorMessage: string | null;
}

/**
 * Mutations prontas pegando contexto de conta/perfil automaticamente.
 * Cada chamada é um `await` — a UI decide o que fazer depois (chamar
 * `refresh()` de um hook de listagem, ou atualizar estado local).
 */
export function useSocialMutations(): UseSocialMutations {
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const accountId = account?.accountId ?? null;
  const profileId = authenticatedProfile?.id ?? null;

  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function requireContext(action: string): { accountId: string; profileId: string } | null {
    if (!accountId || !profileId) {
      setErrorMessage(
        `Contexto de conta/perfil ausente para ${action}. Faça login e selecione um empreendimento.`,
      );
      return null;
    }
    return { accountId, profileId };
  }

  async function wrap<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    setIsMutating(true);
    setErrorMessage(null);
    try {
      return await fn();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : `Falha ao ${label}.`,
      );
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    isMutating,
    errorMessage,

    createPost: async (input) => {
      const ctx = requireContext("criar post");
      if (!ctx) return;
      await wrap("criar post", () =>
        repoCreatePost({
          ...input,
          accountId: ctx.accountId,
          authorProfileId: ctx.profileId,
        }),
      );
    },

    updatePost: async (postId, input) => {
      await wrap("atualizar post", () => repoUpdatePost(postId, input));
    },

    deletePost: async (postId) => {
      await wrap("deletar post", () => repoDeletePost(postId));
    },

    hidePost: async (postId, reason = null) => {
      const ctx = requireContext("esconder post");
      if (!ctx) return;
      await wrap("esconder post", () =>
        repoHidePost(postId, ctx.profileId, ctx.accountId, reason),
      );
    },

    unhidePost: async (postId) => {
      const ctx = requireContext("republicar post");
      if (!ctx) return;
      await wrap("republicar post", () =>
        repoUnhidePost(postId, ctx.profileId, ctx.accountId),
      );
    },

    addReaction: async (postId, reactionType) => {
      const ctx = requireContext("reagir ao post");
      if (!ctx) return;
      await wrap("reagir ao post", () =>
        repoAddReaction(postId, ctx.profileId, ctx.accountId, reactionType),
      );
    },

    removeReaction: async (postId, reactionType) => {
      const ctx = requireContext("remover reação");
      if (!ctx) return;
      await wrap("remover reação", () =>
        repoRemoveReaction(postId, ctx.profileId, reactionType),
      );
    },

    addComment: async (postId, content, parentCommentId = null) => {
      const ctx = requireContext("comentar");
      if (!ctx) return null;
      return wrap("comentar", () =>
        repoAddComment({
          postId,
          profileId: ctx.profileId,
          accountId: ctx.accountId,
          content,
          parentCommentId: parentCommentId ?? null,
        }),
      );
    },

    updateComment: async (commentId, content) => {
      await wrap("atualizar comentário", () =>
        repoUpdateComment(commentId, content),
      );
    },

    deleteComment: async (commentId) => {
      await wrap("deletar comentário", () => repoDeleteComment(commentId));
    },

    toggleBookmark: async (postId) => {
      const ctx = requireContext("salvar post");
      if (!ctx) return null;
      return wrap("salvar post", () =>
        repoToggleBookmark(postId, ctx.profileId, ctx.accountId),
      );
    },
  };
}

// ── useSocialBookmarks ────────────────────────────────────────────

export interface UseSocialBookmarksResult {
  bookmarks: SocialPostWithContext[];
  isLoading: boolean;
  status: FetchStatus;
  errorMessage: string | null;
  refresh: () => Promise<void>;
}

export function useSocialBookmarks(
  profileId: string | null,
): UseSocialBookmarksResult {
  const [bookmarks, setBookmarks] = useState<SocialPostWithContext[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) {
      setBookmarks([]);
      setStatus("idle");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setStatus("loading");
    try {
      const loaded = await repoListBookmarks(profileId);
      setBookmarks(loaded);
      setStatus(loaded.length > 0 ? "ready" : "empty");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao carregar bookmarks do Mural.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (!isMounted) return;
      await load();
    })();
    return () => {
      isMounted = false;
    };
  }, [load]);

  return { bookmarks, isLoading, status, errorMessage, refresh: load };
}

// ── useSocialPreferences ──────────────────────────────────────────

export interface UseSocialPreferencesResult {
  preferences: SocialUserPreferences | null;
  isLoading: boolean;
  errorMessage: string | null;
  updatePreferences: (
    prefs: UpdateSocialUserPreferencesInput,
  ) => Promise<SocialUserPreferences | null>;
  refresh: () => Promise<void>;
}

export function useSocialPreferences(
  profileId: string | null,
  accountId: string | null,
): UseSocialPreferencesResult {
  const [preferences, setPreferences] =
    useState<SocialUserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId || !accountId) {
      setPreferences(null);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const prefs = await repoGetUserPreferences(profileId, accountId);
      setPreferences(prefs);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao carregar preferências.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [profileId, accountId]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (!isMounted) return;
      await load();
    })();
    return () => {
      isMounted = false;
    };
  }, [load]);

  const updatePreferences = useCallback(
    async (prefs: UpdateSocialUserPreferencesInput) => {
      if (!profileId || !accountId) return null;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const updated = await repoUpsertUserPreferences(
          profileId,
          accountId,
          prefs,
        );
        setPreferences(updated);
        return updated;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar preferências.",
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [profileId, accountId],
  );

  return {
    preferences,
    isLoading,
    errorMessage,
    updatePreferences,
    refresh: load,
  };
}
