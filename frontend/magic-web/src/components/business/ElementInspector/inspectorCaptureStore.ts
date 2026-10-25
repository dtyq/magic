import {
	createCurrentTabCaptureSession,
	type CurrentTabCaptureAuthorizationContext,
	type CurrentTabCaptureSession,
} from "./screenshot"

export interface InspectorCaptureSnapshot {
	authorization: CurrentTabCaptureAuthorizationContext | null
	isBusy: boolean
}

type AuthorizationResolver = {
	startCapture: () => Promise<string>
	resolve: (dataUrl: string | null) => void
	reject: (error: unknown) => void
}

export interface InspectorCaptureStore {
	session: CurrentTabCaptureSession
	subscribe: (listener: () => void) => () => void
	getSnapshot: () => InspectorCaptureSnapshot
	requestAuthorization: (
		context: CurrentTabCaptureAuthorizationContext,
		startCapture: () => Promise<string>,
	) => Promise<string | null>
	resolveAuthorization: (authorized: boolean) => void
	prepare: (iframe: HTMLIFrameElement | null, iframeTargetOrigin?: string) => Promise<boolean>
	releaseIfIdle: (isInspecting: boolean) => void
	dispose: () => void
}

const IDLE_SNAPSHOT: InspectorCaptureSnapshot = {
	authorization: null,
	isBusy: false,
}

/**
 * Per-preview capture UI + session. Not a global store: each HTML iframe
 * owns its own grant and authorization dialog.
 */
export function createInspectorCaptureStore(
	session: CurrentTabCaptureSession = createCurrentTabCaptureSession(),
): InspectorCaptureStore {
	const listeners = new Set<() => void>()
	let authorization: CurrentTabCaptureAuthorizationContext | null = null
	let snapshot: InspectorCaptureSnapshot = IDLE_SNAPSHOT
	let resolver: AuthorizationResolver | null = null
	let preparePromise: Promise<boolean> | null = null

	const emit = () => {
		snapshot = authorization !== null ? { authorization, isBusy: true } : IDLE_SNAPSHOT
		listeners.forEach((listener) => listener())
	}

	const subscribe = (listener: () => void) => {
		listeners.add(listener)
		return () => {
			listeners.delete(listener)
		}
	}

	const getSnapshot = () => snapshot

	const requestAuthorization = (
		context: CurrentTabCaptureAuthorizationContext,
		startCapture: () => Promise<string>,
	) =>
		new Promise<string | null>((resolve, reject) => {
			resolver?.resolve(null)
			resolver = { startCapture, resolve, reject }
			authorization = context
			emit()
		})

	const resolveAuthorization = (authorized: boolean) => {
		const pendingResolver = resolver
		resolver = null
		authorization = null
		emit()
		if (!pendingResolver) return
		if (!authorized) {
			pendingResolver.resolve(null)
			return
		}
		void pendingResolver.startCapture().then(pendingResolver.resolve, pendingResolver.reject)
	}

	const prepare = async (iframe: HTMLIFrameElement | null): Promise<boolean> => {
		if (preparePromise) return preparePromise
		const run = async () => {
			if (!iframe || session.hasLiveStream()) return true
			// Cross-origin capture tries iframe runtime first. Do not force
			// getDisplayMedia here; fallback authorization happens on capture.
			return true
		}
		preparePromise = run().finally(() => {
			preparePromise = null
		})
		return preparePromise
	}

	const releaseIfIdle = (isInspecting: boolean) => {
		if (isInspecting || authorization !== null) return
		session.release()
	}

	const dispose = () => {
		resolver?.resolve(null)
		resolver = null
		authorization = null
		emit()
		session.release()
	}

	return {
		session,
		subscribe,
		getSnapshot,
		requestAuthorization,
		resolveAuthorization,
		prepare,
		releaseIfIdle,
		dispose,
	}
}
