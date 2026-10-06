const normalize = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, ""); // remove non-alphanumeric
};

// Pattern → preferred EventType (matched flexibly against the catalog).
// Order matters: more specific patterns first.
const PATTERN_TARGETS = [
  { test: (n) => n.includes("gpsnoposiciona") || n === "gpsoff", prefer: "Gps no posiciona" },
  { test: (n) => n.includes("desvioderuta"), prefer: "Desvió de ruta" },
  // Estadia: "fuera" / "no autorizada" → no autorizada; plain "dentro" → autorizada
  {
    test: (n) => n.includes("estadia") && n.includes("fuera"),
    prefer: "Estadia no Autorizada",
  },
  {
    test: (n) => n.includes("estadia") && n.includes("dentro") && n.includes("noautorizada"),
    prefer: "Estadia no Autorizada",
  },
  {
    test: (n) => n.includes("estadia") && n.includes("dentro"),
    prefer: "Estadia Autorizada",
  },
  { test: (n) => n.includes("estadianoautorizada"), prefer: "Estadia no Autorizada" },
  { test: (n) => n.includes("estadiaautorizada"), prefer: "Estadia Autorizada" },
  {
    test: (n) => n.includes("excesodevelocidad") || n === "speeding" || n.includes("exceso"),
    prefer: "Exceso de Velocidad",
  },
  { test: (n) => n.includes("botondepanico") || n === "panic", prefer: "Botón de Pánico" },
];

const getLevenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

export const getSimilarity = (s1, s2) => {
  const n1 = normalize(s1); // The Wialon alert
  const n2 = normalize(s2); // The internal event type
  if (n1 === n2) return 1.0;
  if (n1.length === 0 || n2.length === 0) return 0;

  // Prefer event types that appear inside the Wialon alert name.
  if (n1.includes(n2)) {
    return 0.8 + 0.2 * (n2.length / n1.length);
  }

  const distance = getLevenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  return (maxLength - distance) / maxLength;
};

const resolvePrefer = (prefer, normalizedAlert) =>
  typeof prefer === "function" ? prefer(normalizedAlert) : prefer;

const findEventTypeByName = (eventTypes, preferredName) => {
  if (!preferredName) return null;
  const target = normalize(preferredName);
  // Prefer exact normalize match; avoid the longer "/ operador no contesta" variants.
  const exact = eventTypes.filter((et) => normalize(et.evento) === target);
  if (exact.length) {
    return exact.sort((a, b) => a.evento.length - b.evento.length)[0];
  }
  const soft = eventTypes.filter((et) => {
    const n = normalize(et.evento);
    return n === target || n.startsWith(target);
  });
  if (soft.length) {
    return soft.sort((a, b) => a.evento.length - b.evento.length)[0];
  }
  return null;
};

export const findBestEventMatch = (wialonName, eventTypes) => {
  if (!wialonName || !eventTypes || eventTypes.length === 0) return null;

  const normalizedAlert = normalize(wialonName);

  // 1. Pattern mappings → real catalog names (Gps no posiciona, Desvió de ruta, …)
  for (const rule of PATTERN_TARGETS) {
    if (!rule.test(normalizedAlert)) continue;
    const preferred = resolvePrefer(rule.prefer, normalizedAlert);
    const match = findEventTypeByName(eventTypes, preferred);
    if (match) return { match, source: "Mapeo directo", score: 1.0 };
  }

  // 2. Fuzzy / substring search — prefer shorter catalog names on ties
  let bestMatch = null;
  let highestScore = 0;

  eventTypes.forEach((et) => {
    const score = getSimilarity(wialonName, et.evento);
    if (
      score > highestScore ||
      (score === highestScore && bestMatch && et.evento.length < bestMatch.evento.length)
    ) {
      highestScore = score;
      bestMatch = et;
    }
  });

  if (bestMatch && highestScore >= 0.7) {
    return {
      match: bestMatch,
      source: `Sugerencia (${Math.round(highestScore * 100)}% match)`,
      score: highestScore,
    };
  }

  return null;
};
