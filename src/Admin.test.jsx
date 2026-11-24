import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Admin from "./Admin";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: { from: vi.fn() },
}));

const administrateur = { id: "admin-1" };

describe("Admin", () => {
  let annonces;
  let prix;
  let insertionPrix;
  let suppressionAnnonce;
  let erreurChargement;
  let erreurInsertion;
  let erreurSuppression;

  beforeEach(() => {
    vi.clearAllMocks();
    annonces = [{
      id: "ad-1",
      produit: "Annonce à modérer",
      quantite_kg: 50,
      prix_kg: 500,
      region: "Ziguinchor",
    }];
    prix = [];
    erreurChargement = null;
    erreurInsertion = null;
    erreurSuppression = null;
    insertionPrix = vi.fn((donnees) => ({
      select: () => ({
        single: async () => erreurInsertion
          ? { data: null, error: erreurInsertion }
          : { data: { id: "price-1", ...donnees }, error: null },
      }),
    }));
    suppressionAnnonce = vi.fn(async () => ({ error: null }));

    supabase.from.mockImplementation((table) => ({
      select: () => ({
        order: async () => ({
          data: table === "annonces" ? annonces : prix,
          error: erreurChargement,
        }),
      }),
      insert: insertionPrix,
      delete: () => ({
        eq: (_colonne, id) => {
          if (erreurSuppression) return Promise.resolve({ error: erreurSuppression });
          if (table === "annonces") {
            suppressionAnnonce(id);
            annonces = annonces.filter((annonce) => annonce.id !== id);
          } else {
            prix = prix.filter((item) => item.id !== id);
          }
          return Promise.resolve({ error: null });
        },
      }),
    }));
  });

  afterEach(() => cleanup());

  it("réserve la page aux administrateurs", () => {
    render(<Admin user={{ id: "buyer-1" }} role="acheteur" />);

    expect(screen.getByText("Cette zone est réservée aux administrateurs.")).toBeTruthy();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("permet à l'administrateur de supprimer une annonce", async () => {
    const utilisateur = userEvent.setup();
    render(<Admin user={administrateur} role="admin" />);

    expect(await screen.findByText("Annonce à modérer")).toBeTruthy();
    await utilisateur.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(suppressionAnnonce).toHaveBeenCalledWith("ad-1");
    expect(await screen.findByText("Aucune annonce.")).toBeTruthy();
  });

  it("affiche une erreur et conserve l'annonce si la suppression échoue", async () => {
    const utilisateur = userEvent.setup();
    erreurSuppression = { message: "Suppression refusée" };
    render(<Admin user={administrateur} role="admin" />);

    await screen.findByText("Annonce à modérer");
    await utilisateur.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Suppression refusée");
    expect(screen.getByText("Annonce à modérer")).toBeTruthy();
  });

  it("enregistre une fourchette de prix avec la source et la précision mensuelle", async () => {
    const utilisateur = userEvent.setup();
    const { container } = render(<Admin user={administrateur} role="admin" />);

    await screen.findByText("Annonce à modérer");
    await utilisateur.type(screen.getByPlaceholderText("Produit"), "Oignon local");
    await utilisateur.type(screen.getByPlaceholderText("Région"), "Sédhiou");
    await utilisateur.type(screen.getByPlaceholderText("Minimum (facultatif)"), "300");
    await utilisateur.type(screen.getByPlaceholderText("Maximum (facultatif)"), "350");
    await utilisateur.selectOptions(screen.getByLabelText("Précision de la date"), "mois");
    await utilisateur.selectOptions(screen.getByLabelText("Type de prix"), "detail");
    await utilisateur.type(
      screen.getByPlaceholderText("Source (ex. ANSD, bulletin de mai 2026)"),
      "APS, relevé du marché central"
    );
    await utilisateur.type(
      screen.getByPlaceholderText("Lien source (facultatif)"),
      "https://aps.sn/prix-sedhiou"
    );
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-05-24" },
    });
    await utilisateur.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(insertionPrix).toHaveBeenCalledWith({
      produit: "Oignon local",
      region: "Sédhiou",
      prix_kg: 325,
      prix_min_kg: 300,
      prix_max_kg: 350,
      date: "2026-05-01",
      date_precision: "mois",
      type_prix: "detail",
      source: "APS, relevé du marché central",
      source_url: "https://aps.sn/prix-sedhiou",
    });
    expect(await screen.findByText(/Oignon local — Sédhiou — 300–350 FCFA\/kg/)).toBeTruthy();
  });

  it("enregistre un prix unique fixé par l'État", async () => {
    const utilisateur = userEvent.setup();
    const dateDuJour = new Date().toISOString().slice(0, 10);
    render(<Admin user={administrateur} role="admin" />);

    await screen.findByText("Annonce à modérer");
    await utilisateur.type(screen.getByPlaceholderText("Produit"), "Arachide");
    await utilisateur.type(screen.getByPlaceholderText("Région"), "Sénégal");
    await utilisateur.type(screen.getByPlaceholderText("Prix unique (FCFA/kg)"), "305");
    await utilisateur.selectOptions(screen.getByLabelText("Type de prix"), "prix_fixe");
    await utilisateur.type(
      screen.getByPlaceholderText("Source (ex. ANSD, bulletin de mai 2026)"),
      "Prix fixé par l’État"
    );
    await utilisateur.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(insertionPrix).toHaveBeenCalledWith({
      produit: "Arachide",
      region: "Sénégal",
      prix_kg: 305,
      prix_min_kg: null,
      prix_max_kg: null,
      date: dateDuJour,
      date_precision: "jour",
      type_prix: "prix_fixe",
      source: "Prix fixé par l’État",
      source_url: null,
    });
    expect(await screen.findByText(/Arachide — Sénégal — 305 FCFA\/kg/)).toBeTruthy();
  });

  it("refuse un lien de source qui n'utilise pas HTTP ou HTTPS", async () => {
    const utilisateur = userEvent.setup();
    render(<Admin user={administrateur} role="admin" />);

    await screen.findByText("Annonce à modérer");
    await utilisateur.type(screen.getByPlaceholderText("Produit"), "Mil");
    await utilisateur.type(screen.getByPlaceholderText("Région"), "Thiès");
    await utilisateur.type(screen.getByPlaceholderText("Prix unique (FCFA/kg)"), "250");
    await utilisateur.type(
      screen.getByPlaceholderText("Source (ex. ANSD, bulletin de mai 2026)"),
      "Enquête locale"
    );
    await utilisateur.type(
      screen.getByPlaceholderText("Lien source (facultatif)"),
      "source-invalide"
    );
    await utilisateur.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Le lien de la source doit commencer par https:// ou http://."
    );
    expect(insertionPrix).not.toHaveBeenCalled();
  });

  it("exige les informations obligatoires avant d'ajouter un prix", async () => {
    const utilisateur = userEvent.setup();
    render(<Admin user={administrateur} role="admin" />);

    await screen.findByText("Annonce à modérer");
    await utilisateur.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Complétez le produit, la région, le prix, la date, le type et la source."
    );
    expect(insertionPrix).not.toHaveBeenCalled();
  });

  it("permet de supprimer un prix existant", async () => {
    const utilisateur = userEvent.setup();
    prix = [{
      id: "price-1",
      produit: "Mil",
      region: "Thiès",
      prix_kg: 250,
      date: "2026-11-23",
      date_precision: "jour",
      type_prix: "detail",
      source: "ANSD",
    }];
    render(<Admin user={administrateur} role="admin" />);

    expect(await screen.findByText(/Mil — Thiès — 250 FCFA\/kg/)).toBeTruthy();
    const boutonsSuppression = screen.getAllByRole("button", { name: "Supprimer" });
    await utilisateur.click(boutonsSuppression[1]);

    await waitFor(() => {
      expect(screen.queryByText(/Mil — Thiès — 250 FCFA\/kg/)).toBeNull();
    });
  });

  it("affiche une erreur lorsque les données d'administration ne chargent pas", async () => {
    erreurChargement = new Error("connexion indisponible");
    render(<Admin user={administrateur} role="admin" />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Impossible de charger les données d'administration."
    );
  });

  it("refuse une fourchette dont le maximum est inférieur au minimum", async () => {
    const utilisateur = userEvent.setup();
    render(<Admin user={administrateur} role="admin" />);

    await screen.findByText("Annonce à modérer");
    await utilisateur.type(screen.getByPlaceholderText("Produit"), "Mil");
    await utilisateur.type(screen.getByPlaceholderText("Région"), "Thiès");
    await utilisateur.type(screen.getByPlaceholderText("Minimum (facultatif)"), "350");
    await utilisateur.type(screen.getByPlaceholderText("Maximum (facultatif)"), "300");
    await utilisateur.type(
      screen.getByPlaceholderText("Source (ex. ANSD, bulletin de mai 2026)"),
      "Enquête locale"
    );
    await utilisateur.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Saisissez soit un prix unique, soit deux bornes valides"
    );
    expect(insertionPrix).not.toHaveBeenCalled();
  });

  it("affiche l'erreur si Supabase refuse l'ajout du prix", async () => {
    const utilisateur = userEvent.setup();
    erreurInsertion = { message: "Écriture refusée" };
    render(<Admin user={administrateur} role="admin" />);

    await screen.findByText("Annonce à modérer");
    await utilisateur.type(screen.getByPlaceholderText("Produit"), "Mil");
    await utilisateur.type(screen.getByPlaceholderText("Région"), "Thiès");
    await utilisateur.type(screen.getByPlaceholderText("Prix unique (FCFA/kg)"), "250");
    await utilisateur.type(
      screen.getByPlaceholderText("Source (ex. ANSD, bulletin de mai 2026)"),
      "Enquête locale"
    );
    await utilisateur.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Écriture refusée");
  });
});
