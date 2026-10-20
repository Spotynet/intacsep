import {useState, useRef, useEffect} from "react";
import {createPortal} from "react-dom";

const Tooltip = ({children, text, position = "top"}) => {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef(null);
  const [style, setStyle] = useState({});

  useEffect(() => {
    if (!visible || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const gap = 8;
    let top, left, transform = "";

    if (position === "top") {
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
      transform = "translate(-50%, -100%)";
    } else if (position === "bottom") {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
      transform = "translate(-50%, 0)";
    } else if (position === "left") {
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
      transform = "translate(-100%, -50%)";
    } else {
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
      transform = "translate(0, -50%)";
    }

    setStyle({position: "fixed", top, left, transform});
  }, [visible, position]);

  const bubble = visible && text
    ? createPortal(
        <span className={`tooltip-bubble tooltip-${position}`} style={{...style, position: "fixed", animation: "tooltipFadeIn 0.12s ease"}}>
          {text}
        </span>,
        document.body
      )
    : null;

  return (
    <span
      ref={wrapperRef}
      className="tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      {children}
      {bubble}
    </span>
  );
};

export default Tooltip;
