import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "../../shared/components/ErrorBoundary";
import AppLayout from "../layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import RequireDevelopment from "./RequireDevelopment";
import LoginPage from "../../modules/auth/pages/LoginPage";
import SelectDevelopmentPage from "../../modules/developments/pages/SelectDevelopmentPage";
import DashboardPage from "../../modules/dashboard/pages/DashboardPage";
import NegotiationsPage from "../../modules/negociacoes/pages/NegotiationsPage";
import NegotiationDetailPage from "../../modules/negociacoes/pages/NegotiationDetailPage";
import ClientsPage from "../../modules/clientes/pages/ClientsPage";
import ClientDetailPage from "../../modules/clientes/pages/ClientDetailPage";
import BrokersPage from "../../modules/corretores/pages/BrokersPage";
import BrokerDetailPage from "../../modules/corretores/pages/BrokerDetailPage";
import BrokeragesPage from "../../modules/imobiliarias/pages/BrokeragesPage";
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
import MeuDiaPage from "../../modules/meudia/pages/MeuDiaPage";
import FeedPage from "../../modules/feed/pages/FeedPage";
import LandingPage from "../../pages/LandingPage";

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
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
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
              <MeuDiaPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedAppPage>
              <DashboardPage />
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
        <Route
          path="/clientes"
          element={
            <ProtectedAppPage>
              <ClientsPage />
            </ProtectedAppPage>
          }
        />
        <Route
          path="/clientes/:id"
          element={
            <ProtectedAppPage>
              <ClientDetailPage />
            </ProtectedAppPage>
          }
        />
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
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
