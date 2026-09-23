import { describe, expect, it } from "vitest";
import {
  clampStepIndex,
  isFirstStep,
  isLastStep,
  nextStepIndex,
  previousStepIndex,
  speechLangOf,
  stepPosition,
} from "./cook-along";

describe("clampStepIndex", () => {
  it("garde un index déjà valide", () => {
    expect(clampStepIndex(2, 5)).toBe(2);
  });

  it("ramène un index négatif à 0", () => {
    expect(clampStepIndex(-3, 5)).toBe(0);
  });

  it("ramène un index trop grand au dernier", () => {
    expect(clampStepIndex(99, 5)).toBe(4);
  });

  it("renvoie 0 quand il n’y a aucune étape", () => {
    expect(clampStepIndex(2, 0)).toBe(0);
  });

  it("tronque un index non entier", () => {
    expect(clampStepIndex(2.7, 5)).toBe(2);
  });

  it("renvoie 0 pour un index non fini", () => {
    expect(clampStepIndex(Number.NaN, 5)).toBe(0);
  });
});

describe("nextStepIndex / previousStepIndex", () => {
  it("avance d’un cran", () => {
    expect(nextStepIndex(1, 5)).toBe(2);
  });

  it("ne dépasse pas la dernière étape", () => {
    expect(nextStepIndex(4, 5)).toBe(4);
  });

  it("recule d’un cran", () => {
    expect(previousStepIndex(2, 5)).toBe(1);
  });

  it("ne descend pas sous la première étape", () => {
    expect(previousStepIndex(0, 5)).toBe(0);
  });
});

describe("isFirstStep / isLastStep", () => {
  it("reconnaît la première étape", () => {
    expect(isFirstStep(0, 5)).toBe(true);
    expect(isFirstStep(1, 5)).toBe(false);
  });

  it("reconnaît la dernière étape", () => {
    expect(isLastStep(4, 5)).toBe(true);
    expect(isLastStep(0, 5)).toBe(false);
  });

  it("une recette sans étape est toujours à la dernière", () => {
    expect(isLastStep(0, 0)).toBe(true);
  });
});

describe("stepPosition", () => {
  it("numérote à partir de 1", () => {
    expect(stepPosition(0, 6)).toEqual({ current: 1, total: 6 });
    expect(stepPosition(5, 6)).toEqual({ current: 6, total: 6 });
  });
});

describe("speechLangOf", () => {
  it("convertit un code de locale connu en tag BCP 47", () => {
    expect(speechLangOf("fr")).toBe("fr-FR");
    expect(speechLangOf("de")).toBe("de-DE");
  });

  it("retombe sur l’anglais pour une locale inconnue", () => {
    expect(speechLangOf("xx")).toBe("en-US");
  });
});
