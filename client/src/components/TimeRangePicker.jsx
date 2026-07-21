/**
 * TimeRangePicker — styled to match the pselect component system.
 * Props: label, startValue, endValue, onStartChange, onEndChange
 */
const TimeRangePicker = ({ label, startValue, endValue, onStartChange, onEndChange }) => {
  return (
    <div className="pdt-range">
      {label && <span className="pselect__label">{label}</span>}
      <div className="pdt-range__inputs">
        <div className="pdt-field">
          <span className="pdt-field__prefix">De</span>
          <input
            type="time"
            className="pdt-field__input"
            value={startValue}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <span className="pdt-range__sep">—</span>
        <div className="pdt-field">
          <span className="pdt-field__prefix">A</span>
          <input
            type="time"
            className="pdt-field__input"
            value={endValue}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default TimeRangePicker;
