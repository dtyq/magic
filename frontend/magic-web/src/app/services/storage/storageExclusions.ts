/**
 * Known storage issue excluded from quota diagnostics so other consumers remain visible.
 * The database is still used by the application; this only changes observability output.
 */
export const KNOWN_EXCLUDED_INDEXED_DB_NAME = "MAGIC:stream-record-db"
