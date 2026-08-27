import {useEffect} from "react";

const ModalTemplate = ({
  show,
  title,
  onClose,
  onSubmit,
  children,
  cancelText = "Cancelar",
  submitText = "Guardar",
  cancelClass = "btn btn-secondary",
  submitClass = "btn btn-primary",
  submitDisabled = false,
  hideFooter = false,
  wide = false,
  extraWide = false,
  width,
  className = "",
}) => {
  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [show]);

  if (!show) return null;

  const containerClasses = [
    "pm-container",
    wide && "pm-container--wide",
    extraWide && "pm-container--extra-wide",
    className,
  ].filter(Boolean).join(" ");

  const containerStyle = width ? { maxWidth: width } : undefined;

  return (
    <section className="customModal">
      <div className="pm-backdrop" onClick={onClose}></div>
      <div className={containerClasses} style={containerStyle}>
        <div className="pm-header">
          <h2>{title}</h2>
          <button className="pm-close" onClick={onClose}>
            ×
          </button>
        </div>
        <hr />
        <div className="modal-scroll-body">
          <form className="pm-body" onSubmit={onSubmit}>
            {children}
            {!hideFooter && (
              <div className="pm-footer">
                <button type="button" className={cancelClass} onClick={onClose}>
                  {cancelText}
                </button>
                <button type="submit" className={submitClass} disabled={submitDisabled}>
                  {submitText}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
};

export default ModalTemplate;
