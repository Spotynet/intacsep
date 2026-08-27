import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const WialonContext = createContext(null);

/**
 * Hook to access Wialon context.
 * Returns { session, units, getUnitById, loading, error }.
 * - session: the raw Wialon SDK Session singleton (for advanced consumers like WialonMap)
 * - units: [{id, name}] — list of all avl_unit items
 * - getUnitById(id): returns the live Wialon unit object (or null)
 * - loading: boolean — true while units are being fetched
 * - error: string | null
 */
export const useWialon = () => useContext(WialonContext);

const WIALON_API = "https://hst-api.wialon.com";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1500;
const GLOBAL_TIMEOUT_MS = 30000;

export const WialonProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialized = useRef(false);
  const navigate = useNavigate();

  const fetchUnits = useCallback(async (sess, retries = MAX_RETRIES) => {
    try {
      const flags =
        window.wialon.item.Item.dataFlag.base |
        window.wialon.item.Unit.dataFlag.lastMessage |
        window.wialon.item.Unit.dataFlag.sensors |
        window.wialon.item.Unit.dataFlag.counters |
        window.wialon.item.Unit.dataFlag.messageParams;

      sess.loadLibrary("itemIcon");

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject("Library load timeout"), 8000);
        sess.updateDataFlags([{ type: "type", data: "avl_unit", flags, mode: 0 }], (code) => {
          clearTimeout(timeout);
          if (code) reject(window.wialon.core.Errors.getErrorText(code));
          else resolve();
        });
      });

      const fetchedUnits = sess.getItems("avl_unit") || [];
      const unitList = fetchedUnits.map((u) => ({ id: u.getId(), name: u.getName() }));
      setUnits(unitList);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Wialon fetchUnits error:", err);
      if (retries > 0) {
        setTimeout(() => fetchUnits(sess, retries - 1), RETRY_DELAY);
      } else {
        setUnits([]);
        setLoading(false);
        setError(String(err));
      }
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const timer = setTimeout(() => {
      if (loading) {
        console.warn("WialonProvider: 30s timeout reached, redirecting to /bitacoras");
        setLoading(false);
        setError("Wialon initialization timed out");
        navigate("/bitacoras", { replace: true });
      }
    }, GLOBAL_TIMEOUT_MS);

    const token = localStorage.getItem("wialonToken") || import.meta.env.VITE_WIALON_TOKEN;
    if (!token) {
      clearTimeout(timer);
      setLoading(false);
      setError("No Wialon token available");
      navigate("/login", { replace: true });
      return;
    }

    if (!window.wialon) {
      clearTimeout(timer);
      setLoading(false);
      setError("Wialon SDK failed to load");
      navigate("/bitacoras", { replace: true });
      return;
    }

    const sess = window.wialon.core.Session.getInstance();
    sess.initSession(WIALON_API);

    sess.loginToken(token, "", (code) => {
      clearTimeout(timer);
      if (code) {
        setLoading(false);
        setError(`Wialon login failed: ${window.wialon.core.Errors.getErrorText(code)}`);
        navigate("/bitacoras", { replace: true });
        return;
      }
      setSession(sess);
      localStorage.setItem("wialonToken", token);
      fetchUnits(sess);
    });

    return () => clearTimeout(timer);
  }, [fetchUnits, navigate]);

  // No logout on unmount — the SDK is a singleton shared across components.
  // The session lives for the page lifetime.

  const getUnitById = useCallback(
    (id) => {
      if (!session) return null;
      const numId = Number(id);
      return session.getItems("avl_unit").find((u) => u.getId() === numId) || null;
    },
    [session]
  );

  return (
    <WialonContext.Provider value={{ session, units, getUnitById, loading, error }}>
      {children}
    </WialonContext.Provider>
  );
};
