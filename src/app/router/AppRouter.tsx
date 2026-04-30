import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "../../shared/components/ErrorBoundary";
import AppLayout from "../layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import RequireDevelopment from "./RequireDevelopment";
import LoginPage from "../../modules/auth/pages/LoginPage";
import PublicPropertyPage from "../../pages/PublicPropertyPage";
import SelectDevelopmentPage from "../../modules/developments/pages/SelectDevelopmentPage";
import CentralPage from "../../modules/central/pages/CentralPage";
// Dashboard merged into Central (MeuDiaPage → CentralPage V4)
import NegotiationsPage from "../../modules/negociacoes/pages/NegotiationsPage";
import NegotiationDetailPage from "../../modules/negociacoes/pages/NegotiationDetailPage";

import BrokersPage from "../../modules/corretores/pages/BrokersPage";
import BrokerDetailPage from "../../modules/corretores/pages/BrokerDetailPage";
import BrokeragesPage from "../../modules/imobiliarias/pages/BrokeragesPage";
import BrokerageDetailPage from "../../modules/imobiliarias/pages/BrokerageDetailPage";
import UsersPage from "../../modules/usuarios/pages/UsersPage";
import UnitsPage from "../../modules/units/pages/UnitsPage";
import SettingsPage from "../../modules/configuracoes/pages/SettingsPage";
import DevelopmentsPage from "../../modules/empreendimentos/pages/DevelopmentsPage";
import DevelopmentDetailPage from "../../modules/empreendimentos/pages/DevelopmentDetailPage";
import SimuladorPage from "../../modules/simulador/pages/SimuladorPage";
import KanbanPage from "../../modules/negociacoes/pages/KanbanPage";
import GoogleCallbackPage from "../../modules/auth/pages/GoogleCallbackPage";
import DefinirSenhaPage from "../../modules/auth/pages/DefinirSenhaPage";
import RecuperarSenhaPage from "../../modules/auth/pages/RecuperarSenhaPage";
import EsqueciSenhaPage from "../../modules/auth/pages/EsqueciSenhaPage";
import SuperadminPage from "../../modules/superadmin/pages/SuperadminPage";
import ProfilePage from "../../modules/perfil/pages/ProfilePage";
import MateriaisPage from "../../modules/materiais/pages/MateriaisPage";
import AtividadesPage from "../../modules/atividades/pages/AtividadesPage";
import RelatoriosPage from "../../modules/relatorios/pages/RelatoriosPage";

import FeedPage from "../../modules/feed/pages/FeedPage";
import NotificacoesPage from "../../modules/notificacoes/pages/NotificacoesPage";
import ThirdPartyPropertiesPage from "../../modules/imoveis/pages/ThirdPartyPropertiesPage";
import ThirdPartyPropertyFormPage from "../../modules/imoveis/pages/ThirdPartyPropertyFormPage";
import ThirdPartyPropertyDetailPage from "../../modules/imoveis/pages/ThirdPartyPropertyDetailPage";
import ContatosPage from "../../modules/contatos/pages/ContatosPage";
import ContatoFormPage from "../../modules/contatos/pages/ContatoFormPage";
import ImportarContatosPage from "../../modules/contatos/pages/ImportarContatosPage";
import ContatoDetailPage from "../../modules/clientes/pages/ClientDetailPage";
import LandingPage from "../../pages/LandingPage";
import ShareLinkPage from "../../pages/ShareLinkPage";
import RelacionamentoPage from "../../modules/relacionamento/pages/RelacionamentoPage";

function ProtectedAppPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RequireDevelopment>
        <AppLayout>{children}</AppLayout>
      </RequireDevelopment>
    </ProtectedRoute>
  );
}

export default function AppRouter() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/imoveis/ver/:id" element={<PublicPropertyPage />} />
        <Route path="/p/:slug" element={<PublicPropertyPage />} />
        <Route path="/s/:slug" element={<ShareLinkPage />} />
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/auth/callback" element={<DefinirSenhaPage />} />
        <Route path="/auth/definir-senha" element={<DefinirSenhaPage />} />
        <Route path="/auth/recuperar-senha" element={<RecuperarSenhaPage />} />
        <Route path="/auth/esqueci-senha" element={<EsqueciSenhaPage />} />
        <Route path="/superadmin" element={<ProtectedRoute><SuperadminPage /></ProtectedRoute>} />
        <Route
          path="/selecionar-empreendimento"
          element={
            <ProtectedRoute>
              <SelectDevelopmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedAppPage>
              <CentralPage />
            </ProtectedAppPage>
          }
        />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/meu-dia" element={<Navigate to="/" replace />} />
        <Route path="/central" element={<Navigate to="/" replace />} />
        <Route
          path="/notificacoes"
          element={
            <ProtectedAppPage>
              <NotificacoesPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/simulador"
          element={
            <ProtectedAppPage>
              <SimuladorPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/unidades"
          element={
            <ProtectedAppPage>
              <UnitsPage />
            </ProtectedAppPage>
          }
        />
        <Route path="/contatos" element={<ProtectedAppPage><ContatosPage /></ProtectedAppPage>} />
        <Route path="/contatos/novo" element={<ProtectedAppPage><ContatoFormPage /></ProtectedAppPage>} />
        <Route path="/contatos/importar" element={<ProtectedAppPage><ImportarContatosPage /></ProtectedAppPage>} />
        <Route path="/contatos/:id" element={<ProtectedAppPage><ContatoDetailPage /></ProtectedAppPage>} />
        {/* Redirects from old routes */}
        <Route path="/leads" element={<Navigate to="/contatos?tab=leads" replace />} />
        <Route path="/leads/novo" element={<Navigate to="/contatos/novo" replace />} />
        <Route path="/leads/:id" element={<Navigate to="/contatos/:id" replace />} />
        <Route path="/imoveis" element={<ProtectedAppPage><ThirdPartyPropertiesPage /></ProtectedAppPage>} />
        <Route path="/imoveis/novo" element={<ProtectedAppPage><ThirdPartyPropertyFormPage /></ProtectedAppPage>} />
        <Route path="/imoveis/:id/editar" element={<ProtectedAppPage><ThirdPartyPropertyFormPage /></ProtectedAppPage>} />
        <Route path="/imoveis/:id" element={<ProtectedAppPage><ThirdPartyPropertyDetailPage /></ProtectedAppPage>} />
        <Route
          path="/negociacoes"
          element={
            <ProtectedAppPage>
              <NegotiationsPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/negociacoes/:id"
          element={
            <ProtectedAppPage>
              <NegotiationDetailPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/pipeline"
          element={
            <ProtectedAppPage>
              <KanbanPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/empreendimentos"
          element={
            <ProtectedAppPage>
              <DevelopmentsPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/empreendimentos/:id"
          element={
            <ProtectedAppPage>
              <DevelopmentDetailPage />
            </ProtectedAppPage>
          }
        />
        <Route path="/clientes" element={<Navigate to="/contatos" replace />} />
        <Route path="/clientes/:id" element={<Navigate to="/contatos/:id" replace />} />
        <Route
          path="/corretores"
          element={
            <ProtectedAppPage>
              <BrokersPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/corretores/:id"
          element={
            <ProtectedAppPage>
              <BrokerDetailPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/imobiliarias"
          element={
            <ProtectedAppPage>
              <BrokeragesPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/imobiliarias/:id"
          element={
            <ProtectedAppPage>
              <BrokerageDetailPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedAppPage>
              <UsersPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/mapa"
          element={<Navigate to="/unidades?view=mapa" replace />}
        />
        <Route
          path="/feed"
          element={
            <ProtectedAppPage>
              <FeedPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/atividades"
          element={
            <ProtectedAppPage>
              <AtividadesPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/relatorios"
          element={
            <ProtectedAppPage>
              <RelatoriosPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/materiais"
          element={
            <ProtectedAppPage>
              <MateriaisPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/perfil"
          element={
            <ProtectedAppPage>
              <ProfilePage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <ProtectedAppPage>
              <SettingsPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/relacionamento"
          element={
            <ProtectedAppPage>
              <RelacionamentoPage />
            </ProtectedAppPage>
          }
        />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
