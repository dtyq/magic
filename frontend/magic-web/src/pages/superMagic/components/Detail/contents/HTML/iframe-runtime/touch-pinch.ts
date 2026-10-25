import { bindTouchPinch } from "../utils/touch-pinch"

type PinchWindow = Window & { __MAGIC_PREVIEW_PINCH_CLEANUP__?: () => void }

/** Cross-origin touch events cannot bubble to the preview that owns the zoom state. */
export default function install({ parentOrigin }: { parentOrigin: string }): void {
	const sandbox = window as PinchWindow
	sandbox.__MAGIC_PREVIEW_PINCH_CLEANUP__?.()
	try {
		if (window.parent.document) return // Same-origin frames use the host's direct listener.
	} catch {
		// The parent is expected to be inaccessible in an isolated sandbox.
	}
	let unbind: (() => void) | undefined
	const handleState = (event: MessageEvent) => {
		if (
			event.source !== window.parent ||
			event.origin !== parentOrigin ||
			event.data?.type !== "magic-preview-pinch-state"
		)
			return
		if (event.data.enabled === true && !unbind) {
			unbind = bindTouchPinch(document, (phase, points) => {
				window.parent.postMessage(
					{ type: "magic-preview-pinch", phase, points },
					parentOrigin,
				)
			})
		} else if (event.data.enabled !== true) {
			unbind?.()
			unbind = undefined
		}
	}
	window.addEventListener("message", handleState)
	sandbox.__MAGIC_PREVIEW_PINCH_CLEANUP__ = () => {
		window.removeEventListener("message", handleState)
		unbind?.()
		delete sandbox.__MAGIC_PREVIEW_PINCH_CLEANUP__
	}
	// A handshake covers both script-before-hook and hook-before-script installation.
	window.parent.postMessage({ type: "magic-preview-pinch-ready" }, parentOrigin)
}
