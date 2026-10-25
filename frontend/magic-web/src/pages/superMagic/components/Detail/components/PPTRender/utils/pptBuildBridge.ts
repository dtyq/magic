import {
	PPT_BUILD_ATTRIBUTE,
	readPPTBuild,
	isPPTBuildElement,
	collectPPTBuilds,
} from "@dtyq/html-sandbox/utils/pptBuild"
import { pptBuildRuntime } from "@dtyq/html-sandbox/utils/pptBuildRuntime"
import { appendBodyScript } from "./appendBodyScript"

/** Serialize only our own runtime; authored HTML is never interpolated into script. */
export function injectPPTBuildBridge(
	html: string,
	origin: string,
	documentKey: string,
	enabled: boolean,
): string {
	if (!html.includes(PPT_BUILD_ATTRIBUTE)) return html
	const encode = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c")
	return appendBodyScript(
		html,
		`<script data-injected="true">(function(){
const PPT_BUILD_ATTRIBUTE=${encode(PPT_BUILD_ATTRIBUTE)};
const readPPTBuild=${readPPTBuild.toString()};
const isPPTBuildElement=${isPPTBuildElement.toString()};
const collectPPTBuilds=${collectPPTBuilds.toString()};
(${pptBuildRuntime.toString()})(${encode(origin)},${encode(documentKey)},${encode(enabled)}, collectPPTBuilds, readPPTBuild, isPPTBuildElement, PPT_BUILD_ATTRIBUTE);
})();</script>`,
	)
}

export interface PPTBuildFrameState {
	step: number
	total: number
	ignored?: number
	/** Per step: ms after the previous step it plays by itself, or null when it waits for a click. */
	delays?: Array<number | null>
}
let requestSequence = 0

/** Absolute setters make duplicate messages idempotent. Source, origin and document must match. */
export function setPPTBuildFrame(
	iframe: HTMLIFrameElement,
	documentKey: string,
	enabled: boolean,
	step: number,
	animate = false,
	signal?: AbortSignal,
): Promise<PPTBuildFrameState | null> {
	const target = iframe.contentWindow
	if (!target || signal?.aborted) return Promise.resolve(null)
	const origin = new URL(iframe.src || window.location.href, window.location.href).origin
	const requestId = `ppt-build-${++requestSequence}`
	return new Promise((resolve) => {
		const finish = (result: PPTBuildFrameState | null) => {
			window.clearTimeout(timer)
			window.removeEventListener("message", onMessage)
			signal?.removeEventListener("abort", onAbort)
			resolve(result)
		}
		const onMessage = (event: MessageEvent) => {
			const data = event.data
			if (
				event.source !== target ||
				event.origin !== origin ||
				data?.documentKey !== documentKey ||
				data.type !== "ppt-build:applied" ||
				data.requestId !== requestId ||
				!Number.isInteger(data.step) ||
				!Number.isInteger(data.total) ||
				data.step < 0 ||
				data.total < data.step
			)
				return
			finish({
				step: data.step,
				total: data.total,
				...(Number.isInteger(data.ignored) && data.ignored > 0
					? { ignored: data.ignored }
					: {}),
				...(isDelayList(data.delays, data.total) ? { delays: data.delays } : {}),
			})
		}
		const onAbort = () => finish(null)
		const timer = window.setTimeout(() => finish(null), 1000)
		window.addEventListener("message", onMessage)
		signal?.addEventListener("abort", onAbort, { once: true })
		try {
			target.postMessage(
				{ type: "ppt-build:set", requestId, documentKey, enabled, step, animate },
				origin,
			)
		} catch {
			finish(null)
		}
	})
}

function isDelayList(value: unknown, total: number): value is Array<number | null> {
	return (
		Array.isArray(value) &&
		value.length === total &&
		value.every(
			(item) => item === null || (Number.isInteger(item) && item >= 0 && item <= 60000),
		)
	)
}
