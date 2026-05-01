import AppProviders from "./app/providers/AppProviders";
import AppRouter from "./app/router/AppRouter";
import { ThemeProvider } from "./shared/theme";

export default function App() {
  return (
    <ThemeProvider>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ThemeProvider>
  );
}
