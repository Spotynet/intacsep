/**
 * Semáforo helpers for bitácora events.
 * Wialon alertamientos (GPS no posiciona, desvío, estadía dentro/fuera) use a fixed
 * blue so they are not confused with frecuencia green/yellow/red.
 */

/** Distinct blue for the 4 Wialon alertamientos. */
export const SEMAFORO_ALERT_BLUE = "#3B82F6";

const normEventName = (nombre) =>
  String(nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * GPS no posiciona, Desvío de ruta, Estadía (dentro/fuera → "Estadía" / Autorizada variants).
 * Matches the 4 linked Wialon notification types.
 */
export const isWialonAlertamientoEvent = (nombre) => {
  const n = normEventName(nombre);
  if (!n) return false;
  if (n.includes("gpsnoposiciona") || n === "gpsoff") return true;
  if (n.includes("desvioderuta") || (n.includes("desvio") && n.includes("ruta"))) return true;
  if (n.includes("estadia")) return true;
  return false;
};
