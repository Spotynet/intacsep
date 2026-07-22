/**
 * CellBadge — reusable pill badge for table cells.
 *
 * Props:
 *   label      {string}              — Text to display inside the badge.
 *   color      {string}              — Background color (hex/rgb). When provided,
 *                                      the badge uses that bg and auto-picks text color.
 *   variant    {string}              — Named color variant: "blue" | "green" | "red" |
 *                                      "yellow" | "purple" | "gray" | "black".
 *                                      Ignored when `color` is set.
 *   onClick    {Function}            — Makes the badge a clickable button.
 *   className  {string}              — Extra CSS classes.
 */
const CellBadge = ({label, color, variant, onClick, className = ""}) => {
  const style = color ? {backgroundColor: color} : undefined;

  const variantClass = variant ? `cell-badge--${variant}` : "";
  const darkBg = color === "#000000" || color === "#333235";
  const textClass = color ? (darkBg ? "cell-badge--text-light" : "cell-badge--text-dark") : "";

  const classes = ["cell-badge", variantClass, textClass, className].filter(Boolean).join(" ");

  if (onClick) {
    return (
      <button type="button" className={classes} style={style} onClick={onClick}>
        {label}
      </button>
    );
  }

  return (
    <span className={classes} style={style}>
      {label}
    </span>
  );
};

export default CellBadge;
