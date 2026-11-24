import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
    from: mocks.from,
  },
}));

vi.mock("./Auth", () => ({ default: () => <div>Formulaire d’authentification simulé</div> }));
vi.mock("./Annonces", () => ({ default: () => <div>Annonces simulées</div> }));
vi.mock("./Prix", () => ({ default: () => <div>Prix simulés</div> }));
vi.mock("./AgentIA", () => ({ default: () => <div>Assistant simulé</div> }));
vi.mock("./Accueil", () => ({ default: () => <div>Accueil simulé</div> }));
vi.mock("./TableauBord", () => ({ default: () => <div>Tableau de bord simulé</div> }));
vi.mock("./Admin", () => ({ default: () => <div>Administration simulée</div> }));
vi.mock("./DemandesAchat", () => ({ default: () => <div>Demandes simulées</div> }));

const utilisateurConnecte = { id: "user-1", email: "user@example.com" };

describe("App et gestion des rôles", () => {
  let roleProfil;
  let erreurProfil;

  beforeEach(() => {
    vi.clearAllMocks();
    roleProfil = "acheteur";
    erreurProfil = null;
    mocks.getSession.mockResolvedValue({
      data: { session: { user: utilisateurConnecte } },
    });
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: roleProfil ? { role: roleProfil } : null, error: erreurProfil }),
        }),
      }),
    }));
  });

  afterEach(() => cleanup());

  it("réserve la navigation d’administration au rôle admin", async () => {
    roleProfil = "admin";
    const utilisateur = userEvent.setup();
    render(<App />);

    await utilisateur.click(await screen.findByRole(
      "button",
      { name: "Administration" },
      { timeout: 5000 }
    ));
    expect(await screen.findByText("Administration simulée")).toBeTruthy();
    expect(mocks.from).toHaveBeenCalledWith("profiles");
  });

  it("n'affiche pas la navigation d’administration à un acheteur", async () => {
    const utilisateur = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("button", { name: "Mon tableau de bord" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Administration" })).toBeNull();
    await utilisateur.click(screen.getByRole("button", { name: "Déconnexion" }));
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it("signale une erreur si le profil Supabase est indisponible", async () => {
    erreurProfil = new Error("profil absent");
    const erreurConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Impossible de charger votre profil"
    );
    erreurConsole.mockRestore();
  });
});
