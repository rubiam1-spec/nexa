const mockFallbackFlag = import.meta.env.VITE_ENABLE_MOCK_FALLBACK;

export const isMockFallbackEnabled =
  mockFallbackFlag === "true" || (import.meta.env.DEV && mockFallbackFlag !== "false");
