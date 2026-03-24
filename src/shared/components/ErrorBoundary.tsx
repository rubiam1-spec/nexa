import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: "24px" }}>
          <h2>Algo deu errado</h2>
          <p style={{ color: "#666", fontSize: "14px" }}>
            {this.state.error?.message ?? "Erro desconhecido"}
          </p>
          <button onClick={() => window.location.reload()}>
            Recarregar pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
