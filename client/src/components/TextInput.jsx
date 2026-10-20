import { useId } from "react";

/**
 * Props:
 *   label        — string (floating label above)
 *   placeholder  — string
 *   value        — string/number
 *   onChange     — (e) => void  (native input event)
 *   type         — string (default "text")
 *   disabled     — bool
 *   required     — bool
 *   name         — string
 *   id           — string (auto-generated if omitted)
 *   className    — string (extra classes on wrapper)
 *   readOnly     — bool
 *   autoComplete — string
 */
export const TextInput = ({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  disabled = false,
  required = false,
  name,
  id,
  className,
  readOnly = false,
  autoComplete,
  maxLength,
}) => {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <div className={`ptext${disabled ? " ptext--disabled" : ""}${className ? ` ${className}` : ""}`}>
      {label && <span className="ptext__label">{label}</span>}
      <input
        id={inputId}
        type={type}
        name={name}
        className="ptext__control"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        autoComplete={autoComplete}
        maxLength={maxLength}
      />
    </div>
  );
};

export default TextInput;
