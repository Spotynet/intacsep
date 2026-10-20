import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS   = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

const parseDate = (str, timeOnly = false) => {
  if (!str) return null;
  if (timeOnly) {
    const [h, m] = str.split(":").map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }
  const d = new Date(str.includes("T") ? str : str + "T00:00:00");
  return isNaN(d) ? null : d;
};

const toISO = (d, showTime = false, timeOnly = false) => {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  
  if (timeOnly) return `${hh}:${mm}`;
  if (showTime) return `${y}-${m}-${day}T${hh}:${mm}`;
  return `${y}-${m}-${day}`;
};

const formatDisplay = (str, showTime = false, timeOnly = false) => {
  const d = parseDate(str, timeOnly);
  if (!d) return null;
  
  const datePart = `${String(d.getDate()).padStart(2,"0")} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
  const timePart = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  
  if (timeOnly) return timePart;
  if (showTime) return `${datePart} ${timePart}`;
  return datePart;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfWeek = (year, month) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Mon=0
};

/**
 * DatePicker
 * Props: value, onChange, label, placeholder, clearable, disabled, minDate, maxDate, showTime, timeOnly, prefix
 */
const DatePicker = ({
  value,
  onChange,
  label,
  placeholder = "Seleccionar",
  clearable = true,
  disabled = false,
  minDate,
  maxDate,
  showTime = false,
  timeOnly = false,
  prefix,
}) => {
  const today = new Date();
  const initialDate = parseDate(value, timeOnly) || today;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [mode, setMode] = useState("days"); // "days" | "months" | "years"
  const [menuStyle, setMenuStyle] = useState({});
  
  // Internal selection state (until Apply is clicked if time is involved)
  const [selectedDate, setSelectedDate] = useState(parseDate(value, timeOnly));
  const [selHH, setSelHH] = useState(initialDate.getHours());
  const [selMM, setSelMM] = useState(initialDate.getMinutes());

  const wrapRef = useRef(null);
  const hourListRef = useRef(null);
  const minListRef = useRef(null);

  // Click outside
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync internal state when value changes externally
  useEffect(() => {
    const d = parseDate(value, timeOnly);
    setSelectedDate(d);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelHH(d.getHours());
      setSelMM(d.getMinutes());
    }
  }, [value, timeOnly]);

  const positionMenu = useCallback(() => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = (showTime || timeOnly) ? 400 : 320; 
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 272),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 5, top: "auto" }
        : { top: rect.bottom + 5, bottom: "auto" }),
      zIndex: 2000,
    });
  }, [showTime, timeOnly]);

  const handleOpen = () => { 
    if (!disabled) { 
      setOpen((p) => {
        if (!p) {
          positionMenu();
        }
        return !p;
      }); 
      setMode("days"); 
    } 
  };

  useEffect(() => {
    if (!open) return;
    const reposition = () => positionMenu();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    
    // Auto scroll time columns
    if (showTime || timeOnly) {
      setTimeout(() => {
        if (hourListRef.current) {
          const el = hourListRef.current.querySelector(`[data-value="${selHH}"]`);
          if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
        }
        if (minListRef.current) {
          const el = minListRef.current.querySelector(`[data-value="${selMM}"]`);
          if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }, 50);
    }

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, positionMenu, selHH, selMM, showTime, timeOnly]);

  const handleClear = (e) => { 
    e.stopPropagation(); 
    onChange(""); 
    setSelectedDate(null);
  };

  const handleApply = () => {
    let finalDate = selectedDate || new Date();
    finalDate.setHours(selHH, selMM, 0, 0);
    onChange(toISO(finalDate, showTime, timeOnly));
    setOpen(false);
  };

  const selectDay = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    if (!showTime && !timeOnly) {
      onChange(toISO(d, false, false));
      setOpen(false);
    } else {
      setSelectedDate(d);
    }
  };

  const prevMonth = (e) => { e.stopPropagation(); if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = (e) => { e.stopPropagation(); if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const isToday = (day) => { const d = new Date(viewYear, viewMonth, day); return toISO(d) === toISO(today); };
  const isSelected = (day) => { 
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === viewMonth && selectedDate.getDate() === day;
  };
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

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const menu = open && createPortal(
    <div className="pdp__menu" style={menuStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>

      {!timeOnly && (
        <>
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
        </>
      )}

      {/* ── Time selection ── */}
      {(showTime || timeOnly) && (
        <div className="pdp__time-section">
          <div className="pdp__time-title">
            <i className="fa fa-clock"></i> {timeOnly ? "Seleccionar hora" : "Hora"}
          </div>
          <div className="pdp__time-cols">
            <div className="pdp__time-col custom-scrollbar" ref={hourListRef}>
              {hours.map(h => (
                <button 
                  key={h} 
                  data-value={h}
                  className={`pdp__time-unit ${selHH === h ? "is-selected" : ""}`}
                  onClick={() => setSelHH(h)}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
            <div className="pdp__time-sep">:</div>
            <div className="pdp__time-col custom-scrollbar" ref={minListRef}>
              {minutes.map(m => (
                <button 
                  key={m} 
                  data-value={m}
                  className={`pdp__time-unit ${selMM === m ? "is-selected" : ""}`}
                  onClick={() => setSelMM(m)}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="pdp__footer">
        {!timeOnly && (
          <button type="button" className="pdp__today-btn" onClick={() => { 
            const d = new Date();
            if (showTime) {
              setSelectedDate(d);
              setSelHH(d.getHours());
              setSelMM(d.getMinutes());
            } else {
              onChange(toISO(d, false, false));
              setOpen(false);
            }
          }}>
            Hoy
          </button>
        )}
        {(showTime || timeOnly) && (
          <button type="button" className="pdp__apply-btn" onClick={handleApply}>
            Aplicar
          </button>
        )}
      </div>

    </div>,
    document.body
  );

  return (
    <div className={`pdp${open ? " pdp--open" : ""}${disabled ? " pdp--disabled" : ""}`} ref={wrapRef}>
      {label && <span className="pselect__label">{label}</span>}

      <div className="pdp__control" onClick={handleOpen}>
        {prefix && <span className="pdt-range__prefix" style={{ marginRight: "4px" }}>{prefix}</span>}
        <i className={`fa ${timeOnly ? "fa-clock" : "fa-calendar"} pdp__icon`}></i>
        <span className={`pdp__value${!value ? " pdp__value--placeholder" : ""}`}>
          {value ? formatDisplay(value, showTime, timeOnly) : placeholder}
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

      {menu}
    </div>
  );
};

export default DatePicker;
