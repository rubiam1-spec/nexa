import "@testing-library/jest-dom";

const mockChain = () => {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "update", "delete", "upsert",
    "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike",
    "in", "is", "not", "or", "and", "filter",
    "order", "limit", "range", "single", "maybeSingle",
    "csv", "count", "head",
    "match", "textSearch",
    "contains", "containedBy", "overlap",
    "throwOnError",
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve({ data: [], error: null }));
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return chain;
};

vi.mock("../infra/supabase/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => mockChain()),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@nexa.com" } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user-id" }, access_token: "mock-token" } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://test.supabase.co/test.jpg" } }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://test.supabase.co/signed" }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const store: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
  },
});

// Observers como CLASSES (construtores reais) — cmdk/Radix fazem `new X()`.
class MockObserver {
  observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
}
globalThis.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver = MockObserver as unknown as typeof ResizeObserver;

// Polyfills p/ Radix/cmdk em jsdom (pointer capture + scroll).
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = vi.fn(() => false) as unknown as typeof Element.prototype.hasPointerCapture;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = vi.fn() as unknown as typeof Element.prototype.setPointerCapture;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = vi.fn() as unknown as typeof Element.prototype.releasePointerCapture;
Element.prototype.scrollIntoView = vi.fn();

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("React")) return;
  originalWarn.apply(console, args);
};
