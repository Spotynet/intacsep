import { useId } from "react";

/**
 * Props:
 *   label        — string (label above)
 *   placeholder  — string
 *   value        — string
 *   onChange     — (e) => void  (native textarea event)
 *   rows         — number (default 3)
 *   disabled     — bool
 *   required     — bool
 *   name         — string
 *   id           — string (auto-generated if omitted)
 *   className    — string (extra classes on wrapper)
 *   readOnly     — bool
 *   maxLength    — number
 */
export const TextArea = ({
  label,
  placeholder,
  value,
  onChange,
  rows = 3,
  disabled = false,
  required = false,
  name,
  id,
  className,
  readOnly = false,
  maxLength,
}) => {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <div className={`ptext${disabled ? " ptext--disabled" : ""}${className ? ` ${className}` : ""}`}>
      {label && <span className="ptext__label">{label}</span>}
      <textarea
        id={inputId}
        name={name}
        rows={rows}
        className="ptext__control modern-textarea"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        maxLength={maxLength}
        style={{ height: "auto", minHeight: rows * 24 + "px" }}
      />
    </div>
  );
};

export default TextArea;
