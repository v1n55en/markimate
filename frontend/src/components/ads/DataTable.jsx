export default function DataTable({
  columns = [],
  data = [],
  emptyMessage = 'Belum ada data untuk ditampilkan.',
  keyField = 'id',
}) {
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...styles.th,
                  textAlign: col.align || 'left',
                  width: col.width || 'auto',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={styles.emptyTd}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={row[keyField] || idx} style={styles.tr}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      ...styles.td,
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.render ? col.render(row[col.key], row, idx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
    borderRadius: '8px',
    border: '1px solid var(--border-muted)',
    backgroundColor: 'var(--bg-surface)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.825rem',
    fontFamily: 'var(--font-sans)',
  },
  th: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    borderBottom: '1px solid var(--border-muted)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  },
  tr: {
    borderBottom: '1px solid var(--border-muted)',
    transition: 'background-color var(--transition-fast)',
  },
  td: {
    padding: '0.85rem 1rem',
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
  },
  emptyTd: {
    padding: '2.5rem 1rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
};
