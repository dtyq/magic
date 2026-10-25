import { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { usePreviewDocumentRevision } from "../../src/pages/superMagic/components/Detail/contents/HTML/hooks/usePreviewDocumentRevision"
import { getFullContent } from "../../src/pages/superMagic/components/Detail/contents/HTML/utils/full-content"
import {
	createVirtualStorageContext,
	createVirtualStorageMessageHandler,
	loadVirtualStorageSnapshot,
	virtualStorageRegistry,
} from "../../src/pages/superMagic/components/Detail/contents/HTML/utils/virtual-storage"

type Result = { name: string; passed: boolean; error?: string }
type Boot = { bootId: string; bootCount: number; visits: number; version: string }

async function until(predicate: () => boolean | Promise<boolean>) {
	const deadline = Date.now() + 8000
	while (!(await predicate())) {
		if (Date.now() > deadline) throw Error("Refresh condition timed out")
		await new Promise((resolve) => setTimeout(resolve, 20))
	}
}

/** Native browser proof for the same revision hook used by the full Renderer.
 * The small host keeps provider/UI integration in component tests while exercising
 * actual shell injection, new Window lifetimes and persistent virtual storage here.
 */
export async function runRefreshExample(
	container: Element,
	crossOrigin: boolean,
	report: (result: Result) => void,
) {
	const target = new URL(location.origin)
	if (crossOrigin) target.hostname = "localhost"
	const targetOrigin = target.origin
	const label = `refresh / ${crossOrigin ? "cross-origin" : "same-origin"}`
	const response = await fetch("/fixtures/refresh.html", { signal: AbortSignal.timeout(8000) })
	if (!response.ok) throw Error("Refresh fixture missing")
	const raw = await response.text()
	const mount = document.createElement("div")
	container.append(mount)
	const root = createRoot(mount)
	const namespace = "refresh-" + crypto.randomUUID()
	const boots: Boot[] = []
	const ticks = new Map<string, number>()
	const errors: string[] = []
	const messages: string[] = []
	let restart: (() => void) | undefined
	let frame: HTMLIFrameElement | null = null
	const knownWindows = new Set<MessageEventSource>()
	// Observe retired windows too: merely filtering their events would hide timer leaks.
	const observeTicks = (event: MessageEvent) => {
		if (event.origin !== targetOrigin || !event.source || !knownWindows.has(event.source))
			return
		if (event.data?.type === "REFRESH_TICK")
			ticks.set(event.data.bootId, (ticks.get(event.data.bootId) || 0) + 1)
	}
	window.addEventListener("message", observeTicks)
	function Preview({ content, editing = false }: { content: string; editing?: boolean }) {
		const document = usePreviewDocumentRevision(content, editing)
		const iframeRef = useRef<HTMLIFrameElement>(null)
		useEffect(() => {
			restart = document.restart
		}, [document.restart])
		useEffect(() => {
			const iframe = iframeRef.current
			if (!iframe?.contentWindow) return
			frame = iframe
			const source = iframe.contentWindow
			knownWindows.add(source)
			let cancelled = false
			let injected = false
			let context: Awaited<ReturnType<typeof createVirtualStorageContext>> | undefined
			const storageHandler = createVirtualStorageMessageHandler()
			const handler = (event: MessageEvent) => {
				if (event.source !== source || event.origin !== targetOrigin || cancelled) return
				if (event.data?.type !== "REFRESH_TICK") messages.push(String(event.data?.type))
				if (event.data?.type === "iframeReady" && context && !injected) {
					injected = true
					source.postMessage(
						{
							type: "setContent",
							runtimeUrl: window.location.origin + "/husky-runtime.js",
							content: getFullContent(content, "refresh", {
								virtualStorage: context,
								postMessageTargetStrategy: "cross-origin-parent",
							}),
						},
						targetOrigin,
					)
				}
				if (event.data?.type === "REFRESH_READY") boots.push(event.data)
				if (event.data?.type === "contentLoadError") errors.push(String(event.data.error))
				void storageHandler(event).catch((error) => errors.push(String(error)))
			}
			window.addEventListener("message", handler)
			void createVirtualStorageContext({
				namespace,
				source,
				origin: targetOrigin,
				targetOrigin: location.origin,
			})
				.then((next) => {
					if (cancelled) return
					context = next
					virtualStorageRegistry.register(next)
					iframe.src = targetOrigin + "/shell.html"
				})
				.catch((error) => errors.push(String(error)))
			return () => {
				cancelled = true
				window.removeEventListener("message", handler)
				if (context) virtualStorageRegistry.unregister(context)
			}
			// Same-content rerenders and editor drafts must not reinject this document.
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [document.revision])
		return (
			<iframe
				key={document.revision}
				ref={iframeRef}
				title={label}
				sandbox="allow-scripts allow-same-origin"
			/>
		)
	}
	const render = (version: string, editing = false) =>
		root.render(
			<Preview content={raw.replaceAll("__FIXTURE_VERSION__", version)} editing={editing} />,
		)
	const assert = (name: string, passed: boolean) => report({ name: label + " · " + name, passed })
	const awaitBoot = async (count: number) => {
		await until(() => boots.length >= count || errors.length > 0)
		if (errors.length) throw Error(errors.join("; "))
		await until(
			async () =>
				(await loadVirtualStorageSnapshot(namespace)).localStorage["refresh-visits"] ===
				String(count),
		)
		return boots[count - 1]
	}
	try {
		render("v1")
		const first = await awaitBoot(1)
		await until(() => (ticks.get(first.bootId) || 0) >= 2)
		const firstFrame = frame
		render("v1")
		const beforeRerenderTicks = ticks.get(first.bootId) || 0
		await until(() => (ticks.get(first.bootId) || 0) >= beforeRerenderTicks + 2)
		assert(
			"same-content rerender preserves the running document",
			frame === firstFrame && boots.length === 1,
		)
		render("v2")
		const second = await awaitBoot(2)
		assert(
			"new content creates a fresh Window and reruns scripts",
			frame !== firstFrame &&
				second.version === "v2" &&
				second.bootCount === 1 &&
				first.bootId !== second.bootId,
		)
		const oldTicks = ticks.get(first.bootId) || 0
		const freshTicks = ticks.get(second.bootId) || 0
		await until(() => (ticks.get(second.bootId) || 0) >= freshTicks + 3)
		assert("retired document timers stop", (ticks.get(first.bootId) || 0) === oldTicks)
		assert("new document reloads persisted storage", first.visits === 1 && second.visits === 2)
		if (!restart) throw Error("Missing refresh control")
		restart()
		const third = await awaitBoot(3)
		assert(
			"explicit refresh reruns unchanged HTML with clean globals",
			third.version === "v2" &&
				third.bootCount === 1 &&
				third.bootId !== second.bootId &&
				third.visits === 3,
		)
		const editingFrame = frame
		render("draft", true)
		const previousTicks = ticks.get(third.bootId) || 0
		await until(() => (ticks.get(third.bootId) || 0) >= previousTicks + 3)
		assert(
			"editing preserves the running document",
			frame === editingFrame && boots.length === 3,
		)
		render("draft")
		const fourth = await awaitBoot(4)
		assert(
			"accepted editing content starts a new document",
			fourth.version === "draft" && fourth.bootCount === 1 && fourth.visits === 4,
		)
	} catch (error) {
		throw new Error(
			`${String(error)}; ${JSON.stringify({ boots, errors, messages, ticks: [...ticks] })}`,
		)
	} finally {
		root.unmount()
		window.removeEventListener("message", observeTicks)
		mount.remove()
	}
}
