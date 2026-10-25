import type { CanvasAccessContext, CanvasAccessMode, CanvasCapability } from "../../public/props"
import type { ElementToolEffect } from "../element-tools/model/ElementToolTypes"

const EDIT_CAPABILITIES: readonly CanvasCapability[] = [
	"document.read",
	"document.write",
	"document.delete",
	"interaction.select",
	"interaction.preview",
	"interaction.switchContent",
	"interaction.playback",
	"sideEffect.download",
	"sideEffect.copy",
	"sideEffect.generate",
]

const READONLY_CAPABILITIES: readonly CanvasCapability[] = [
	"document.read",
	"interaction.select",
	"interaction.preview",
	"interaction.switchContent",
	"interaction.playback",
]

const SHARE_CAPABILITIES: readonly CanvasCapability[] = [
	"document.read",
	"interaction.select",
	"interaction.preview",
	"interaction.switchContent",
	"interaction.playback",
]

const HISTORY_CAPABILITIES: readonly CanvasCapability[] = ["document.read", "interaction.preview"]

/**
 * A non-edit access mode is a hard document boundary. Host integrations may
 * opt into external effects such as download/copy, but they cannot turn a
 * readonly/share/history canvas back into a document-mutating canvas by
 * passing capability overrides.
 */
const NON_EDIT_HARD_DENIED_CAPABILITIES: ReadonlySet<CanvasCapability> = new Set([
	"document.write",
	"document.delete",
	"sideEffect.generate",
])

export interface CanvasAccessPolicyOptions {
	mode?: CanvasAccessMode
	capabilities?: Partial<Record<CanvasCapability, boolean>>
}

export interface CanvasAuthorizationResult {
	allowed: boolean
	reason?: "CAPABILITY_REQUIRED"
	requiredCapability?: CanvasCapability
}

export interface CanvasToolAuthorizationDefinition {
	effect: ElementToolEffect
	requiredCapability: CanvasCapability
}

export interface CanvasAccessUpdate {
	mode?: CanvasAccessMode
	capabilities?: Partial<Record<CanvasCapability, boolean>>
}

function areAccessContextsEqual(left: CanvasAccessContext, right: CanvasAccessContext): boolean {
	if (left.mode !== right.mode || left.capabilities.size !== right.capabilities.size) {
		return false
	}
	for (const capability of left.capabilities) {
		if (!right.capabilities.has(capability)) return false
	}
	return true
}

/**
 * Resolve the capability implied by a tool's side-effect class.
 *
 * The explicit requiredCapability remains the tool's fine-grained contract;
 * effect adds the coarse document mutation guard so a malformed or drifted
 * definition cannot turn a document command into a readonly-safe command.
 */
function getEffectCapability(effect: ElementToolEffect): CanvasCapability | undefined {
	switch (effect) {
		case "display":
			return "document.read"
		case "document":
			return "document.write"
		case "destructive":
			return "document.delete"
		case "session":
		case "external":
			return undefined
	}
}

export function authorizeCanvasTool(
	context: CanvasAccessContext,
	definition: CanvasToolAuthorizationDefinition,
): CanvasAuthorizationResult {
	const effectCapability = getEffectCapability(definition.effect)
	if (effectCapability && !context.can(effectCapability)) {
		return {
			allowed: false,
			reason: "CAPABILITY_REQUIRED",
			requiredCapability: effectCapability,
		}
	}
	if (!context.can(definition.requiredCapability)) {
		return {
			allowed: false,
			reason: "CAPABILITY_REQUIRED",
			requiredCapability: definition.requiredCapability,
		}
	}
	return { allowed: true }
}

export function resolveCanvasAccessContext(
	options: CanvasAccessPolicyOptions = {},
): CanvasAccessContext {
	const mode = options.mode ?? "edit"
	const profile =
		mode === "edit"
			? EDIT_CAPABILITIES
			: mode === "share"
				? SHARE_CAPABILITIES
				: mode === "history"
					? HISTORY_CAPABILITIES
					: READONLY_CAPABILITIES
	const capabilities = new Set<CanvasCapability>(profile)
	for (const [capability, enabled] of Object.entries(options.capabilities ?? {})) {
		if (
			mode !== "edit" &&
			NON_EDIT_HARD_DENIED_CAPABILITIES.has(capability as CanvasCapability)
		) {
			capabilities.delete(capability as CanvasCapability)
			continue
		}
		if (enabled) capabilities.add(capability as CanvasCapability)
		else capabilities.delete(capability as CanvasCapability)
	}
	return {
		mode,
		// Expose a snapshot so callers cannot mutate the policy by retaining the
		// ReadonlySet reference. Authorization always goes through `can`, which
		// closes over the private set above.
		capabilities: new Set(capabilities),
		can: (capability) => capabilities.has(capability),
	}
}

/** Central source of truth for document and session capabilities. */
export class CanvasAccessPolicy {
	private context: CanvasAccessContext
	private readonly capabilityOverrides: Partial<Record<CanvasCapability, boolean>>
	private configuredMode?: CanvasAccessMode

	constructor(options: CanvasAccessPolicyOptions = {}) {
		this.capabilityOverrides = { ...(options.capabilities ?? {}) }
		this.configuredMode = options.mode
		this.context = this.createContext(options)
	}

	private createContext(options: CanvasAccessUpdate): CanvasAccessContext {
		return resolveCanvasAccessContext(options)
	}

	getContext(): CanvasAccessContext {
		return this.context
	}

	setAccess(update: CanvasAccessUpdate): boolean {
		const hasExplicitMode = update.mode !== undefined
		if (hasExplicitMode) {
			this.configuredMode = update.mode
			// A mode-only update starts from the new mode profile. This prevents a
			// write capability granted in edit mode from leaking into readonly/share
			// when a caller omits the optional override map.
			if (update.capabilities === undefined) {
				for (const capability of Object.keys(
					this.capabilityOverrides,
				) as CanvasCapability[]) {
					delete this.capabilityOverrides[capability]
				}
			}
		}
		if (update.capabilities !== undefined) {
			for (const capability of Object.keys(this.capabilityOverrides) as CanvasCapability[]) {
				delete this.capabilityOverrides[capability]
			}
			Object.assign(this.capabilityOverrides, update.capabilities)
		}
		const mode = update.mode ?? this.configuredMode ?? this.context.mode
		const nextContext = this.createContext({
			mode,
			capabilities: update.capabilities ?? this.capabilityOverrides,
		})
		if (areAccessContextsEqual(this.context, nextContext)) return false
		this.context = nextContext
		return true
	}

	authorize(capability?: CanvasCapability): CanvasAuthorizationResult {
		if (!capability || this.context.can(capability)) return { allowed: true }
		return { allowed: false, reason: "CAPABILITY_REQUIRED", requiredCapability: capability }
	}

	authorizeTool(definition: {
		effect: ElementToolEffect
		requiredCapability: CanvasCapability
	}): CanvasAuthorizationResult {
		return authorizeCanvasTool(this.context, definition)
	}
}
