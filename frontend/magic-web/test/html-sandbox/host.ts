import { getFullContent } from "../../src/pages/superMagic/components/Detail/contents/HTML/utils/full-content"
import {
	createParentMessageHandler,
	injectFetchInterceptorScript,
} from "../../src/pages/superMagic/components/Detail/contents/HTML/utils/fetchInterceptor"
import { createNestedIframeContentHandler } from "../../src/pages/superMagic/components/Detail/contents/HTML/utils/nested-iframe-content"
import {
	createVirtualStorageContext,
	createVirtualStorageMessageHandler,
	loadVirtualStorageSnapshot,
	virtualStorageRegistry,
} from "../../src/pages/superMagic/components/Detail/contents/HTML/utils/virtual-storage"
import type { FileApi } from "../../src/pages/superMagic/fileAccess/fileApi"
import { mountHookHost } from "./hook-host"
import { assertHookDependencies } from "./assert-dependencies"
import { runRefreshExample } from "./refresh-host"
import type { ConsoleEntry } from "../../packages/html-sandbox/src/features/ConsoleProxy"
import type { NetworkEntry } from "../../packages/html-sandbox/src/features/NetworkInterceptor"
import type { ApiCallEntry } from "../../packages/html-sandbox/src/features/ApiCallProxy"

type Result = { name: string; passed: boolean; error?: string }
declare global {
	interface Window {
		fixtureResults?: Result[]
		fixtureDone?: boolean
		runFixtures: () => Promise<Result[]>
	}
}

const results: Result[] = []
const trace: Array<{ scenario: string; type: string; path?: string }> = []
function requiredElement<T extends Element = Element>(selector: string): T {
	const element = document.querySelector<T>(selector)
	if (!element) throw Error("Missing fixture element: " + selector)
	return element
}
const frames = requiredElement("#frames")
const status = requiredElement("#status")
const list = requiredElement("#results")
const button = requiredElement<HTMLButtonElement>("#run")
const scenarioSelect = requiredElement<HTMLSelectElement>("#scenario")
const resourceNames = [
	"resource.json",
	"resource.js",
	"resource.css",
	"resource.svg",
	"resource-xhr.json",
	"resource-abort.json",
]

function report(result: Result) {
	results.push(result)
	const item = document.createElement("li")
	item.className = result.passed ? "pass" : "fail"
	item.textContent = `${result.passed ? "PASS" : "FAIL"} · ${result.name}${result.error ? ": " + result.error : ""}`
	list.appendChild(item)
}

async function runExample(name: string, crossOrigin: boolean) {
	const label = `${name} / ${crossOrigin ? "cross-origin" : "same-origin"}`
	const target = new URL(location.origin)
	if (crossOrigin) target.hostname = "localhost"
	const targetOrigin = target.origin
	const iframe = document.createElement("iframe")
	iframe.title = label
	iframe.setAttribute(
		"sandbox",
		"allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups",
	)
	frames.appendChild(iframe)
	const frameWindow = iframe.contentWindow
	if (!frameWindow) {
		iframe.remove()
		throw Error("Missing iframe window")
	}
	let host: Awaited<ReturnType<typeof mountHookHost>> | undefined
	let context: Awaited<ReturnType<typeof createVirtualStorageContext>> | undefined
	let timeout: ReturnType<typeof setTimeout> | undefined
	let handler: ((event: MessageEvent) => void) | undefined
	try {
		host = await mountHookHost(iframe, { targetOrigin, baseUrl: location.origin })
		context = await createVirtualStorageContext({
			namespace: "fixture-" + crypto.randomUUID(),
			source: iframe.contentWindow,
			origin: targetOrigin,
			targetOrigin: location.origin,
			snapshot: { localStorage: {}, sessionStorage: {}, cookies: {}, indexedDB: {} },
		})
		virtualStorageRegistry.register(context)
		const fileId = name + "-file"
		const allFiles = [
			{ file_id: fileId, relative_file_path: `app/${name}.html`, file_name: name + ".html" },
			{
				file_id: "nested-file",
				relative_file_path: "app/nested.html",
				file_name: "nested.html",
			},
			...resourceNames.map((file) => ({
				file_id: file,
				relative_file_path: "app/" + file,
				file_name: file,
			})),
		]
		// This adapter replaces only remote file transport. The production path
		// resolver, response handler, nested processor and storage handler run intact.
		const fileApi = {
			getTemporaryDownloadUrl: async ({ file_ids }: { file_ids: string[] }) =>
				file_ids.map((id) => ({
					file_id: id,
					url: location.origin + "/resolved-assets/" + id,
					expires_at: "2099-01-01 00:00:00",
				})),
			getFileContentById: async () => (await fetch("/fixtures/nested.html")).text(),
		} as FileApi
		const fetchHandler = createParentMessageHandler(
			allFiles,
			"app/",
			fileId,
			undefined,
			undefined,
			fileApi,
		)
		const nestedHandler = createNestedIframeContentHandler(allFiles, "app/", fileId, allFiles, {
			fileApi,
			projectId: "fixture-project",
			parentTargetOrigin: location.origin,
			postMessageTargetStrategy: "cross-origin-parent",
		})
		const storageHandler = createVirtualStorageMessageHandler()
		const [raw, helper] = await Promise.all([
			fetch(`/fixtures/${name}.html`, { signal: AbortSignal.timeout(8000) }).then((r) => {
				if (!r.ok) throw Error("Missing fixture: " + name)
				return r.text()
			}),
			fetch("/fixtures/assertions.js", { signal: AbortSignal.timeout(8000) }).then((r) => {
				if (!r.ok) throw Error("Missing assertions helper")
				return r.text()
			}),
		])
		const prepared = raw.replace(
			"<script data-fixture-helper></script>",
			() => `<script>${helper}</script>`,
		)
		const content = getFullContent(
			injectFetchInterceptorScript(prepared, {
				enableRelativePathInterception: true,
				fileId,
				postMessageTargetStrategy: "cross-origin-parent",
			}),
			fileId,
			{
				virtualStorage: context,
				locationSearch: "?fixture=" + name,
				postMessageTargetStrategy: "cross-origin-parent",
				dynamicInterception: { fileId, postMessageTargetStrategy: "cross-origin-parent" },
				navigationBasePath: `app/${name}.html`,
			},
		)
		let injected = false
		let completed = false
		const navigation: string[] = []
		const outgoing: string[] = []
		const transferred: number[][] = []
		let devToolsPhase = "before"
		const consoleEntries: Array<{ phase: string; entry: ConsoleEntry }> = []
		const networkEntries: Array<{ phase: string; entry: NetworkEntry }> = []
		const apiEntries: Array<{ phase: string; entry: ApiCallEntry }> = []
		await new Promise<void>((resolve, reject) => {
			timeout = setTimeout(() => reject(Error("Example timed out (45s)")), 45000)
			handler = (event) => {
				if (event.source !== iframe.contentWindow || event.origin !== targetOrigin) return
				const message = event.data
				if (!message || typeof message.type !== "string") return
				trace.push({ scenario: label, type: message.type, path: message.relativePath })
				outgoing.push(message.type)
				if (message.type === "iframeReady" && !injected) {
					injected = true
					frameWindow.postMessage(
						{
							type: "setContent",
							content,
							locationSearch: "?fixture=" + name,
							runtimeUrl: window.location.origin + "/husky-runtime.js",
						},
						targetOrigin,
					)
				}
				if (message.type === "contentLoadError") reject(Error(message.error))
				if (message.type === "FIXTURE_RESULT")
					report({
						name: label + " · " + message.name,
						passed: message.passed,
						error: message.error,
					})
				if (message.type === "FIXTURE_DONE" && !completed) {
					completed = true
					resolve()
				}
				if (message.type === "linkClicked") navigation.push(message.href)
				if (message.type === "FIXTURE_DEVTOOLS") {
					// Stage changes arrive before the toggle ACK and subsequent entries from
					// this frame, so first-enable traffic cannot satisfy re-enable checks.
					if (["first", "disabled", "second"].includes(message.phase))
						devToolsPhase = message.phase
					frameWindow.postMessage(
						{ type: "MAGIC_DEVTOOLS_TOGGLE", enabled: message.enabled },
						targetOrigin,
					)
					frameWindow.postMessage({ type: "FIXTURE_DEVTOOLS_ACK" }, targetOrigin)
				}
				if (message.type === "FIXTURE_TRANSFER")
					transferred.push(Array.from(new Uint8Array(message.bytes)))
				if (message.type === "MAGIC_DEVTOOLS_CONSOLE_ENTRY")
					consoleEntries.push({ phase: devToolsPhase, entry: message.payload })
				if (message.type === "MAGIC_DEVTOOLS_NETWORK_ENTRY")
					networkEntries.push({ phase: devToolsPhase, entry: message.payload })
				if (message.type === "MAGIC_DEVTOOLS_API_CALL_ENTRY")
					apiEntries.push({ phase: devToolsPhase, entry: message.payload })
				void fetchHandler(event).catch(reject)
				void nestedHandler(event).catch(reject)
				void storageHandler(event).catch(reject)
			}
			window.addEventListener("message", handler)
			iframe.src = targetOrigin + "/shell.html"
		})
		report({
			name: label + " · real shell handshake and completion",
			passed: injected && completed && outgoing.includes("contentLoaded"),
		})
		if (name === "resources") {
			for (const via of ["anchor", "open", "location"])
				report({
					name: label + " · host receives " + via + " navigation",
					passed: navigation.some((href) => href.includes("via=" + via)),
				})
			report({
				name: label + " · relative URLs reached parent resolver",
				passed: outgoing.includes("MAGIC_FETCH_URL_REQUEST"),
			})
			report({
				name: label + " · nested HTML reached parent processor",
				passed: outgoing.includes("MAGIC_IFRAME_CONTENT_REQUEST"),
			})
		}
		if (name === "storage") {
			const snapshot = await loadVirtualStorageSnapshot(context.namespace)
			report({
				name: label + " · host persisted local, session and cookie state",
				passed:
					snapshot.localStorage["fixture-value"] === "persisted" &&
					snapshot.sessionStorage["fixture-value"] === "session" &&
					snapshot.cookies.fixtureCookie === "hello",
			})
			report({
				name: label + " · host snapshot excludes expired cookies and aborted writes",
				passed:
					snapshot.cookies.shortLived === undefined &&
					!JSON.stringify(snapshot.indexedDB).includes('"discard"'),
			})
			report({
				name: label + " · storage operations reached real host handler",
				passed:
					outgoing.includes("HTML_SANDBOX_STORAGE_OP") &&
					outgoing.includes("HTML_SANDBOX_STORAGE_IDB_REQUEST"),
			})
			report({
				name: label + " · iframe localStorage did not overwrite host storage",
				passed: localStorage.getItem("fixture-value") === null,
			})
		}
		if (name === "api") {
			for (const result of assertHookDependencies(host.dependencyCalls))
				report({ ...result, name: label + " · " + result.name })
			report({
				name: label + " · input message reached the host",
				passed: outgoing.includes("MAGIC_SET_INPUT_MESSAGE"),
			})
		}
		if (name === "devtools") {
			for (const type of [
				"CONSOLE_ENTRY",
				"NETWORK_ENTRY",
				"API_CALL_ENTRY",
				"MESSAGE_ENTRY",
			])
				report({
					name: label + " · parent received " + type,
					passed: outgoing.includes("MAGIC_DEVTOOLS_" + type),
				})
			report({
				name: label + " · transferred buffer arrived intact",
				passed: JSON.stringify(transferred) === "[[10,20]]",
			})
			for (const phase of ["first", "disabled", "second"]) {
				const expectedCount = phase === "disabled" ? 0 : 1
				const consoleMatches = consoleEntries.filter(({ entry }) =>
					entry.args.includes(`fixture ${phase} console entry`),
				)
				const networkMatches = networkEntries.filter(
					(item) => item.phase === phase && item.entry.url.includes("resource.json"),
				)
				const apiMatches = apiEntries.filter((item) => item.phase === phase)
				const expectedApiType =
					phase === "second" ? "MAGIC_GET_AGENTS_REQUEST" : "MAGIC_FS_READ_REQUEST"
				// getAgents emits its own operation log before the correlated request;
				// require that log too instead of confusing it with a duplicate lifecycle.
				const expectedApiEvents =
					phase === "disabled"
						? []
						: phase === "second"
							? ["getAgents:start", "request:start", "request:success"]
							: ["request:start", "request:success"]
				const requestEntries = apiMatches.filter(
					({ entry }) => entry.details?.type === expectedApiType,
				)
				const apiPassed =
					JSON.stringify(apiMatches.map(({ entry }) => entry.event)) ===
						JSON.stringify(expectedApiEvents) &&
					(expectedCount === 0
						? apiMatches.length === 0
						: requestEntries.length === 2 &&
							requestEntries[0].entry.status === "pending" &&
							requestEntries[1].entry.status === "success" &&
							requestEntries[0].entry.id === requestEntries[1].entry.id)
				report({
					name: label + ` · ${phase} console capture count`,
					passed:
						consoleMatches.length === expectedCount &&
						consoleMatches.every((item) => item.phase === phase),
				})
				report({
					name: label + ` · ${phase} network capture count and response`,
					passed:
						networkMatches.length === expectedCount &&
						networkMatches.every(
							({ entry }) =>
								entry.status === 200 &&
								entry.responseBody === JSON.stringify({ message: "real resource" }),
						),
				})
				report({
					name: label + ` · ${phase} API lifecycle capture`,
					passed: apiPassed,
					error: apiPassed
						? undefined
						: JSON.stringify({
								expectedApiEvents,
								expectedApiType,
								entries: apiMatches,
							}),
				})
			}
			report({
				name: label + " · proxy messages stay bounded",
				passed: outgoing.length < 200,
			})
		}
	} finally {
		clearTimeout(timeout)
		if (handler) window.removeEventListener("message", handler)
		if (context) virtualStorageRegistry.unregister(context)
		host?.dispose()
		iframe.remove()
		requiredElement("#trace").textContent = JSON.stringify(trace, null, 2)
	}
}

window.runFixtures = async () => {
	button.disabled = true
	scenarioSelect.disabled = true
	window.fixtureDone = false
	results.length = 0
	trace.length = 0
	list.replaceChildren()
	try {
		const names =
			scenarioSelect.value === "all"
				? ["api", "resources", "storage", "devtools", "refresh"]
				: [scenarioSelect.value]
		for (const name of names) {
			for (const crossOrigin of [false, true]) {
				status.textContent = `Running ${name} · ${crossOrigin ? "cross-origin" : "same-origin"}`
				try {
					if (name === "refresh") await runRefreshExample(frames, crossOrigin, report)
					else await runExample(name, crossOrigin)
				} catch (error) {
					report({ name: status.textContent, passed: false, error: String(error) })
				}
			}
		}
	} finally {
		const failures = results.filter((result) => !result.passed)
		status.textContent = `${results.length - failures.length} passed / ${failures.length} failed`
		window.fixtureResults = [...results]
		window.fixtureDone = true
		button.disabled = false
		scenarioSelect.disabled = false
	}
	return results
}
button.addEventListener("click", () => {
	void window.runFixtures()
})
if (new URLSearchParams(location.search).has("autorun")) void window.runFixtures()
