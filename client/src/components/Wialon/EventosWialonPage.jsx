import EventosWialonPanel from "./EventosWialonPanel";

// Thin wrapper for the /eventos-wialon route.
// All logic and UI lives in EventosWialonPanel so it can be reused embedded
// inside BitacoraDetailPage scoped to that bitácora's GPS units.
const EventosWialonPage = () => <EventosWialonPanel />;

export default EventosWialonPage;
