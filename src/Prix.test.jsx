import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Prix from "./Prix";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: { from: vi.fn() },
}));

const prixManuels = [{
  id: 1,
  produit: "Oignon local",
  region: "Dakar",
  prix_kg: 674,
  date: "2026-09-01",
  date_precision: "mois",
  type_prix: "detail",
  source: "ANSD",
  source_url: "https://example.com/ansd",
  prix_min_kg: null,
  prix_max_kg: null,
}];

const observationsWfp = {
  latestDate: "2026-10-15",
  stale: false,
  records: [
    {
      date: "2026-10-15",
      produit: "Maïs local",
      region: "Dakar",
      marche: "Sandaga",
      type_prix: "detail",
      prix_kg: 345,
    },
    {
      date: "2026-10-15",
      produit: "Riz local",
      region: "Kolda",
      marche: "Kolda",
      type_prix: "detail",
      prix_kg: 400,
    },
  ],
};

const historique = {
  stale: false,
  records: [
    { codeProduit: "maize", date: "2025-01-01", prix_kg: 250 },
    { codeProduit: "maize", date: "2025-02-01", prix_kg: 260 },
    { codeProduit: "rice", date: "2025-01-01", prix_kg: 400 },
    { codeProduit: "rice", date: "2025-02-01", prix_kg: 410 },
  ],
};

const reponseApi = (data) => ({
  ok: true,
  json: async () => data,
});

describe("Prix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue({
      select: () => ({
        order: async () => ({ data: prixManuels, error: null }),
      }),
    });
    vi.stubGlobal("fetch", vi.fn((url) => {
      if (url === "/api/prix-wfp") return Promise.resolve(reponseApi(observationsWfp));
      if (url === "/api/prix-banque-mondiale") return Promise.resolve(reponseApi(historique));
      throw new Error(`Endpoint inattendu : ${url}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("affiche les prix manuels avec leur source et leur date", async () => {
    render(<Prix />);

    const tableaux = await screen.findAllByRole("table");
    const tableauPrix = tableaux[0];
    expect(within(tableauPrix).getByText("Oignon local")).toBeTruthy();
    expect(within(tableauPrix).getByText("674")).toBeTruthy();
    expect(within(tableauPrix).getByText("septembre 2026")).toBeTruthy();
    expect(within(tableauPrix).getByRole("link", { name: "ANSD" }).getAttribute("href"))
      .toBe("https://example.com/ansd");
  });

  it("filtre les observations WFP et change la série historique comparée", async () => {
    const utilisateur = userEvent.setup();
    render(<Prix />);

    const filtre = await screen.findByRole("searchbox", { name: "Filtrer les prix externes" });
    await utilisateur.type(filtre, "Sandaga");

    expect(await screen.findByText("1 relevés correspondent à la recherche.")).toBeTruthy();
    const tableaux = screen.getAllByRole("table");
    expect(within(tableaux[1]).getByText("Maïs local")).toBeTruthy();
    expect(within(tableaux[1]).queryByText("Riz local")).toBeNull();

    await utilisateur.selectOptions(screen.getByLabelText("Produit à comparer"), "rice");
    expect(await screen.findByText(/Riz : 2 relevés entre 2025-01 et 2025-02/)).toBeTruthy();
  });
});
