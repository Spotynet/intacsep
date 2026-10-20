const WIALON_BASE = "https://hst-api.wialon.com/wialon/ajax.html";
// 3 attempts x 12s + backoff ≈ 39s worst case: always below nginx's 60s cut-off,
// otherwise nginx answers without CORS headers and the browser blames CORS.
const DEFAULT_RETRIES = 2;
const CALL_TIMEOUT_MS = 12000;

const NET_HINTS = {
  ETIMEDOUT: "el servidor no responde (timeout)",
  ECONNREFUSED: "conexión rechazada",
  ECONNRESET: "conexión reiniciada por el servidor",
  EPIPE: "conexión cerrada",
  ENOTFOUND: "no se pudo resolver el dominio (DNS)",
  EAI_AGAIN: "fallo temporal de DNS",
  UND_ERR_CONNECT_TIMEOUT: "timeout al conectar",
  UND_ERR_HEADERS_TIMEOUT: "timeout esperando la respuesta",
  UND_ERR_BODY_TIMEOUT: "timeout esperando el cuerpo",
  ABORT_ERR: "sin respuesta (timeout)",
  TIMEOUT: "sin respuesta (timeout)",
  TimeoutError: "sin respuesta (timeout)",
};

// undici guarda el motivo real en err.cause (a veces anidado o en err.errors[])
function findNetworkCode(err) {
  let cur = err;
  for (let i = 0; i < 5 && cur; i++) {
    if (cur.code) return cur.code;
    if (Array.isArray(cur.errors) && cur.errors[0]) {
      cur = cur.errors[0];
      continue;
    }
    cur = cur.cause;
  }
  return "";
}

// Devuelve una explicación legible del fallo de red, o "" si no lo es.
function netHint(err) {
  const code = findNetworkCode(err);
  if (NET_HINTS[code]) return NET_HINTS[code];
  if (NET_HINTS[err?.name]) return NET_HINTS[err.name];
  const msg = err?.message || "";
  if (/timeout|abort/i.test(msg)) return "sin respuesta (timeout)";
  if (msg === "fetch failed" || msg.startsWith("fetch ")) return "sin respuesta desde el servidor";
  return "";
}

function isNetworkError(err) {
  return Boolean(netHint(err));
}

function describeWialonError(err, attempts) {
  const hint = netHint(err);
  if (!hint) return err;
  const code = findNetworkCode(err) || (NET_HINTS[err?.name] ? err.name : "");
  return new Error(
    `No se pudo conectar con la API de Wialon: ${hint}` +
      (code ? ` [${code}]` : "") +
      ` — se intentó ${attempts} vez(es). Intenta de nuevo en unos segundos.`
  );
}

export async function wialonApiCall(svc, params = {}, sid = null, { retries = DEFAULT_RETRIES } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const url = new URL(WIALON_BASE);
      url.searchParams.set("svc", svc);
      if (sid) url.searchParams.set("sid", sid);
      const body = new URLSearchParams();
      body.set("params", JSON.stringify(params));
      const res = await fetch(url, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        // Errores de red: más espera entre intentos (Wialon cae en ráfagas)
        const delay = isNetworkError(err) ? 1000 * (attempt + 1) : 400 * (attempt + 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  const friendly = describeWialonError(lastErr, retries + 1);
  console.error(
    `[wialon] ${svc} falló tras ${retries + 1} intento(s): ${lastErr?.message || lastErr}`,
    findNetworkCode(lastErr) || ""
  );
  throw friendly;
}

export function getWialonToken() {
  const token = process.env.WIALON_API_TOKEN;
  if (!token) throw new Error("Missing WIALON_API_TOKEN");
  return token;
}

export async function wialonLogin(token = getWialonToken()) {
  const login = await wialonApiCall("token/login", { token });
  if (login.error) throw new Error(`Wialon auth error: ${login.error}`);
  return login.eid;
}

export async function wialonLogout(sid) {
  try {
    await wialonApiCall("core/logout", {}, sid);
  } catch (e) {
    console.error("Wialon logout failed:", e.message);
  }
}

export async function withWialonSession(fn, token = getWialonToken()) {
  const sid = await wialonLogin(token);
  try {
    return await fn(sid);
  } finally {
    await wialonLogout(sid);
  }
}
