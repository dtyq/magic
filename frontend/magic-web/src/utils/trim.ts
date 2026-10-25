/**
 * Trim leading/trailing whitespace from a form input value.
 *
 * Used as an antd Form.Item `normalize` helper to keep identifier inputs
 * (phone / email / username / authorization code) clean before validation and
 * submit, so pasted values with stray surrounding spaces are not rejected as
 * malformed nor forwarded verbatim to the backend. Non-string values are
 * returned untouched (antd may pass `undefined` for untouched fields).
 */
export const trimInputValue = (value: unknown): unknown =>
	typeof value === "string" ? value.trim() : value
