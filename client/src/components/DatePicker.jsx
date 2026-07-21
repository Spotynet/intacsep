import { useState, useRef, useEffect } from "react";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS   = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

const parseDate = (str) => {
  if (!str) return null;
  const d = new Date(str + "T00:00:00");
  return isNaN(d) ? null : d;
};

const toISO = (d) => {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDisplay = (str) => {
  const d = parseDate(str);
  if (!d) return null;
  return `${String(d.getDate()).padStart(2,"0")} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfWeek = (year, month) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Mon=0
};

/**
 * DatePicker
 * Props: value (YYYY-MM-DD), onChange, label, placeholder, clearable, disabled, minDate, maxDate
 */
const DatePicker = ({
  value,
  onChange,
  label,
  placeholder = "Seleccionar fecha",
  clearable = true,
  disabled = false,
  minDate,
  maxDate,
}) => {
  const today = new Date();
  const selected = parseDate(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((selected || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected || today).getMonth());
  const [mode, setMode] = useState("days"); // "days" | "months" | "years"

  const wrapRef = useRef(null);

  // Click outside
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync view when value changes externally
  useEffect(() => {
    if (selected) { setViewYear(selected.getFullYear()); setViewMonth(selected.getMonth()); }
  }, [value]);

  const handleOpen = () => { if (!disabled) { setOpen((p) => !p); setMode("days"); } };

  const handleClear = (e) => { e.stopPropagation(); onChange(""); };

  const selectDay = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(toISO(d));
    setOpen(false);
  };

  const prevMonth = (e) => { e.stopPropagation(); if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = (e) => { e.stopPropagation(); if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const isToday = (day) => { const d = new Date(viewYear, viewMonth, day); return toISO(d) === toISO(today); };
  const isSelected = (day) => { const d = new Date(viewYear, viewMonth, day); return value && toISO(d) === value; };
  const isDisabled = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    if (minDate && d < parseDate(minDate)) return true;
    if (maxDate && d > parseDate(maxDate)) return true;
    return false;
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow   = getFirstDayOfWeek(viewYear, viewMonth);
  const cells      = Array.from({ length: firstDow + daysInMonth }, (_, i) => (i < firstDow ? null : i - firstDow + 1));

  // Year range for year picker
  const yearStart = Math.floor(viewYear / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

  return (
    <div className={`pdp${open ? " pdp--open" : ""}${disabled ? " pdp--disabled" : ""}`} ref={wrapRef}>
      {label && <span className="pselect__label">{label}</span>}

      <div className="pdp__control" onClick={handleOpen}>
        <i className="fa fa-calendar pdp__icon"></i>
        <span className={`pdp__value${!value ? " pdp__value--placeholder" : ""}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <div className="pdp__indicators">
          {clearable && value && (
            <button type="button" className="pselect__clear" onClick={handleClear} tabIndex={-1}>
              <i className="fa fa-times"></i>
            </button>
          )}
          <span className="pselect__arrow"><i className="fa fa-chevron-down"></i></span>
        </div>
      </div>

      {open && (
        <div className="pdp__menu" onClick={(e) => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="pdp__header">
            <button type="button" className="pdp__nav" onClick={prevMonth}><i className="fa fa-chevron-left"></i></button>
            <div className="pdp__header-labels">
              <button type="button" className="pdp__header-btn" onClick={() => setMode(mode === "months" ? "days" : "months")}>
                {MONTHS[viewMonth]}
              </button>
              <button type="button" className="pdp__header-btn" onClick={() => setMode(mode === "years" ? "days" : "years")}>
                {viewYear}
              </button>
            </div>
            <button type="button" className="pdp__nav" onClick={nextMonth}><i className="fa fa-chevron-right"></i></button>
          </div>

          {/* ── Day grid ── */}
          {mode === "days" && (
            <div className="pdp__body">
              <div className="pdp__weekdays">
                {DAYS.map((d) => <span key={d} className="pdp__weekday">{d}</span>)}
              </div>
              <div className="pdp__days">
                {cells.map((day, i) =>
                  day === null ? (
                    <span key={`e-${i}`} className="pdp__day pdp__day--empty" />
                  ) : (
                    <button
                      key={day}
                      type="button"
                      className={`pdp__day${isSelected(day) ? " pdp__day--selected" : ""}${isToday(day) && !isSelected(day) ? " pdp__day--today" : ""}${isDisabled(day) ? " pdp__day--disabled" : ""}`}
                      onClick={() => !isDisabled(day) && selectDay(day)}
                      disabled={isDisabled(day)}
                    >
                      {day}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* ── Month picker ── */}
          {mode === "months" && (
            <div className="pdp__body">
              <div className="pdp__month-grid">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    className={`pdp__month-btn${i === viewMonth ? " pdp__month-btn--selected" : ""}`}
                    onClick={() => { setViewMonth(i); setMode("days"); }}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Year picker ── */}
          {mode === "years" && (
            <div className="pdp__body">
              <div className="pdp__year-grid">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`pdp__year-btn${y === viewYear ? " pdp__year-btn--selected" : ""}`}
                    onClick={() => { setViewYear(y); setMode("days"); }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="pdp__footer">
            <button type="button" className="pdp__today-btn" onClick={() => { onChange(toISO(today)); setOpen(false); }}>
              Hoy
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default DatePicker;
