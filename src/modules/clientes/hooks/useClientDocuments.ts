import { useCallback, useEffect, useState } from "react";
import {
  listClientDocuments,
  listChecklist,
  uploadClientDocument,
  reviewClientDocument,
  approveClientDocuments,
  resetClientDocument,
  recalcClientDocStatus,
  getDocUploader,
  listAccountManagers,
  type ClientDoc,
  type ChecklistType,
} from "../../../infra/repositories/clientDocumentsSupabaseRepository";
import { createNotificationWithEmail, createNotificationsWithEmail } from "../../../shared/utils/notificationHelper";

export type { ClientDoc, ChecklistType };

interface UseClientDocumentsOptions {
  clientId: string | null;
  accountId: string | null;
  developmentId: string | null; // empreendimento do CLIENTE
  userId: string | null;
  clientName: string;
  accountName?: string | null;
  developmentName?: string | null;
  onToast: (msg: string) => void;
}

// Toda a regra de documentos do cliente (carregar, checklist canônico via
// requirements+catalog, upload em bucket privado, aprovar/recusar/lote/remover,
// notificações e recálculo de doc_status) vive aqui — o componente só renderiza.
export function useClientDocuments(opts: UseClientDocumentsOptions) {
  const { clientId, accountId, developmentId, userId, clientName, accountName, developmentName, onToast } = opts;
  const [documents, setDocuments] = useState<ClientDoc[]>([]);
  const [checklistTypes, setChecklistTypes] = useState<ChecklistType[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  const reload = useCallback(async () => {
    if (!clientId || !accountId) return;
    try {
      const [docs, checklist] = await Promise.all([
        listClientDocuments(clientId),
        listChecklist(developmentId, accountId),
      ]);
      setDocuments(docs);
      setChecklistTypes(checklist);
    } catch (err) {
      console.error("[useClientDocuments] load error", err);
    }
  }, [clientId, accountId, developmentId]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!clientId || !accountId) { setDocuments([]); setChecklistTypes([]); return; }
      setLoading(true);
      try {
        const [docs, checklist] = await Promise.all([
          listClientDocuments(clientId),
          listChecklist(developmentId, accountId),
        ]);
        if (!active) return;
        setDocuments(docs);
        setChecklistTypes(checklist);
      } catch (err) {
        if (active) console.error("[useClientDocuments] load error", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [clientId, accountId, developmentId]);

  const labelFor = useCallback(
    (docType: string | undefined) => checklistTypes.find((c) => c.key === docType)?.label || docType || "Documento",
    [checklistTypes],
  );

  const upload = useCallback(async (file: File, docType: string) => {
    if (!clientId || !accountId || !userId) return;
    setUploadingDocType(docType);
    try {
      const { signedUrl, storagePath } = await uploadClientDocument({ clientId, accountId, docType, file, userId });
      // Otimista
      setDocuments((prev) => {
        const existing = prev.find((d) => d.document_type === docType);
        const newDoc: ClientDoc = {
          id: existing?.id || crypto.randomUUID(),
          document_type: docType, file_url: signedUrl, file_name: file.name,
          file_size: file.size, file_size_bytes: file.size, mime_type: file.type,
          storage_path: storagePath, uploaded_by: userId, status: "sent",
          rejection_reason: null, created_at: new Date().toISOString(),
          is_required: existing?.is_required ?? true, label: existing?.label ?? null,
        };
        if (existing) return prev.map((d) => d.document_type === docType ? { ...d, ...newDoc } : d);
        return [...prev, newDoc];
      });
      onToast("Documento enviado");
      void reload();
    } catch (e) {
      console.error(e); onToast("Erro no upload"); void reload();
    } finally {
      setUploadingDocType(null);
    }
  }, [clientId, accountId, userId, onToast, reload]);

  const review = useCallback(async (docId: string, action: "approved" | "rejected", reason?: string) => {
    if (!userId || !clientId || !accountId) return;
    setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, status: action, rejection_reason: reason || null } : d));
    try {
      await reviewClientDocument(docId, action, reason || null, userId);
      const doc = documents.find((d) => d.id === docId);
      const docLabel = labelFor(doc?.document_type);

      // Notifica quem enviou (e-mail em recusas)
      const uploader = await getDocUploader(docId);
      if (uploader && uploader !== userId) {
        void createNotificationWithEmail({
          account_id: accountId, recipient_id: uploader, sender_id: userId,
          type: action === "approved" ? "doc_approved" : "doc_rejected",
          title: action === "approved" ? `Documento aprovado: ${docLabel}` : `Documento recusado: ${docLabel}`,
          message: action === "approved"
            ? `${docLabel} de ${clientName} foi aprovado.`
            : `${docLabel} de ${clientName} foi recusado. Motivo: ${reason || "Não informado"}. Por favor reenvie.`,
          action_url: `/contatos/${clientId}?tab=documentos`,
          metadata: { account_name: accountName, development_name: developmentName },
        });
      }

      const { approved, total } = await recalcClientDocStatus(clientId);
      if (total > 0 && approved === total) {
        const managers = await listAccountManagers(accountId);
        const notifs = managers.filter((m) => m !== userId).map((m) => ({
          account_id: accountId, recipient_id: m, sender_id: userId,
          type: "client_ready_for_contract", title: "Cliente pronto para contrato",
          message: `Todos os documentos de ${clientName} foram aprovados. Pronto para minuta.`,
          action_url: `/contatos/${clientId}`,
          metadata: { account_name: accountName, development_name: developmentName },
        }));
        if (notifs.length > 0) void createNotificationsWithEmail(notifs);
      }
      onToast(action === "approved" ? "Documento aprovado" : "Documento rejeitado");
    } catch (e) {
      console.error(e); onToast("Erro ao revisar");
    } finally {
      void reload();
    }
  }, [userId, clientId, accountId, documents, labelFor, clientName, accountName, developmentName, onToast, reload]);

  const approveAll = useCallback(async () => {
    if (!userId || !clientId || !accountId) return;
    const uploadedDocs = documents.filter((d) => d.status === "uploaded" || d.status === "sent");
    if (uploadedDocs.length === 0) return;
    setApprovingAll(true);
    const ids = new Set(uploadedDocs.map((d) => d.id));
    setDocuments((prev) => prev.map((d) => ids.has(d.id) ? { ...d, status: "approved", rejection_reason: null } : d));
    try {
      await approveClientDocuments(uploadedDocs.map((d) => d.id), userId);
      const { approved, total } = await recalcClientDocStatus(clientId);
      if (total > 0 && approved === total) {
        const managers = await listAccountManagers(accountId);
        const notifs = managers.filter((m) => m !== userId).map((m) => ({
          account_id: accountId, recipient_id: m, sender_id: userId,
          type: "client_ready_for_contract", title: "Cliente pronto para contrato",
          message: `Todos os documentos de ${clientName} foram aprovados. Pronto para minuta.`,
          action_url: `/contatos/${clientId}`,
          metadata: { account_name: accountName, development_name: developmentName },
        }));
        if (notifs.length > 0) void createNotificationsWithEmail(notifs);
      }
      onToast(`${uploadedDocs.length} documento(s) aprovado(s)`);
    } catch (e) {
      console.error(e); onToast("Erro ao aprovar documentos");
    } finally {
      setApprovingAll(false);
      void reload();
    }
  }, [userId, clientId, accountId, documents, clientName, accountName, developmentName, onToast, reload]);

  const remove = useCallback(async (docId: string, storagePath: string | null) => {
    if (!clientId) return;
    setDocuments((prev) => prev.map((d) => d.id === docId
      ? { ...d, status: "pending", storage_path: null, file_url: "", file_name: null, file_size: null, file_size_bytes: null, mime_type: null, rejection_reason: null }
      : d));
    onToast("Arquivo removido");
    try {
      await resetClientDocument(docId, storagePath);
    } catch (e) {
      console.error(e); onToast("Erro ao remover");
    } finally {
      void reload();
    }
  }, [clientId, onToast, reload]);

  return {
    documents, checklistTypes, loading,
    uploadingDocType, setUploadingDocType, approvingAll,
    upload, review, approveAll, remove, reload,
  };
}
