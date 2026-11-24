import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Annonces from "./Annonces";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
}));

const agriculteur = { id: "seller-1" };

describe("Annonces", () => {
  let miseAJour;

  beforeEach(() => {
    vi.clearAllMocks();
    const annonce = {
      id: "ad-1",
      user_id: agriculteur.id,
      produit: "Oignon",
      quantite_kg: 50,
      prix_kg: 500,
      region: "Ziguinchor",
      telephone: "771234567",
      image_path: null,
      statut: "disponible",
      expires_at: "2026-12-20T00:00:00.000Z",
      created_at: "2026-11-23T00:00:00.000Z",
    };
    const resultats = {
      annonces: { data: [annonce], error: null },
      prix_marche: { data: [], error: null },
      evaluations: { data: [], error: null },
    };
    miseAJour = vi.fn();

    supabase.from.mockImplementation((table) => {
      const requete = {
        eq: vi.fn(() => requete),
        gt: vi.fn(() => requete),
        order: vi.fn(async () => resultats[table]),
      };
      return {
        select: vi.fn(() => requete),
        update: vi.fn((valeurs) => {
          miseAJour(valeurs);
          const modification = {
            eq: vi.fn(() => modification),
            select: vi.fn(() => modification),
            single: vi.fn(async () => ({ data: { id: annonce.id }, error: null })),
          };
          return modification;
        }),
      };
    });
  });

  afterEach(() => cleanup());

  it("marque l'annonce de l'agriculteur comme vendue et la retire des annonces publiques", async () => {
    const utilisateur = userEvent.setup();
    render(<Annonces user={agriculteur} role="agriculteur" />);

    expect(await screen.findByRole("heading", { name: "Oignon" })).toBeTruthy();
    await utilisateur.click(screen.getByRole("button", { name: "Marquer comme vendu" }));

    expect(miseAJour).toHaveBeenCalledWith({ statut: "vendu" });
    expect(await screen.findByText("Aucune annonce ne correspond à ces filtres.")).toBeTruthy();
  });
});
