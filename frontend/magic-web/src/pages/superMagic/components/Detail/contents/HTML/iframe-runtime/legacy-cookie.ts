interface MemoryCookie {
	value: string
	expires?: string
}

type CookieWindow = Window & { memoryCookies?: Record<string, MemoryCookie> }

/** Standalone fallback only; the sandbox's virtual cookie bridge owns normal renders. */
export default function install(_options: Record<string, never>): void {
	void _options
	const cookieWindow = window as CookieWindow
	// The old inline script used a global var, so repeated installation shares cookies.
	if (cookieWindow.memoryCookies === undefined) cookieWindow.memoryCookies = {}
	const memoryCookies = cookieWindow.memoryCookies

	try {
		Object.defineProperty(document, "cookie", {
			get() {
				return Object.entries(memoryCookies)
					.map(([name, data]) => {
						if (data.expires && new Date() > new Date(data.expires)) {
							delete memoryCookies[name]
							return ""
						}
						return `${name}=${encodeURIComponent(data.value)}`
					})
					.filter(Boolean)
					.join("; ")
			},
			set(cookieString: string) {
				const [nameValuePair, ...options] = cookieString.split(";")
				const [name, value] = nameValuePair.trim().split("=")
				if (!name) return
				memoryCookies[name] = { value: decodeURIComponent(value || "") }
				for (const option of options) {
					const [optionName, optionValue] = option.trim().split("=")
					const lowerName = optionName.toLowerCase()
					if (lowerName === "expires") {
						memoryCookies[name].expires = optionValue
					} else if (lowerName === "max-age") {
						const seconds = parseInt(optionValue)
						if (!isNaN(seconds)) {
							const expires = new Date()
							expires.setSeconds(expires.getSeconds() + seconds)
							memoryCookies[name].expires = expires.toUTCString()
						}
					}
					// Path, domain and secure were intentionally ignored by this legacy mock.
				}
				return cookieString
			},
			configurable: true,
		})
	} catch (error) {
		// Some WebViews expose a non-configurable native cookie property.
		console.warn("Cookie mock skipped:", error instanceof Error ? error.message : undefined)
	}
}
