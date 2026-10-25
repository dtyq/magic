type ServiceWorkerMockMode = "off" | "auto" | "on"

function isTargetWebView(): boolean {
	const ua = (navigator.userAgent || "").toLowerCase()
	return ["dingtalk", "aliapp(dingtalk", "wxwork", "wecom", "feishu", "lark"].some((name) =>
		ua.includes(name),
	)
}

/** Keep the compatibility surface without claiming that an unexecuted worker is active. */
export default function install({ mode }: { mode: ServiceWorkerMockMode }): void {
	if (mode === "off") return
	try {
		if (mode !== "on" && !isTargetWebView()) return
		if ("serviceWorker" in navigator && navigator.serviceWorker) return
		const container = Object.assign(new EventTarget(), {
			register: (_scriptURL: string | URL, _options?: RegistrationOptions) =>
				Promise.reject(
					new DOMException(
						"Service workers are unavailable in this preview",
						"NotSupportedError",
					),
				),
			getRegistration: () => Promise.resolve(undefined),
			getRegistrations: () => Promise.resolve([]),
			controller: null,
			// Native ready never rejects and only resolves after a real worker activates.
			ready: new Promise<ServiceWorkerRegistration>(() => undefined),
			startMessages: () => undefined,
		})
		Object.defineProperty(navigator, "serviceWorker", {
			value: container,
			writable: false,
			configurable: true,
		})
	} catch (error) {
		// Some embedded browsers expose a non-configurable or throwing native property.
		const message =
			error && typeof error === "object" && "message" in error ? error.message : undefined
		console.warn("ServiceWorker mock skipped:", message)
	}
}
