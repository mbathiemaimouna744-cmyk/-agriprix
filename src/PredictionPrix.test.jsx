import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PredictionPrix from "./PredictionPrix";

const option = {
  produit: "Maize (local)",
  produit_libelle: "Maïs local",
  region: "Dakar",
  region_libelle: "Dakar",
  marche: "Sandaga",
  dernier_releve: "2026-10-15",
};

const jsonResponse = (data) => ({
  ok: true,
  json: async () => data,
});

describe("PredictionPrix", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("charge un marché et affiche sa prévision avec les métriques", async () => {
    vi.stubEnv("VITE_ML_API_URL", "https://ml.example.test");
    const fetchMock = vi.fn((url) => {
      if (url.endsWith("/options")) {
        return Promise.resolve(jsonResponse({ options: [option] }));
      }
      return Promise.resolve(
        jsonResponse({
          prevision: {
            produit: "Maïs local",
            region: "Dakar",
            marche: "Sandaga",
            mois: "2026-11",
            prix_fcfa_kg: 351.25,
            prix_reference_fcfa_kg: 345,
            dernier_releve: "2026-10-15",
          },
          evaluation: {
            mae_fcfa_kg: 27,
            mae_baseline_fcfa_kg: 31,
            meilleur_que_baseline: true,
          },
          source: "WFP diffusé par HDX",
          source_url: "https://data.humdata.org/dataset/wfp-food-prices-for-senegal",
          avertissement: "Estimation expérimentale.",
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const utilisateur = userEvent.setup();

    render(<PredictionPrix />);
    await utilisateur.click(
      await screen.findByRole("button", { name: "Estimer le prochain mois" })
    );

    expect(await screen.findByText(/351,25 FCFA\/kg/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ml.example.test/predict",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          produit: "Maize (local)",
          region: "Dakar",
          marche: "Sandaga",
        }),
      })
    );
    expect(screen.getByText(/27 FCFA\/kg/)).toBeTruthy();
  });
});
