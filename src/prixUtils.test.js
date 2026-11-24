import { describe, expect, it } from "vitest";
import {
  datePrixAffichee,
  libelleTypePrix,
  valeurPrixAffichee,
} from "./prixUtils";

describe("libelleTypePrix", () => {
  it("retourne le libellé du type connu", () => {
    expect(libelleTypePrix("producteur")).toBe("Producteur");
  });

  it("signale un type manquant ou inconnu", () => {
    expect(libelleTypePrix("inconnu")).toBe("À préciser");
    expect(libelleTypePrix(null)).toBe("À préciser");
  });
});

describe("valeurPrixAffichee", () => {
  it("affiche une fourchette lorsque ses deux bornes sont présentes", () => {
    expect(valeurPrixAffichee({
      prix_kg: 325,
      prix_min_kg: 300,
      prix_max_kg: 350,
    })).toBe("300–350");
  });

  it("retombe sur le prix observé si la fourchette est incomplète", () => {
    expect(valeurPrixAffichee({
      prix_kg: 325,
      prix_min_kg: 300,
      prix_max_kg: null,
    })).toBe("325");
  });

  it("indique quand le prix est absent", () => {
    expect(valeurPrixAffichee({})).toBe("À préciser");
  });
});

describe("datePrixAffichee", () => {
  it("indique que la date manque", () => {
    expect(datePrixAffichee({})).toBe("Date à préciser");
  });

  it("conserve une date invalide pour la signaler telle quelle", () => {
    expect(datePrixAffichee({ date: "date-invalide" })).toBe("date-invalide");
  });

  it("affiche le mois et l'année pour une date mensuelle", () => {
    expect(datePrixAffichee({
      date: "2026-09-01",
      date_precision: "mois",
    })).toBe("septembre 2026");
  });

  it("affiche le jour exact pour une date journalière", () => {
    expect(datePrixAffichee({
      date: "2026-04-15",
      date_precision: "jour",
    })).toBe("15/04/2026");
  });
});
