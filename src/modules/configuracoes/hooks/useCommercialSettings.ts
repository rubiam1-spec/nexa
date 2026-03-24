import { useEffect, useState } from "react";
import { assertPermission } from "../../../app/authorization/assertPermission";
import { PermissionAction } from "../../../app/authorization/permissions";
import { resolveCommercialSettings } from "../../../app/settings/resolveCommercialSettings";
import type { AccountSettings } from "../../../shared/types/accountSettings";
import type { CommercialSettings } from "../../../shared/types/commercialSettings";
import type { DevelopmentSettings } from "../../../shared/types/developmentSettings";
import type { UserRole } from "../../../shared/types/auth";
import {
  getAccountSettings as getMockAccountSettings,
  updateAccountSettings as updateMockAccountSettings,
} from "../repositories/accountSettingsRepository";
import {
  getDevelopmentSettings as getMockDevelopmentSettings,
  updateDevelopmentSettings as updateMockDevelopmentSettings,
} from "../repositories/developmentSettingsRepository";
import {
  getAccountSettings as getSupabaseAccountSettings,
  updateAccountSettings as updateSupabaseAccountSettings,
} from "../../../infra/repositories/accountSettingsSupabaseRepository";
import {
  getDevelopmentSettings as getSupabaseDevelopmentSettings,
  updateDevelopmentSettings as updateSupabaseDevelopmentSettings,
} from "../../../infra/repositories/developmentSettingsSupabaseRepository";

type CommercialSettingsStatus =
  | "idle"
  | "loading"
  | "mock"
  | "ready"
  | "error";

export function useCommercialSettings(
  accountId: string | null,
  developmentId: string | null,
  useMockFallback: boolean,
  actorRole: UserRole | null,
) {
  const [accountSettings, setAccountSettings] = useState<AccountSettings | null>(null);
  const [developmentSettings, setDevelopmentSettings] =
    useState<DevelopmentSettings | null>(null);
  const [effectiveSettings, setEffectiveSettings] =
    useState<CommercialSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<CommercialSettingsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setErrorMessage(null);
        }

        if (!accountId || !developmentId) {
          if (!isMounted) {
            return;
          }

          setAccountSettings(null);
          setDevelopmentSettings(null);
          setEffectiveSettings(null);
          setStatus("idle");
          return;
        }

        if (!isMounted) {
          return;
        }

        setStatus("loading");

        const nextAccountSettings = useMockFallback
          ? getMockAccountSettings(accountId)
          : await getSupabaseAccountSettings(accountId);
        const nextDevelopmentSettings = useMockFallback
          ? getMockDevelopmentSettings(accountId, developmentId)
          : await getSupabaseDevelopmentSettings(accountId, developmentId);

        if (!isMounted) {
          return;
        }

        setAccountSettings(nextAccountSettings);
        setDevelopmentSettings(nextDevelopmentSettings);
        setEffectiveSettings(
          resolveCommercialSettings({
            accountSettings: nextAccountSettings,
            developmentId,
            developmentSettings: nextDevelopmentSettings,
          }),
        );
        setStatus(useMockFallback ? "mock" : "ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAccountSettings(null);
        setDevelopmentSettings(null);
        setEffectiveSettings(null);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar configuracoes comerciais.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [accountId, developmentId, useMockFallback]);

  async function updateAccount(
    input: Partial<
      Omit<AccountSettings, "accountId" | "updatedAt">
    >,
  ) {
    if (!accountId || !developmentId || !accountSettings) {
      throw new Error("Conta ativa indisponivel para atualizar configuracoes.");
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        PermissionAction.UPDATE_SETTINGS,
        "Perfil sem permissao para alterar configuracoes.",
      );

      const nextAccountSettings = useMockFallback
        ? updateMockAccountSettings(accountId, input)
        : await updateSupabaseAccountSettings(accountId, input);

      setAccountSettings(nextAccountSettings);
      setEffectiveSettings(
        resolveCommercialSettings({
          accountSettings: nextAccountSettings,
          developmentId,
          developmentSettings,
        }),
      );
      setStatus(useMockFallback ? "mock" : "ready");

      return nextAccountSettings;
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar configuracoes da conta.",
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function updateDevelopment(
    input: Partial<
      Omit<DevelopmentSettings, "accountId" | "developmentId" | "updatedAt">
    >,
  ) {
    if (!accountId || !developmentId || !accountSettings) {
      throw new Error(
        "Conta ou empreendimento ativos indisponiveis para atualizar configuracoes.",
      );
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      assertPermission(
        actorRole,
        PermissionAction.UPDATE_SETTINGS,
        "Perfil sem permissao para alterar configuracoes.",
      );

      const nextDevelopmentSettings = useMockFallback
        ? updateMockDevelopmentSettings(accountId, developmentId, input)
        : await updateSupabaseDevelopmentSettings(
            accountId,
            developmentId,
            input,
          );

      setDevelopmentSettings(nextDevelopmentSettings);
      setEffectiveSettings(
        resolveCommercialSettings({
          accountSettings,
          developmentId,
          developmentSettings: nextDevelopmentSettings,
        }),
      );
      setStatus(useMockFallback ? "mock" : "ready");

      return nextDevelopmentSettings;
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar configuracoes do empreendimento.",
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    accountSettings,
    developmentSettings,
    effectiveSettings,
    isLoading,
    isSaving,
    isUsingMock: status === "mock",
    status,
    errorMessage,
    updateAccountSettings: updateAccount,
    updateDevelopmentSettings: updateDevelopment,
  };
}
