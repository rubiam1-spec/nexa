import { useEffect, useState } from "react";
import { getUsers as getMockUsers } from "../repositories/usersRepository";
import {
  getUsers as getSupabaseUsers,
  inviteUser as inviteSupabaseUser,
} from "../../../infra/repositories/usersSupabaseRepository";
import type { AccountUser } from "../../../shared/types/accountUser";

type UsersStatus = "idle" | "loading" | "mock" | "ready" | "empty" | "error";

export function useUsers(accountId: string | null, useMockFallback: boolean) {
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [status, setStatus] = useState<UsersStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!accountId) {
          if (!isMounted) {
            return;
          }

          setUsers([]);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        if (useMockFallback) {
          const mockUsers = getMockUsers();

          if (!isMounted) {
            return;
          }

          setUsers(mockUsers);
          setStatus(mockUsers.length > 0 ? "mock" : "empty");
          return;
        }

        const realUsers = await getSupabaseUsers(accountId);

        if (!isMounted) {
          return;
        }

        setUsers(realUsers);
        setStatus(realUsers.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setUsers([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar usuarios da conta ativa.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, [accountId, useMockFallback]);

  async function inviteUser(input: {
    email: string;
    fullName: string;
    role: import("../../../shared/types/auth").UserRole;
  }): Promise<AccountUser | null> {
    if (!accountId) {
      setErrorMessage("Conta ativa necessária para convidar usuário.");
      return null;
    }

    try {
      setIsInviting(true);
      setErrorMessage(null);

      const newUser = await inviteSupabaseUser({
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        accountId,
      });

      setUsers((current) => [newUser, ...current]);
      setStatus("ready");
      return newUser;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao convidar usuário.",
      );
      return null;
    } finally {
      setIsInviting(false);
    }
  }

  return {
    users,
    isLoading,
    isInviting,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    inviteUser,
  };
}
