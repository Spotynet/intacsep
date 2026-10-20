import DatePicker from "./DatePicker";

/**
 * DateTimeRangePicker — uses portal-based CustomDatePicker for premium experience.
 * Props: label, startValue, endValue, onStartChange, onEndChange
 */
const DateTimeRangePicker = ({ label, startValue, endValue, onStartChange, onEndChange }) => {
  return (
    <div className="pdt-range">
      {label && <span className="pselect__label">{label}</span>}
      <div className="pdt-range__inputs">
        <DatePicker
          prefix="De"
          showTime={true}
          value={startValue}
          onChange={onStartChange}
          placeholder="Desde..."
        />
        <span className="pdt-range__sep">|</span>
        <DatePicker
          prefix="A"
          showTime={true}
          value={endValue}
          onChange={onEndChange}
          placeholder="Hasta..."
        />
      </div>
    </div>
  );
};

export default DateTimeRangePicker;
