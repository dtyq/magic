/** URLs remain browser data. Application route matching never runs in the APM package. */
export const plugin = () => ({
	sendInit: true,
	routeMode: "history" as const,
	extractPid: (url: string) => new URL(url, window.location.href).pathname,
})
