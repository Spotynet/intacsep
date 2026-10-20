import React, {useEffect, useRef} from "react";
import usePagination from "../hooks/usePagination";
import {Select} from "./Select";

/**
 * Builds the array of page numbers / ellipsis markers to render in the pager.
 * Always shows first, last, and a window of currentPage ± 1.
 * Gaps wider than 1 are replaced with the string "...".
 *
 * Examples (totalPages = 10):
 *   currentPage = 1  →  [1, 2, "...", 10]
 *   currentPage = 5  →  [1, "...", 4, 5, 6, "...", 10]
 *   currentPage = 9  →  [1, "...", 8, 9, 10]
 */
const getPageNumbers = (currentPage, totalPages) => {
  if (totalPages <= 7) return Array.from({length: totalPages}, (_, i) => i + 1);

  const visible = new Set([1, totalPages, currentPage]);
  if (currentPage > 1) visible.add(currentPage - 1);
  if (currentPage < totalPages) visible.add(currentPage + 1);

  const sorted = Array.from(visible).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...");
    result.push(sorted[i]);
  }
  return result;
};

/**
 * DataTable — reusable paginated table component.
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 * data {Array}
 *   The items to display. Should already be filtered by the parent.
 *   The component only handles pagination internally.
 *
 * columns {Array<ColumnDef>}
 *   Column definitions rendered left-to-right.
 *
 *   ColumnDef shape:
 *   {
 *     key           {string}            – Unique key; used as React key and as fallback
 *                                         accessor on the row object (row[key]).
 *     header        {string|ReactNode}  – Content rendered in <th>.
 *     width         {string}            – Optional CSS width for the <th>/<td> (e.g. "60px").
 *     className     {string}            – CSS class(es) applied to every <td> in this column.
 *     headerClassName {string}          – CSS class(es) applied to the <th>.
 *     render        {Function}          – Optional custom cell renderer.
 *                                         Signature: (row, { rowIndex, currentPage, itemsPerPage }) => ReactNode
 *                                         When omitted, renders row[key] ?? "".
 *   }
 *
 * actions {Array<ActionDef>}
 *   Appends an "Acciones" column at the far right. Omit (or pass []) to hide it.
 *
 *   ActionDef shape:
 *   {
 *     icon      {string}           – Font Awesome class string (e.g. "fas fa-edit").
 *     label     {string}           – Optional text rendered next to the icon.
 *     className {string}           – CSS class(es) for the <button> (e.g. "btn btn-primary").
 *     title     {string}           – Optional tooltip via the title attribute.
 *     onClick   {Function}         – Called with the row object: (row) => void.
 *     show      {boolean|Function} – Controls visibility.
 *                                    • Omitted → always visible.
 *                                    • boolean / undefined / null → visible only when truthy.
 *                                    • (row) => boolean → evaluated per row.
 *   }
 *
 * emptyMessage {string}
 *   Text shown when data is empty (default: "No se encontraron elementos.").
 *
 * maxHeight {string}
 *   CSS max-height of the scrollable table wrapper (default: "60vh").
 *
 * itemsPerPageOptions {Array<number>}
 *   Options for the items-per-page selector (default: [25, 50, 100]).
 *
 * initialItemsPerPage {number}
 *   Initially selected items-per-page value (default: 25).
 *
 * rowKey {string|Function}
 *   Used as the React key for each row.
 *   • string  → row[rowKey]
 *   • function → rowKey(row)
 *   Default: (row) => row._id
 *
 * stickyHeader {boolean}
 *   Whether to pin the <thead> while scrolling (default: true).
 *
 * ─── Usage example ────────────────────────────────────────────────────────────
 *
 *   <DataTable
 *     data={filteredDestinos}
 *     columns={[
 *       {
 *         key: "numericId",
 *         header: "ID",
 *         width: "60px",
 *         className: "text-center fw-bold",
 *         render: (row) => row.numericId?.toString().padStart(4, "0") ?? "N/A",
 *       },
 *       { key: "nombre",  header: "Nombre"  },
 *       { key: "estado",  header: "Estado"  },
 *       { key: "cliente", header: "Cliente" },
 *     ]}
 *     actions={[
 *       {
 *         icon: "fas fa-edit",
 *         className: "btn btn-primary",
 *         onClick: (row) => handleEdit(row),
 *         show: roleData?.destinos?.update,
 *       },
 *       {
 *         icon: "fas fa-trash",
 *         className: "btn btn-danger",
 *         onClick: (row) => handleDelete(row._id),
 *         show: roleData?.destinos?.delete,
 *       },
 *     ]}
 *     emptyMessage="No se encontraron destinos que coincidan con los filtros."
 *   />
 */
const DataTable = ({
  data = [],
  columns = [],
  actions = [],
  emptyMessage = "No se encontraron elementos que coincidan con los filtros.",
  maxHeight = "60vh",
  itemsPerPageOptions = [25, 50, 100],
  initialItemsPerPage = 25,
  rowKey = (row) => row._id,
  stickyHeader = true,
  highlightId = null,
  rowClassName = null,
  loading = false,
  renderExpansion = null,
  expandedRows = [],
  onExpandedRowsChange = null,
  // ── Server-side mode ────────────────────────────────────────
  // Pass these to take over pagination externally (e.g. API-paginated data).
  serverSide = false,
  serverPage = 1,
  serverTotalItems = 0,
  serverTotalPages = 1,
  serverItemsPerPage = 25,
  onPageChange = null,
  onItemsPerPageChange = null,
  // ── Sort ────────────────────────────────────────────────────
  // Column defs can include sortable:true + sortKey:"fieldName".
  // DataTable calls onSortChange(field) when a sortable header is clicked.
  sortField = null,
  sortOrder = "asc",
  onSortChange = null,
}) => {
  const highlightRef = useRef(null);

  const getRowKey = (row) =>
    typeof rowKey === "function" ? rowKey(row) : row[rowKey];

  // Client-side pagination (used when serverSide=false)
  const client = usePagination(data, initialItemsPerPage);

  // Resolved values — either server-controlled or client-computed
  const currentPage       = serverSide ? serverPage       : client.currentPage;
  const itemsPerPage      = serverSide ? serverItemsPerPage : client.itemsPerPage;
  const totalItems        = serverSide ? serverTotalItems  : client.totalItems;
  const totalPages        = serverSide ? serverTotalPages  : client.totalPages;
  const startItem         = serverSide ? (serverPage - 1) * serverItemsPerPage + 1 : client.startItem;
  const endItem           = serverSide ? Math.min(serverPage * serverItemsPerPage, serverTotalItems) : client.endItem;
  const displayData       = serverSide ? data              : client.paginatedData;
  const handlePageChange  = serverSide ? onPageChange      : client.handlePageChange;
  const handleItemsChange = serverSide
    ? (val) => onItemsPerPageChange?.(Number(val))
    : (val) => client.handleItemsPerPageChange({target: {value: val}});

  const handleSort = (col) => {
    if (!col.sortable || !onSortChange) return;
    const key = col.sortKey ?? col.key;
    onSortChange(key);
  };

  useEffect(() => {
    if (serverSide || !highlightId) return;
    const idx = data.findIndex((row) => getRowKey(row) === highlightId);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / itemsPerPage) + 1;
    if (targetPage !== currentPage) client.handlePageChange(targetPage);
  }, [highlightId]); // eslint-disable-line

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({behavior: "smooth", block: "center"});
    }
  });

  const hasActions = actions.length > 0;
  const colCount = columns.length + (hasActions ? 1 : 0);

  const isActionVisible = (action, row) => {
    if (!("show" in action)) return true;
    if (typeof action.show === "function") return action.show(row);
    return !!action.show;
  };

  const isExpanded = (row) => {
    const key = getRowKey(row);
    return Array.isArray(expandedRows) ? expandedRows.includes(key) : false;
  };

  const toggleExpand = (row, e) => {
    if (!renderExpansion) return;
    // Don't toggle if clicking a button or link
    if (e.target.closest("button, a")) return;

    const key = getRowKey(row);
    const newExpanded = isExpanded(row)
      ? expandedRows.filter((k) => k !== key)
      : [...expandedRows, key];
    onExpandedRowsChange?.(newExpanded);
  };

  return (
    <div className="table-wrapper reusable-datatable" style={maxHeight === "100%" ? undefined : {maxHeight, overflowY: "auto"}}>
      <div className="table-responsive">
          <table className="table">
            <thead
              className="table-light"
              style={
                stickyHeader && maxHeight !== "100%"
                  ? {position: "sticky", top: 0, zIndex: 1, backgroundColor: "#f8f9fa"}
                  : undefined
              }>
              <tr>
                {columns.map((col) => {
                  const isSorted = sortField === (col.sortKey ?? col.key);
                  return (
                    <th
                      key={col.key}
                      className={[col.headerClassName, col.sortable ? "dt-sortable" : ""].filter(Boolean).join(" ")}
                      style={{...(col.width ? {width: col.width} : {}), ...(col.hidden ? {display:"none"} : {})}}
                      onClick={() => handleSort(col)}>
                      <div className="dt-th-inner">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <i className={`fa fa-sort${isSorted ? (sortOrder === "asc" ? "-up" : "-down") : ""} dt-sort-icon${isSorted ? " dt-sort-icon--active" : ""}`}></i>
                        )}
                      </div>
                    </th>
                  );
                })}
                {hasActions && <th className="text-end">Acciones</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({length: 8}).map((_, i) => (
                  <tr key={i} className="dt-skeleton-row">
                    {Array.from({length: colCount}).map((_, j) => (
                      <td key={j}><div className="dt-skeleton-cell" style={{width: `${55 + ((i * 3 + j * 7) % 35)}%`}} /></td>
                    ))}
                  </tr>
                ))
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center py-4">
                    <p className="text-muted mb-0">{emptyMessage}</p>
                  </td>
                </tr>
              ) : (
                displayData.map((row, rowIndex) => {
                  const key = getRowKey(row);
                  const isHighlighted = highlightId && key === highlightId;
                  const expanded = isExpanded(row);
                  const extraClass = typeof rowClassName === "function" ? rowClassName(row) : (rowClassName || "");
                  
                  return (
                    <React.Fragment key={key}>
                      <tr
                        ref={isHighlighted ? highlightRef : null}
                        className={[
                          isHighlighted ? "dt-row-highlighted" : "",
                          expanded ? "dt-row-expanded" : "",
                          renderExpansion ? "dt-row-expandable" : "",
                          extraClass
                        ].filter(Boolean).join(" ")}
                        onClick={(e) => toggleExpand(row, e)}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={[col.className, col.cellClassName].filter(Boolean).join(" ")}
                            data-label={typeof col.header === "string" ? col.header : col.key}>
                            {col.render
                              ? col.render(row, {rowIndex, currentPage, itemsPerPage, isExpanded: expanded})
                              : (row[col.key] ?? "")}
                          </td>
                        ))}
                        {hasActions && (
                          <td className="text-end" data-label="Acciones">
                            <div className="action-buttons">
                              {actions.map((action, i) => {
                                if (!isActionVisible(action, row)) return null;
                                  const isDisabled = typeof action.disabled === "function" ? action.disabled(row) : !!action.disabled;

                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      className={`${action.className} ${isDisabled ? "disabled" : ""}`}
                                      title={isDisabled ? "Acción no permitida para el estado actual" : action.title}
                                      onClick={() => !isDisabled && action.onClick(row)}
                                      disabled={isDisabled}>
                                      {action.icon && <i className={action.icon}></i>}
                                    {action.label && (
                                      <span className={action.icon ? "ms-1" : ""}>{action.label}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        )}
                      </tr>
                      {expanded && renderExpansion && (
                        <tr className="dt-expansion-row">
                          <td colSpan={colCount} className="dt-expansion-cell">
                            {renderExpansion(row)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      {totalItems > 0 && (
        <div className="pagination-container" style={{flexShrink: 0}}>
          <div className="pagination-content">
            <div className="pagination-info">
              <div className="items-per-page">
                <label>Por página:</label>
                <Select
                  value={String(itemsPerPage)}
                  onChange={handleItemsChange}
                  options={itemsPerPageOptions.map((n) => ({value: String(n), label: String(n)}))}
                  searchable={false}
                  clearable={false}
                  className="dt-page-size-select"
                />
              </div>
            </div>

            <div className="pagination-stats">
              <span className="stats-text">{`${startItem}-${endItem} de ${totalItems}`}</span>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}>
                <i className="fa fa-chevron-left"></i>
              </button>

              <div className="page-numbers">
                {getPageNumbers(currentPage, totalPages).map((page, i) =>
                  page === "..." ? (
                    <span key={`ellipsis-${i}`} className="page-ellipsis">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      className={`page-btn ${page === currentPage ? "active" : ""}`}
                      onClick={() => handlePageChange(page)}>
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}>
                <i className="fa fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
