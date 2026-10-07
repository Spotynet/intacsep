import {useEffect} from "react";
import {createPortal} from "react-dom";

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
  elevated = false,
  formId = "modal-template-form",
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

  const overlayClasses = ["customModal", elevated && "customModal--elevated"]
    .filter(Boolean)
    .join(" ");

  const containerStyle = width ? { maxWidth: width } : undefined;

  const modal = (
    <section className={overlayClasses}>
      <div className="pm-backdrop" onClick={onClose}></div>
      <div className={containerClasses} style={containerStyle}>
        <div className="pm-header">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          <button className="pm-close" onClick={onClose}>
            ×
          </button>
        </div>
        <hr />
        <div className="modal-scroll-body">
          <form id={formId} className="pm-body" onSubmit={onSubmit}>
            {children}
          </form>
        </div>
        {!hideFooter && (
          <div className="pm-footer">
            <button type="button" className={cancelClass} onClick={onClose}>
              {cancelText}
            </button>
            <button
              type="submit"
              form={formId}
              className={submitClass}
              disabled={submitDisabled}
            >
              {submitText}
            </button>
          </div>
        )}
      </div>
    </section>
  );

  // Elevated confirms (and any nested use) mount on body to avoid form nesting
  // and to sit above an already-open modal.
  if (elevated && typeof document !== "undefined") {
    return createPortal(modal, document.body);
  }

  return modal;
};

export default ModalTemplate;
