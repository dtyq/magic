export type ResourceKind = "script" | "stylesheet"
export type ResourceStatus = "pending" | "loaded" | "errored"

export interface ResourceRecord {
	element: Element
	kind: ResourceKind
	url: string
	label: string
	status: ResourceStatus
	error?: string
	cleanup?: () => void
}

interface TrackableResourceDescriptor {
	kind: ResourceKind
	url: string
	label: string
	initialStatus: ResourceStatus
}

export function getTrackableResource(
	element: Element,
	options?: { assumeLoadedWhenDocumentComplete?: boolean },
): TrackableResourceDescriptor | null {
	const tag = element.tagName.toUpperCase()
	if (tag === "SCRIPT") {
		const script = element as HTMLScriptElement
		if (!script.src) return null
		return {
			kind: "script",
			url: script.src,
			label: buildResourceLabel("script", script.src, element),
			initialStatus: isScriptLoaded(script, options) ? "loaded" : "pending",
		}
	}

	if (tag === "LINK") {
		const link = element as HTMLLinkElement
		if (!link.href || link.disabled) return null
		const relTokens = (link.getAttribute("rel") || "")
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean)
		if (!relTokens.includes("stylesheet")) return null
		return {
			kind: "stylesheet",
			url: link.href,
			label: buildResourceLabel("stylesheet", link.href, element),
			initialStatus: link.sheet ? "loaded" : "pending",
		}
	}

	return null
}

export function createResourceError(
	message: string,
	records: ResourceRecord[],
): Error {
	const details = records
		.slice(0, 10)
		.map((record) => {
			const suffix = record.error ? ` (${record.error})` : ""
			return `${record.label} ${record.status}${suffix}`
		})
		.join("; ")
	const extraCount = records.length > 10 ? `; ...and ${records.length - 10} more` : ""
	return new Error(`[Sandbox] ${message}: ${details}${extraCount}`)
}

export function createWindowEvent(iframeWindow: Window, type: string): Event {
	const EventCtor =
		(iframeWindow as Window & { Event?: typeof Event }).Event ?? Event
	return new EventCtor(type)
}

export function asElement(target: EventTarget | Node | null): Element | null {
	if (!target) return null
	const node = target as Node
	return node.nodeType === 1 ? (node as Element) : null
}

function isScriptLoaded(
	script: HTMLScriptElement,
	options?: { assumeLoadedWhenDocumentComplete?: boolean },
): boolean {
	const readyState = (script as HTMLScriptElement & { readyState?: string }).readyState
	if (readyState === "loaded" || readyState === "complete") return true
	if (!options?.assumeLoadedWhenDocumentComplete) return false
	return script.ownerDocument?.readyState === "complete"
}

function buildResourceLabel(
	kind: ResourceKind,
	url: string,
	element: Element,
): string {
	const originalPath = element.getAttribute("data-original-path")
	if (originalPath) return `${kind}:${originalPath}`
	return `${kind}:${url}`
}
