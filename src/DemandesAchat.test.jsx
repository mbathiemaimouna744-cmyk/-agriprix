import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DemandesAchat from "./DemandesAchat";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: { from: vi.fn() },
}));

const acheteur = { id: "buyer-1" };

describe("DemandesAchat", () => {
  let insertion;
  let demandeCreee;

  beforeEach(() => {
    vi.clearAllMocks();
    demandeCreee = {
      id: 7,
      buyer_id: acheteur.id,
      produit: "Oignon",
      quantite_kg: 25,
      region: "Ziguinchor",
      prix_maximum_kg: 300,
      telephone: "771234567",
      created_at: "2026-11-24T12:00:00Z",
    };
    insertion = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: demandeCreee, error: null }),
      }),
    }));
    supabase.from.mockReturnValue({
      select: () => ({
        order: async () => ({ data: [], error: null }),
      }),
      insert: insertion,
    });
  });

  afterEach(() => cleanup());

  const remplirFormulaire = async (utilisateur) => {
    await utilisateur.type(
      screen.getByPlaceholderText("Produit recherché (ex. oignon)"),
      "  Oignon  "
    );
    await utilisateur.type(screen.getByPlaceholderText("Quantité souhaitée (kg)"), "25");
    await utilisateur.type(screen.getByPlaceholderText("Région souhaitée"), "  Ziguinchor  ");
    await utilisateur.type(
      screen.getByPlaceholderText("Prix maximum souhaité (FCFA/kg, facultatif)"),
      "300"
    );
    await utilisateur.type(screen.getByPlaceholderText("Téléphone (ex. 771234567)"), "771234567");
  };

  it("publie une demande valide après consentement et affiche le résultat", async () => {
    const utilisateur = userEvent.setup();
    render(<DemandesAchat user={acheteur} role="acheteur" />);

    await remplirFormulaire(utilisateur);
    await utilisateur.click(screen.getByLabelText(/mon numéro soit visible/i));
    await utilisateur.click(screen.getByRole("button", { name: "Publier la demande" }));

    expect(await screen.findByRole("heading", { name: "Oignon" })).toBeTruthy();
    expect(insertion).toHaveBeenCalledWith({
      buyer_id: "buyer-1",
      produit: "Oignon",
      quantite_kg: 25,
      region: "Ziguinchor",
      prix_maximum_kg: 300,
      telephone: "771234567",
    });
    expect(screen.getByRole("checkbox").checked).toBe(false);
  });

  it("refuse de publier si l'acheteur n'autorise pas l'affichage du téléphone", async () => {
    const utilisateur = userEvent.setup();
    render(<DemandesAchat user={acheteur} role="acheteur" />);

    await remplirFormulaire(utilisateur);
    await utilisateur.click(screen.getByRole("button", { name: "Publier la demande" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Confirmez que votre numéro peut être affiché publiquement"
    );
    expect(insertion).not.toHaveBeenCalled();
  });
});
