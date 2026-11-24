import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TableauBord from "./TableauBord";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: { from: vi.fn() },
}));

const agriculteur = { id: "seller-1" };

describe("TableauBord des annonces", () => {
  let miseAJour;

  beforeEach(() => {
    vi.clearAllMocks();
    const annonceExpiree = {
      id: "ad-1",
      produit: "Oignon",
      quantite_kg: 50,
      prix_kg: 500,
      region: "Ziguinchor",
      created_at: "2026-10-01T00:00:00.000Z",
      statut: "disponible",
      expires_at: "2026-10-31T00:00:00.000Z",
    };
    const resultats = {
      annonces: { data: [annonceExpiree], error: null },
      evaluations: { data: [], error: null },
      alertes_prix: { data: [], error: null },
    };
    miseAJour = vi.fn((valeurs) => valeurs);

    supabase.from.mockImplementation((table) => {
      const requete = {
        eq: vi.fn(() => requete),
        order: vi.fn(async () => resultats[table]),
      };
      return {
        select: vi.fn(() => requete),
        update: vi.fn((valeurs) => {
          miseAJour(valeurs);
          const modification = {
            eq: vi.fn(() => modification),
            select: vi.fn(() => modification),
            single: vi.fn(async () => ({
              data: { ...annonceExpiree, ...valeurs },
              error: null,
            })),
          };
          return modification;
        }),
      };
    });
  });

  afterEach(() => cleanup());

  it("permet de remettre en vente une annonce expirée pour 30 jours", async () => {
    const utilisateur = userEvent.setup();
    render(<TableauBord user={agriculteur} role="agriculteur" />);

    expect(await screen.findByText("Expirée", { exact: true })).toBeTruthy();
    await utilisateur.click(
      screen.getByRole("button", { name: "Remettre en vente 30 jours" })
    );

    const [valeurs] = miseAJour.mock.calls[0];
    expect(valeurs.statut).toBe("disponible");
    const expiration = Date.parse(valeurs.expires_at);
    expect(expiration).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(expiration).toBeLessThan(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(await screen.findByText("Disponible", { exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marquer comme vendu" })).toBeTruthy();
  });
});
