import React from "react";
import {formatDate} from "../../utils/dateUtils"; // Ensure you have a utility to format dates
import {Container, Row, Col} from "react-bootstrap";

const tMatch = (a, b) =>
  (a.internalId && b.internalId && a.internalId === b.internalId) || a.id === b.id;

const getTransporteLabel = (t) => {
  const id = t.id || "";
  if (!id) return "Sin ID";
  if (id.startsWith("T") && id.includes("_")) return id;
  const parts = id.split("_");
  if (parts.length >= 3) return `${parts[1]} - ${parts[2]}`;
  if (parts.length === 2) return `${parts[0]} - ${parts[1]}`;
  return id;
};

const BitacoraDetail = React.forwardRef(({bitacora, transporteId = ""}, ref) => {
  // Find the selected transporte object (needed for internalId-aware matching)
  const selectedTransporte = transporteId
    ? bitacora.transportes.find((t) => t.id === transporteId || t.internalId === transporteId)
    : null;

  const filteredTransportes = selectedTransporte
    ? bitacora.transportes.filter((t) => tMatch(t, selectedTransporte))
    : bitacora.transportes;

  const filteredEventos = selectedTransporte
    ? bitacora.eventos.filter((evento) =>
        evento.transportes.some((t) => tMatch(t, selectedTransporte))
      )
    : bitacora.eventos;

  return (
    <Container ref={ref} id="pdfBitacora">
      <Container className="my-4">
        <Container className="header">
          <Row className="flex-center">
            <img src="/intacespTextLogo.jpeg" alt="IntacsepLogo" />
          </Row>
          <Row>
            <h1>Bitácora de monitoreo {bitacora.id}</h1>
          </Row>
        </Container>

        <Container className="body">
          <Row>
            <div className="card-body">
              <div className="row ">
                {/* Column 1 */}
                <div className="col-6">
                  <h6 className="card-subtitle mb-2">
                    <strong>Folio Servicio:</strong> {bitacora.folio_servicio}
                  </h6>
                  <h6 className="card-subtitle mb-2">
                    <strong>No. Bitácora:</strong> {bitacora.bitacora_id}
                  </h6>
                  <h6 className="card-subtitle mb-2">
                    <strong>Cliente:</strong> {bitacora.cliente}
                  </h6>
                  <h6 className="card-subtitle mb-2">
                    <strong>Tipo Monitoreo:</strong> {bitacora.monitoreo}
                  </h6>

                  {/* <h6 className="card-subtitle mb-2">
                    <strong>Linea Transporte:</strong> {bitacora.linea_transporte}
                  </h6> */}
                </div>

                {/* Column 4 */}
                <div className="col-6">
                  <h6 className="card-subtitle mb-2">
                    <strong>Origen:</strong> {bitacora.origen || "No especificado"}
                  </h6>
                  <h6 className="card-subtitle mb-2">
                    <strong>Destino:</strong> {bitacora.destino || "No especificado"}
                  </h6>
                  {/* <h6 className="card-subtitle mb-2">
                    <strong>Operador:</strong> {bitacora.operador}
                  </h6>
                  <h6 className="card-subtitle mb-2">
                    <strong>Teléfono:</strong> {bitacora.telefono}
                  </h6> */}
                </div>
              </div>
            </div>
          </Row>
        </Container>
      </Container>

      <Container className="transportes">
        <Row className="justify-content-center w-100 text-center">
          <h2>Transportes</h2>
          <h6>
            {filteredTransportes.length > 1
              ? `${filteredTransportes.length} Transportes Monitoreados`
              : filteredTransportes.length === 1
              ? `${filteredTransportes.length} Transporte Monitoreado`
              : "No transportes registrados"}
          </h6>
        </Row>
        <Col className="mt-3">
          {filteredTransportes.map((transporte, index) => {
            // Find the "Validacion" event
            const eventoValidacion = bitacora.eventos.find(
              (evento) => evento.nombre?.toLowerCase() === "validación".toLowerCase()
            );

            const eventoCierre = bitacora.eventos.find(
              (evento) => evento.nombre?.toLowerCase() === "cierre de servicio".toLowerCase()
            );

            // Get the corresponding transporte object inside evento.transportes
            const transporteValidacion = eventoValidacion?.transportes.find((t) => tMatch(t, transporte));
            const transporteCierre = eventoCierre?.transportes.find((t) => tMatch(t, transporte));

            // Extract dates from the found transportes
            const inicioMonitoreo = transporteValidacion
              ? transporteValidacion.inicioMonitoreo
              : "No disponible";
            const finalMonitoreo = transporteCierre
              ? transporteCierre.finalMonitoreo
              : "No disponible";

            return (
              <Row key={index}>
                <hr />
                <div className="card-body transportCard">
                  <div className="d-flex flex-row title fw-bold fs-4">{getTransporteLabel(transporte)}</div>
                  <Row>
                    <Col className="text-center">
                      <p>
                        <strong>Inicio Monitoreo</strong> <br />
                        {formatDate(inicioMonitoreo)}
                      </p>
                    </Col>
                    <Col className="text-center">
                      <p>
                        <strong>Final Monitoreo</strong> <br />
                        {formatDate(finalMonitoreo)}
                      </p>
                    </Col>
                  </Row>
                  <div className="row text-center mt-2">
                    <div className="col-4">
                      <h6 className="card-subtitle mb-2">
                        <strong>Linea Transporte </strong> <br />
                        {transporte.lineaTransporte}
                      </h6>
                    </div>
                    <div className="col-4">
                      <h6 className="card-subtitle mb-2">
                        <strong>Operador</strong> <br /> {transporte.operador}
                      </h6>
                    </div>
                    <div className="col-4">
                      <h6 className="card-subtitle mb-2">
                        <strong>Telefono</strong> <br /> {transporte.telefono}
                      </h6>
                    </div>
                  </div>
                  <div className="row px-4 flex gap-3 mt-2">
                    {/* Column 1 */}
                    <div className="col-md-6 text-center">
                      <h5 className="fw-semibold">Tracto</h5>
                      <div className="row">
                        <div className="col-4">
                          <h6 className="card-subtitle mb-2">
                            <strong>Eco</strong>
                            <br /> {transporte.tracto.eco}
                          </h6>
                          <h6 className="card-subtitle mb-2">
                            <strong>placa</strong> <br /> {transporte.tracto.placa}
                          </h6>
                        </div>
                        <div className="col-4">
                          <h6 className="card-subtitle mb-2">
                            <strong>Modelo</strong> <br /> {transporte.tracto.modelo}
                          </h6>
                          <h6 className="card-subtitle mb-2">
                            <strong>Color</strong>
                            <br /> {transporte.tracto.color}
                          </h6>
                        </div>
                        <div className="col-4">
                          <h6 className="card-subtitle mb-2">
                            <strong>Marca</strong> <br /> {transporte.tracto.marca}
                          </h6>
                          <h6 className="card-subtitle mb-2">
                            <strong>Tipo</strong> <br /> {transporte.tracto.tipo}
                          </h6>
                        </div>
                      </div>
                    </div>
                    {/* Column 4 */}
                    <div className="col-md-5 text-center mt-2 pt-0">
                      <h5 className="fw-bold">Remolque</h5>
                      <div className="row">
                        <div className="col-4">
                          <h6 className="card-subtitle mb-2">
                            <strong>Eco</strong>
                            <br /> {transporte.remolque.eco}
                          </h6>
                          <h6 className="card-subtitle mb-2">
                            <strong>Placa</strong> <br /> {transporte.remolque.placa}
                          </h6>
                        </div>
                        <div className="col-4">
                          <h6 className="card-subtitle mb-2">
                            <strong>Color</strong> <br /> {transporte.remolque.color}
                          </h6>
                          <h6 className="card-subtitle mb-2">
                            <strong>Capacidad</strong> <br /> {transporte.remolque.capacidad}
                          </h6>
                        </div>
                        <div className="col-4">
                          <h6 className="card-subtitle mb-2">
                            <strong>Sello</strong> <br /> {transporte.remolque.sello}
                          </h6>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Row>
            );
          })}
        </Col>
      </Container>

      <Container className="eventos">
        <Row className="justify-content-center w-100 text-center">
          <h2>Eventos</h2>
          <h6>{`${filteredEventos.length} Eventos registrados`}</h6>
        </Row>
        <Col className="mt-3">
          {filteredEventos.map((evento, index) => (
            <Row md={12} key={index}>
              <Container className="mb-4">
                <div className="row w-100 d-flex justify-center items-center">
                  <h3 className="text-center fw-bold ">{evento.nombre}</h3>
                  <div className="col-6 d-flex flex-column mt-2">
                    <p className=" fw-bold fs-6 text-center mb-4">Detalles</p>
                    <p>
                      <strong>Descripción:</strong>
                    </p>
                    <p>{evento.descripcion}</p>
                    <p className="mt-1">
                      <strong>Registrado por: </strong> {evento.registrado_por}
                    </p>
                    <p className="mt-1">
                      <strong>Frecuencia: </strong> {`${evento.frecuencia} min`}
                    </p>
                    <p className="mt-1">
                      <strong>Fecha:</strong>{" "}
                      {new Date(evento.createdAt).toLocaleDateString("es-MX", {
                        timeZone: "America/Mexico_City",
                      })}
                    </p>
                    <p className="mt-1">
                      <strong>Hora:</strong>{" "}
                      {new Date(evento.createdAt).toLocaleTimeString("es-MX", {
                        timeZone: "America/Mexico_City",
                      })}
                    </p>
                  </div>
                  {/* <Col md={1} className="line">
                    <div className="circle"></div>
                    <div className="line"></div>
                  </Col> */}
                  <div className="col-6 d-flex flex-column text-center">
                    <p className=" fw-bold fs-6 text-center">
                      {evento.transportes?.length > 1 ? "GPSs " : "GPSs"}
                    </p>
                    {evento.transportes
                      ?.filter((t) =>
                        selectedTransporte ? filteredTransportes.some((ft) => tMatch(ft, t)) : true
                      )
                      .map((t) => (
                        <Row>
                          <hr />
                          {(() => {
                            // Construir la lista de entradas de GPS: usar todos los gpsData; si no hay, usar gpsUnits como identidad
                            const entries =
                              t.gpsData && t.gpsData.length > 0
                                ? t.gpsData
                                : t.gpsUnits && t.gpsUnits.length > 0
                                ? t.gpsUnits.map((u) => ({
                                    wialonId: u.wialonId,
                                    name: u.name,
                                    data: null,
                                  }))
                                : [{name: null, wialonId: null, data: null}];

                            const buildFromRegistro = (reg = {}) => ({
                              duracion: reg.duracion || "--",
                              coordenadas: reg.coordenadas || "--",
                              velocidad: reg.velocidad || "--",
                              ubicacion: reg.ubicacion || "--",
                              ultimo_posicionamiento: reg.ultimo_posicionamiento || "--",
                            });

                            return entries.map((g, idx) => {
                              const header = `${g?.name ?? "NA"}${
                                g?.wialonId ? ` (ID: ${g.wialonId})` : ""
                              }`;
                              const data =
                                g?.data && g.data.coordenadas
                                  ? g.data
                                  : t.registro && t.registro.coordenadas
                                  ? buildFromRegistro(t.registro)
                                  : null;

                              return (
                                <div key={`${t.id}-${g?.wialonId || idx}`} className="w-100">
                                  <p className="text-center fst-italic fw-bold">{header}</p>
                                  <Col className="text-start">
                                    <p>
                                      <span className="fw-bold">Duración:</span>
                                      {` ${data?.duracion ?? "--"}`}
                                    </p>
                                    <p>
                                      <span className="fw-bold">Coordenadas:</span>
                                      {` ${data?.coordenadas ?? "--"}`}
                                    </p>
                                    <p>
                                      <span className="fw-bold">Velocidad:</span>
                                      {` ${data?.velocidad ?? "--"}${
                                        data?.velocidad ? " km/h" : ""
                                      }`}
                                    </p>
                                  </Col>
                                  <Col className="text-start">
                                    <p>
                                      <span className="fw-bold">Ubicación:</span>
                                      {` ${data?.ubicacion ?? "--"}`}
                                    </p>
                                    <p>
                                      <span className="fw-bold">Último posicionamiento:</span>{" "}
                                      <br />
                                      {` ${data?.ultimo_posicionamiento ?? "--"}`}
                                    </p>
                                  </Col>
                                  {idx < entries.length - 1 && <hr />}
                                </div>
                              );
                            });
                          })()}
                        </Row>
                      ))}

                    {/* <p className="mt-4">
                      <strong>Ubicación: </strong> {evento.ubicacion}
                    </p>
                    <p className="mt-4">
                      <strong>Último Posicionamiento: </strong> {evento.ultimo_posicionamiento}
                    </p>
                    <p className="mt-4">
                      <strong>Velocidad: </strong> {evento.velocidad}
                    </p>
                    <p className="mt-4">
                      <strong>Coordenadas: </strong> {evento.coordenadas}
                    </p> */}
                  </div>
                </div>
              </Container>
            </Row>
          ))}
        </Col>
      </Container>
    </Container>
  );
});

export default BitacoraDetail;
