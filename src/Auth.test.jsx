import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "./Auth";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}));

describe("Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("transmet le rôle choisi lors de la création du compte", async () => {
    const utilisateur = userEvent.setup();
    supabase.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    render(<Auth />);

    await utilisateur.type(screen.getByPlaceholderText("Email"), "acheteur@example.com");
    await utilisateur.type(
      screen.getByPlaceholderText("Mot de passe (6 caractères min.)"),
      "motdepasse"
    );
    await utilisateur.selectOptions(
      screen.getByLabelText("Profil (pour la création du compte)"),
      "acheteur"
    );
    await utilisateur.click(screen.getByRole("button", { name: "Créer un compte" }));

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "acheteur@example.com",
      password: "motdepasse",
      options: { data: { role: "acheteur" } },
    });
    expect(await screen.findByText(
      "Compte créé. Vérifiez votre e-mail pour confirmer l'inscription."
    )).toBeTruthy();
  });

  it("affiche l'erreur retournée par la connexion", async () => {
    const utilisateur = userEvent.setup();
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: "Identifiants invalides" },
    });
    render(<Auth />);

    await utilisateur.type(screen.getByPlaceholderText("Email"), "acheteur@example.com");
    await utilisateur.type(
      screen.getByPlaceholderText("Mot de passe (6 caractères min.)"),
      "incorrect"
    );
    await utilisateur.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Identifiants invalides")).toBeTruthy();
  });
});
