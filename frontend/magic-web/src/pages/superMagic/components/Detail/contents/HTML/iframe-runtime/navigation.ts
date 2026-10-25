export interface NavigationOptions {
	search: string
	hash: string
	requestId: string
}

/** Nested srcdoc pages need URL state before their first user-authored script. */
export default function installNavigation(options: NavigationOptions) {
	const target = window as Window & { __MAGIC_HTML_NAVIGATION__?: NavigationOptions }
	target.__MAGIC_HTML_NAVIGATION__ = options
	try {
		window.history.replaceState(
			null,
			"",
			window.location.pathname + options.search + options.hash,
		)
	} catch {
		// about:srcdoc and restricted WebViews may reject URL replacement.
	}
}
