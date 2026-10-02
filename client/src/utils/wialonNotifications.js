export const TRIGGER_LABELS = {
  speed: "Velocidad",
  speeding_gis: "Exceso de velocidad",
  geozone: "Geocerca",
  sensor_value: "Sensor",
  alarm: "Alarma",
  digital_input: "Entrada digital",
  msg_param: "Parámetro de mensaje",
  outage: "Desconexión",
  driver: "Conductor",
  route_control: "Ruta",
  service_intervals: "Mantenimiento",
  interposition: "Distancia",
  msgs_counter: "Mensajes",
  sms: "SMS",
  address: "Dirección",
  expression: "Expresión",
  tag: "Etiqueta",
  tag_alarm: "Alarma de etiqueta",
  fuel_filling: "Carga de combustible",
};

export const TRIGGER_COLORS = {
  speed: "#ef4444",
  speeding_gis: "#dc2626",
  geozone: "#6366f1",
  sensor_value: "#f59e0b",
  alarm: "#dc2626",
  digital_input: "#8b5cf6",
  msg_param: "#3b82f6",
  outage: "#6b7280",
  driver: "#10b981",
  route_control: "#14b8a6",
  service_intervals: "#f97316",
  interposition: "#ec4899",
  msgs_counter: "#06b6d4",
  sms: "#a855f7",
  address: "#84cc16",
  expression: "#0ea5e9",
  tag: "#a3a3a3",
  tag_alarm: "#b91c1c",
  fuel_filling: "#16a34a",
};

export const TRIGGER_ICONS = {
  speed: "fa-tachometer-alt",
  speeding_gis: "fa-tachometer-alt",
  geozone: "fa-draw-polygon",
  sensor_value: "fa-microchip",
  alarm: "fa-exclamation-triangle",
  digital_input: "fa-plug",
  msg_param: "fa-code",
  outage: "fa-wifi-slash",
  driver: "fa-user-tie",
  route_control: "fa-route",
  service_intervals: "fa-wrench",
  interposition: "fa-arrows-alt-h",
  msgs_counter: "fa-envelope",
  sms: "fa-comment-alt",
  address: "fa-map-marker-alt",
  expression: "fa-equals",
  tag: "fa-tag",
  tag_alarm: "fa-bell",
  fuel_filling: "fa-gas-pump",
};

export const TRIGGER_HINTS = {
  speed: "Aviso al superar un límite de velocidad.",
  speeding_gis: "Aviso al rebasar el límite de velocidad del mapa.",
  geozone: "Aviso al entrar, salir o permanecer en una zona.",
  sensor_value: "Aviso cuando un sensor sale del rango permitido.",
  alarm: "Aviso del botón de pánico o alarma.",
  digital_input: "Aviso al cambiar una entrada digital.",
  msg_param: "Aviso cuando un parámetro del equipo cumple una condición.",
  outage: "Aviso si el GPS deja de reportar.",
  driver: "Aviso al asignar o retirar un conductor.",
  route_control: "Aviso si la unidad se desvía de la ruta.",
  service_intervals: "Aviso de mantenimiento pendiente.",
  interposition: "Aviso por la distancia entre unidades.",
  msgs_counter: "Aviso según la cantidad de mensajes.",
  sms: "Aviso al recibir un SMS.",
  address: "Aviso al llegar a una dirección.",
  expression: "Aviso cuando se cumple una expresión.",
  tag: "Aviso asociado a una etiqueta.",
  tag_alarm: "Aviso de alarma de etiqueta.",
  fuel_filling: "Aviso al cargar combustible.",
};

export const getTriggerLabel = (triggerType) => TRIGGER_LABELS[triggerType] || triggerType || "Desconocido";

export const getTriggerHint = (triggerType) =>
  TRIGGER_HINTS[triggerType] || "Aviso configurado en Wialon.";

export const getTriggerIcon = (triggerType) => TRIGGER_ICONS[triggerType] || "fa-bell";
