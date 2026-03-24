import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import BrokersPage from "../../modules/corretores/pages/BrokersPage";
import BrokeragesPage from "../../modules/imobiliarias/pages/BrokeragesPage";
import UsersPage from "../../modules/usuarios/pages/UsersPage";
import UnitsPage from "../../modules/units/pages/UnitsPage";
import SettingsPage from "../../modules/configuracoes/pages/SettingsPage";
import DevelopmentsPage from "../../modules/empreendimentos/pages/DevelopmentsPage";
import DevelopmentDetailPage from "../../modules/empreendimentos/pages/DevelopmentDetailPage";
import SimuladorPage from "../../modules/simulador/pages/SimuladorPage";
import GoogleCallbackPage from "../../modules/auth/pages/GoogleCallbackPage";

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
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
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
          path="/corretores"
          element={
            <ProtectedAppPage>
              <BrokersPage />
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
