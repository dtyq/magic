export type MicroAppInstallPromptEvent = Event & {
	prompt: () => Promise<void>
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type InstallPromptSignal = "available" | "installed"
type InstallPromptSubscriber = (signal: InstallPromptSignal, routeKey?: string) => void

interface MicroAppInstallPromptCaptureState {
	initialized: boolean
	prompt: MicroAppInstallPromptEvent | null
	routeKey: string | null
	abort?: AbortController
}

declare global {
	interface Window {
		__magicMicroAppInstallPromptCapture__?: MicroAppInstallPromptCaptureState
	}
}

const AVAILABLE_EVENT_NAME = "magic:micro-app-install-prompt-available"
const INSTALLED_EVENT_NAME = "magic:micro-app-installed"
const MICRO_APP_SHARE_ROUTE_RE = /^\/micro-app\/([^/]+)\/?$/

function getCaptureState() {
	if (typeof window === "undefined") return null
	window.__magicMicroAppInstallPromptCapture__ ??= {
		initialized: false,
		prompt: null,
		routeKey: null,
	}
	return window.__magicMicroAppInstallPromptCapture__
}

function getLocationPathname() {
	return typeof window === "undefined" ? "" : window.location.pathname
}

export function getMicroAppInstallRouteKey(pathname = getLocationPathname()) {
	const match = pathname.match(MICRO_APP_SHARE_ROUTE_RE)
	return match ? `/micro-app/${match[1]}` : pathname
}

function isMicroAppShareRoute(pathname = getLocationPathname()) {
	return MICRO_APP_SHARE_ROUTE_RE.test(pathname)
}

export function resetMicroAppInstallPromptCapture() {
	const state = getCaptureState()
	if (!state) return
	state.abort?.abort()
	state.initialized = false
	state.prompt = null
	state.routeKey = null
	state.abort = undefined
}

export function initializeMicroAppInstallPromptCapture() {
	const state = getCaptureState()
	if (!state || state.initialized) return

	state.initialized = true
	state.abort = new AbortController()
	const { signal } = state.abort

	window.addEventListener(
		"beforeinstallprompt",
		(event) => {
			if (!isMicroAppShareRoute()) return
			event.preventDefault()
			state.prompt = event as MicroAppInstallPromptEvent
			state.routeKey = getMicroAppInstallRouteKey()
			window.dispatchEvent(
				new CustomEvent(AVAILABLE_EVENT_NAME, { detail: { routeKey: state.routeKey } }),
			)
		},
		{ signal },
	)
	window.addEventListener(
		"appinstalled",
		() => {
			if (!isMicroAppShareRoute()) return
			state.prompt = null
			state.routeKey = null
			window.dispatchEvent(new Event(INSTALLED_EVENT_NAME))
		},
		{ signal },
	)
}

export function subscribeToMicroAppInstallPrompt(
	subscriber: InstallPromptSubscriber,
	routeKey = getMicroAppInstallRouteKey(),
) {
	initializeMicroAppInstallPromptCapture()
	if (typeof window === "undefined") return () => undefined

	const handleAvailable = (event: Event) => {
		const signalRouteKey = (event as CustomEvent<{ routeKey?: string }>).detail?.routeKey
		subscriber("available", signalRouteKey)
	}
	const handleInstalled = () => subscriber("installed")
	window.addEventListener(AVAILABLE_EVENT_NAME, handleAvailable)
	window.addEventListener(INSTALLED_EVENT_NAME, handleInstalled)

	const state = getCaptureState()
	if (state?.prompt && state.routeKey === routeKey) subscriber("available", routeKey)
	return () => {
		window.removeEventListener(AVAILABLE_EVENT_NAME, handleAvailable)
		window.removeEventListener(INSTALLED_EVENT_NAME, handleInstalled)
	}
}

export function takeMicroAppInstallPrompt(routeKey = getMicroAppInstallRouteKey()) {
	const state = getCaptureState()
	if (!state?.prompt || state.routeKey !== routeKey) return null
	const prompt = state.prompt
	state.prompt = null
	state.routeKey = null
	return prompt
}
