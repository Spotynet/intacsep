import { useState } from 'react';
import { useLocation } from 'react-router-dom';

const BREADCRUMB_MAP = {
  // Dashboard group
  "/dashboard/general":         ["Dashboard", "General"],
  "/dashboard/anomalias":       ["Dashboard", "Anomalías"],
  "/reporte-eventos":           ["Dashboard", "Reporte Eventos"],
  "/reporte-estadisticas":      ["Dashboard", "Reporte de Puntualidad"],
  "/reporte-control-patios":    ["Dashboard", "Dashboard Patios"],
  "/reporte-detalle-patios":    ["Dashboard", "Reporte Patios"],

  // Monitoreo group
  "/bitacoras":                 ["Monitoreo", "Bitácoras"],
  "/planes-embarque":           ["Monitoreo", "Planes de Embarque"],
  "/buscador-plan":             ["Monitoreo", "Buscador de Plan"],
  "/placa-test":                ["Monitoreo", "Control de Patios"],

  // Configuración — Catálogos
  "/tipos_monitoreo":           ["Configuración", "Catálogos", "Tipos de Monitoreo"],
  "/eventos":                   ["Configuración", "Catálogos", "Eventos"],
  "/clientes":                  ["Configuración", "Catálogos", "Clientes"],
  "/origenes":                  ["Configuración", "Catálogos", "Orígenes"],
  "/destinos":                  ["Configuración", "Catálogos", "Destinos"],
  "/lineas-transporte":         ["Configuración", "Catálogos", "Líneas de Transporte"],
  "/operadores":                ["Configuración", "Catálogos", "Operadores"],

  // Configuración — Sistema
  "/usuarios":                  ["Configuración", "Sistema", "Usuarios"],
  "/roles":                     ["Configuración", "Sistema", "Roles"],
  "/integraciones":             ["Configuración", "Sistema", "Integraciones"],

  // Configuración — Auditoría
  "/auditoria/bitacoras":       ["Configuración", "Auditoría", "Bitácoras"],
};

const PageHeader = ({ title, count, children, filters, filterActions, onToggleSidebar, defaultFiltersOpen = false, hasActiveFilters = false, onClearFilters }) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(defaultFiltersOpen);
  const { pathname } = useLocation();

  const crumbs = BREADCRUMB_MAP[pathname] ?? null;

  return (
    <div className="bits-header-container">
      <div className="bits-header">
        <div className="bits-header__left">
          {onToggleSidebar && (
            <button
              type="button"
              className="btn btn-sm bits-menu-toggle d-md-none me-2"
              onClick={onToggleSidebar}>
              <i className="fa fa-bars"></i>
            </button>
          )}
          <h1 className="bits-header__title">
            {crumbs && crumbs.length > 1 && crumbs.slice(0, -1).map((crumb, i) => (
              <span key={i} className="bits-breadcrumb__ancestor">
                {crumb}
                <span className="bits-breadcrumb__sep">/</span>
              </span>
            ))}
            <span className="bits-breadcrumb__current">{crumbs ? crumbs[crumbs.length - 1] : title}</span>
          </h1>
        </div>
        <div className="bits-header__right">
          {filterActions}
          {filters && (
            <button
              type="button"
              className={`filter-toggle-btn${isFiltersOpen ? ' is-active' : ''}${hasActiveFilters ? ' has-filters' : ''}`}
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              title={isFiltersOpen ? "Ocultar filtros" : "Mostrar filtros"}
            >
              <i className="fa fa-sliders"></i>
              <span>Filtros</span>
              {hasActiveFilters && (
                <i
                  className="fa fa-times filter-clear-btn"
                  onClick={(e) => { e.stopPropagation(); onClearFilters?.(); }}
                  title="Limpiar filtros"
                />
              )}
            </button>
          )}
          {children}
        </div>
      </div>

      {filters && (
        <div className={`bits-header-filters ${isFiltersOpen ? 'is-open' : ''}`}>
          <div className="bits-header-filters__content">
            {filters}
          </div>
        </div>
      )}
    </div>
  );
};

export default PageHeader;
