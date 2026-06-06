/** Minimum digit count for integers quoted before JSON.parse (aligns with MAX_SAFE_INTEGER) */
const LARGE_INTEGER_MIN_DIGITS = 16

/**
 * Matches JSON numeric values with 16+ digits so they can be quoted before parse.
 * Only targets bare JSON numbers (after `:`, `[`, `,`), not numbers inside strings.
 */
const LARGE_INTEGER_JSON_PATTERN = new RegExp(
	`([:\\[,]\\s*)(-?\\d{${LARGE_INTEGER_MIN_DIGITS},})(?=\\s*[,}\\]])`,
	"g",
)

/**
 * Parses JSON text while preserving integers beyond Number.MAX_SAFE_INTEGER as strings.
 * Must run on raw response text — native JSON.parse already loses precision for large numbers.
 */
export function parseJsonLargeIntAsString(text: string): unknown {
	const sanitized = text.replace(LARGE_INTEGER_JSON_PATTERN, '$1"$2"')
	return JSON.parse(sanitized)
}
