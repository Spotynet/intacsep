import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const normalize = (str) => str?.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") ?? "";

const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const listener = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
};

// ─── Single Select ────────────────────────────────────────────────────────────

/**
 * Props:
 *   options      — array of { value, label } or plain strings
 *   value        — currently selected value (string/number)
 *   onChange     — (value) => void
 *   placeholder  — string
 *   label        — string (floating label)
 *   disabled     — bool
 *   clearable    — bool (default true)
 *   searchable   — bool (default true)
 */
export const Select = ({
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar...",
  label,
  disabled = false,
  clearable = true,
  searchable = true,
  className,
  direction = "down",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState({});
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  useClickOutside(wrapRef, () => { setOpen(false); setQuery(""); });

  const normalizedOptions = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  const filtered = query
    ? normalizedOptions.filter((o) => {
        const searchStr = typeof o.label === "string" ? o.label : (o.searchText || "");
        return normalize(searchStr).includes(normalize(query));
      })
    : normalizedOptions;

  const selected =
    normalizedOptions.find((o) => o.value === value) ??
    (typeof value === "string" && value !== ""
      ? normalizedOptions.find(
          (o) =>
            typeof o.value === "string" &&
            normalize(String(o.value).trim()) === normalize(String(value).trim())
        )
      : null) ??
    null;

  const positionMenu = useCallback(() => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 240;
    const openUp = direction !== "up" && spaceBelow < menuHeight && rect.top > menuHeight;

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 5, top: "auto" }
        : { top: rect.bottom + 5, bottom: "auto" }),
    });
  }, [direction]);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setQuery("");
  };

  const handleToggle = () => {
    if (disabled) return;
    setOpen((prev) => {
      if (!prev) {
        positionMenu();
        setTimeout(() => searchRef.current?.focus(), 10);
      }
      return !prev;
    });
  };

  useEffect(() => {
    if (!open) return;
    const reposition = () => positionMenu();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, positionMenu]);

  const menu = open && createPortal(
    <div className={`pselect__menu${direction === "up" ? " pselect__menu--up" : ""}`} style={menuStyle} onMouseDown={(e) => e.stopPropagation()}>
      {searchable && (
        <div className="pselect__search">
          <i className="fa fa-magnifying-glass"></i>
          <input
            ref={searchRef}
            type="text"
            className="pselect__search-input"
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <ul className="pselect__options">
        {filtered.length === 0 ? (
          <li className="pselect__option pselect__option--empty">Sin resultados</li>
        ) : (
          filtered.map((opt) => (
            <li
              key={opt.value}
              className={`pselect__option${opt.value === value ? " pselect__option--selected" : ""}`}
              onClick={() => handleSelect(opt)}
            >
              {opt.value === value && <i className="fa fa-check pselect__check"></i>}
              <div className="d-flex align-items-center justify-content-between w-100 gap-2">
                {opt.display || opt.label}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>,
    document.body
  );

  return (
    <div className={`pselect${open ? " pselect--open" : ""}${disabled ? " pselect--disabled" : ""}${className ? ` ${className}` : ""}`} ref={wrapRef}>
      {label && <span className="pselect__label">{label}</span>}
      <div className="pselect__control" onClick={handleToggle}>
        <span className={`pselect__value${!selected ? " pselect__value--placeholder" : ""}`}>
          {selected ? (selected.display || selected.label) : placeholder}
        </span>
        <div className="pselect__indicators">
          {clearable && selected && (
            <button type="button" className="pselect__clear" onClick={handleClear} tabIndex={-1}>
              <i className="fa fa-times"></i>
            </button>
          )}
          <span className="pselect__arrow">
            <i className="fa fa-chevron-down"></i>
          </span>
        </div>
      </div>

      {menu}
    </div>
  );
};

// ─── Multi Select ─────────────────────────────────────────────────────────────

/**
 * Props:
 *   options      — array of { value, label } or plain strings
 *   value        — array of selected values
 *   onChange     — (values[]) => void
 *   placeholder  — string
 *   label        — string
 *   disabled     — bool
 *   maxDisplay   — number of chips to show before "+N more" (default 3)
 */
export const MultiSelect = ({
  options = [],
  value = [],
  onChange,
  placeholder = "Seleccionar...",
  label,
  disabled = false,
  maxDisplay = 3,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState({});
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  useClickOutside(wrapRef, () => { setOpen(false); setQuery(""); });

  const normalizedOptions = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  const filtered = query
    ? normalizedOptions.filter((o) => {
        const searchStr = typeof o.label === "string" ? o.label : (o.searchText || "");
        return normalize(searchStr).includes(normalize(query));
      })
    : normalizedOptions;

  const isSelected = useCallback((v) => value.includes(v), [value]);

  const toggle = (opt) => {
    onChange(isSelected(opt.value) ? value.filter((v) => v !== opt.value) : [...value, opt.value]);
  };

  const removeChip = (e, v) => {
    e.stopPropagation();
    onChange(value.filter((x) => x !== v));
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const positionMenu = useCallback(() => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 240;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 5, top: "auto" }
        : { top: rect.bottom + 5, bottom: "auto" }),
    });
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    setOpen((prev) => {
      if (!prev) {
        positionMenu();
        setTimeout(() => searchRef.current?.focus(), 10);
      }
      return !prev;
    });
  };

  useEffect(() => {
    if (!open) return;
    const reposition = () => positionMenu();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, positionMenu]);

  const selectedOptions = normalizedOptions.filter((o) => isSelected(o.value));
  const visibleChips = selectedOptions.slice(0, maxDisplay);
  const overflow = selectedOptions.length - maxDisplay;

  const menu = open && createPortal(
    <div className="pselect__menu" style={menuStyle} onMouseDown={(e) => e.stopPropagation()}>
      <div className="pselect__search">
        <i className="fa fa-magnifying-glass"></i>
        <input
          ref={searchRef}
          type="text"
          className="pselect__search-input"
          placeholder="Buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {selectedOptions.length > 0 && (
        <div className="pselect__menu-header">
          <span>{selectedOptions.length} seleccionado{selectedOptions.length !== 1 ? "s" : ""}</span>
          <button type="button" className="pselect__deselect-all" onClick={clearAll}>Limpiar</button>
        </div>
      )}
      <ul className="pselect__options">
        {filtered.length === 0 ? (
          <li className="pselect__option pselect__option--empty">Sin resultados</li>
        ) : (
          filtered.map((opt) => {
            const sel = isSelected(opt.value);
            return (
              <li
                key={opt.value}
                className={`pselect__option${sel ? " pselect__option--selected" : ""}`}
                onClick={() => toggle(opt)}
              >
                <span className={`pselect__checkbox${sel ? " pselect__checkbox--checked" : ""}`}>
                  {sel && <i className="fa fa-check"></i>}
                </span>
                <div className="d-flex align-items-center justify-content-between w-100 gap-2">
                  {opt.display || opt.label}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>,
    document.body
  );

  return (
    <div className={`pselect pselect--multi${open ? " pselect--open" : ""}${disabled ? " pselect--disabled" : ""}`} ref={wrapRef}>
      {label && <span className="pselect__label">{label}</span>}
      <div className="pselect__control" onClick={handleToggle}>
        <div className="pselect__chips">
          {selectedOptions.length === 0 ? (
            <span className="pselect__value pselect__value--placeholder">{placeholder}</span>
          ) : (
            <>
              {visibleChips.map((o) => (
                <span key={o.value} className="pselect__chip">
                  {o.label}
                  <button type="button" className="pselect__chip-remove" onClick={(e) => removeChip(e, o.value)} tabIndex={-1}>
                    <i className="fa fa-times"></i>
                  </button>
                </span>
              ))}
              {overflow > 0 && (
                <span className="pselect__chip pselect__chip--overflow">+{overflow}</span>
              )}
            </>
          )}
        </div>
        <div className="pselect__indicators">
          {selectedOptions.length > 0 && (
            <button type="button" className="pselect__clear" onClick={clearAll} tabIndex={1}>
              <i className="fa fa-times"></i>
            </button>
          )}
          <span className="pselect__arrow">
            <i className="fa fa-chevron-down"></i>
          </span>
        </div>
      </div>

      {menu}
    </div>
  );
};

export default Select;
