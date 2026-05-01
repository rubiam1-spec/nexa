import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import UserMenu from "../UserMenu";

const baseProfile = {
  fullName: "Rubiam Rodrigues",
  email: "rubiam1@icloud.com",
  avatarUrl: null,
};

const baseAccount = { role: "Diretor", accountName: "Bomm Urbanismo" };

function renderMenu(overrides: Partial<Parameters<typeof UserMenu>[0]> = {}) {
  const handlers = {
    onProfile: vi.fn(),
    onSettings: vi.fn(),
    onSwitchDevelopment: vi.fn(),
    onSwitchAccount: vi.fn(),
    onSignOut: vi.fn(),
  };
  const utils = render(
    <UserMenu profile={baseProfile} account={baseAccount} {...handlers} {...overrides} />,
  );
  return { ...utils, ...handlers };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<UserMenu />", () => {
  it("dropdown fica fechado por padrão", () => {
    renderMenu();
    expect(screen.queryByTestId("usermenu-dropdown")).not.toBeInTheDocument();
  });

  it("abre ao clicar no trigger", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("usermenu-trigger"));
    expect(screen.getByTestId("usermenu-dropdown")).toBeInTheDocument();
  });

  it("fecha ao clicar fora (document mousedown)", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("usermenu-trigger"));
    expect(screen.getByTestId("usermenu-dropdown")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("usermenu-dropdown")).not.toBeInTheDocument();
  });

  it("fecha ao pressionar ESC", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("usermenu-trigger"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("usermenu-dropdown")).not.toBeInTheDocument();
  });

  it("fecha ao clicar em um item do menu", () => {
    const { onProfile } = renderMenu();
    fireEvent.click(screen.getByTestId("usermenu-trigger"));
    fireEvent.click(screen.getByTestId("usermenu-item-profile"));
    // Dropdown fecha imediatamente; callback roda via setTimeout(0).
    expect(screen.queryByTestId("usermenu-dropdown")).not.toBeInTheDocument();
    vi.runAllTimers();
    expect(onProfile).toHaveBeenCalledTimes(1);
  });

  it("renderiza nome, email e role · accountName no header", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("usermenu-trigger"));
    expect(screen.getByTestId("usermenu-name").textContent).toBe("Rubiam Rodrigues");
    expect(screen.getByTestId("usermenu-email").textContent).toBe("rubiam1@icloud.com");
    expect(screen.getByTestId("usermenu-context").textContent).toBe("Diretor · Bomm Urbanismo");
  });

  it("item 'Sair' é marcado como danger (Red)", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("usermenu-trigger"));
    const signout = screen.getByTestId("usermenu-item-signout");
    expect(signout.getAttribute("data-danger")).toBe("true");
    // Confirma cor vermelha nas duas facetas (ícone + texto).
    expect((signout as HTMLButtonElement).style.color).toBe("rgb(248, 113, 113)");
  });

  it("dispara os 5 callbacks corretos ao clicar em cada item", () => {
    const { onProfile, onSettings, onSwitchDevelopment, onSwitchAccount, onSignOut } = renderMenu();
    const trigger = screen.getByTestId("usermenu-trigger");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("usermenu-item-settings"));
    vi.runAllTimers();
    expect(onSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("usermenu-item-switch-development"));
    vi.runAllTimers();
    expect(onSwitchDevelopment).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("usermenu-item-switch-account"));
    vi.runAllTimers();
    expect(onSwitchAccount).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("usermenu-item-signout"));
    vi.runAllTimers();
    expect(onSignOut).toHaveBeenCalledTimes(1);

    // Profile: só agora — precisa reabrir porque cada click fecha.
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("usermenu-item-profile"));
    vi.runAllTimers();
    expect(onProfile).toHaveBeenCalledTimes(1);
  });

  it("avatar do trigger usa avatarUrl quando existe", () => {
    renderMenu({
      profile: { ...baseProfile, avatarUrl: "https://example.test/r.png" },
    });
    const trigger = screen.getByTestId("usermenu-trigger");
    const img = trigger.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.test/r.png");
  });

  it("avatar do trigger mostra iniciais quando avatarUrl é null", () => {
    renderMenu();
    const trigger = screen.getByTestId("usermenu-trigger");
    expect(trigger.querySelector("img")).toBeNull();
    // Avatar componente joga as iniciais como text node do div.
    expect(trigger.textContent).toBe("RR");
  });
});
