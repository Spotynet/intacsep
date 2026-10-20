import DatePicker from "./DatePicker";

/**
 * TimeRangePicker — uses portal-based CustomDatePicker for premium experience.
 * Props: label, startValue, endValue, onStartChange, onEndChange
 */
const TimeRangePicker = ({ label, startValue, endValue, onStartChange, onEndChange }) => {
  return (
    <div className="pdt-range">
      {label && <span className="pselect__label">{label}</span>}
      <div className="pdt-range__inputs">
        <DatePicker
          prefix="De"
          timeOnly={true}
          value={startValue}
          onChange={onStartChange}
          placeholder="Inicio..."
        />
        <span className="pdt-range__sep">—</span>
        <DatePicker
          prefix="A"
          timeOnly={true}
          value={endValue}
          onChange={onEndChange}
          placeholder="Fin..."
        />
      </div>
    </div>
  );
};

export default TimeRangePicker;
