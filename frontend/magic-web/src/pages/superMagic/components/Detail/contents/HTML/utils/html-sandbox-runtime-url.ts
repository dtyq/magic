/**
 * Resolve the runtime bundle owned by the current Magic Web deployment.
 *
 * The HTML Sandbox shell may be shared by multiple environments, so the shell
 * must load the runtime from the host deployment instead of relying only on its
 * own inline bundle.
 */
export function getHtmlSandboxRuntimeUrl(): string {
	if (typeof window === "undefined") return ""

	const baseUrl = import.meta.env.BASE_URL || "/"
	const hostBaseUrl = new URL(baseUrl, window.location.origin)
	return new URL("husky-runtime.js", hostBaseUrl).toString()
}
