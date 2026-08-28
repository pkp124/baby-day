import type { TempUnit, VolumeUnit, WeightUnit } from "./types";

export const ML_PER_OZ = 29.5735;
export const G_PER_LB = 453.592;

export function mlToDisplay(ml: number, unit: VolumeUnit) {
  if (unit === "oz") return Math.round((ml / ML_PER_OZ) * 10) / 10;
  return Math.round(ml);
}

export function displayToMl(value: number, unit: VolumeUnit) {
  if (unit === "oz") return value * ML_PER_OZ;
  return value;
}

export function formatMl(ml: number, unit: VolumeUnit) {
  if (!ml) return unit === "oz" ? "0 oz" : "0 ml";
  if (unit === "oz") return `${mlToDisplay(ml, "oz")} oz`;
  return `${Math.round(ml)} ml`;
}

export function gramsToDisplay(grams: number, unit: WeightUnit) {
  if (unit === "lb") {
    const lb = grams / G_PER_LB;
    return Math.round(lb * 100) / 100;
  }
  return Math.round(grams) / 1000;
}

export function displayToGrams(value: number, unit: WeightUnit) {
  if (unit === "lb") return value * G_PER_LB;
  return value * 1000;
}

export function formatWeight(grams: number, unit: WeightUnit) {
  if (unit === "lb") return `${gramsToDisplay(grams, "lb")} lb`;
  const kg = gramsToDisplay(grams, "kg");
  return `${kg.toFixed(kg >= 10 ? 1 : 2)} kg`;
}

export function celsiusToDisplay(celsius: number, unit: TempUnit) {
  if (unit === "F") return Math.round(((celsius * 9) / 5 + 32) * 10) / 10;
  return Math.round(celsius * 10) / 10;
}

export function displayToCelsius(value: number, unit: TempUnit) {
  if (unit === "F") return ((value - 32) * 5) / 9;
  return value;
}

export function formatTemp(celsius: number, unit: TempUnit) {
  const n = celsiusToDisplay(celsius, unit);
  return unit === "F" ? `${n.toFixed(1)} °F` : `${n.toFixed(1)} °C`;
}
