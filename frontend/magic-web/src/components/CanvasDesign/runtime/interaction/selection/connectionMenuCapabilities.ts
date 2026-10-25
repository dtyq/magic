import { ElementTypeEnum } from "../../document/types"
import type { ConnectionOrigin } from "../../shared/connectionOrigin"
import type { SelectionContentSnapshot } from "./selectionContentCollector"

export type ConnectionMenuCreateKind = "text" | "image-generator" | "video-generator"
export type ConnectionMenuSourceKind =
	"text" | "image" | "video" | "audio" | "video-edit" | "storyboard" | "other"

export interface ConnectionMenuSourceProfile {
	kinds: ReadonlySet<ConnectionMenuSourceKind>
	hasUnusableImages: boolean
}

export interface ConnectionMenuSourcePolicy {
	acceptedKinds: readonly ConnectionMenuSourceKind[]
	requireUsableImages?: boolean
}

export interface ConnectionMenuCreateDefinition {
	kind: ConnectionMenuCreateKind
	labelKey: string
	fallbackLabel: string
	iconKey: "text" | "image" | "video"
	bySide: Partial<Record<"left" | "right", ConnectionMenuSourcePolicy>>
}

export interface ConnectionMenuCapabilityContext {
	origin: ConnectionOrigin
	snapshot: SelectionContentSnapshot
}

// Non-media elements are intentionally excluded from every default action.
const LEFT_TEXT_SOURCE_KINDS: readonly ConnectionMenuSourceKind[] = ["text", "image", "video"]
const LEFT_IMAGE_GENERATOR_SOURCE_KINDS: readonly ConnectionMenuSourceKind[] = [
	...LEFT_TEXT_SOURCE_KINDS,
	"storyboard",
]
const LEFT_VIDEO_GENERATOR_SOURCE_KINDS: readonly ConnectionMenuSourceKind[] = [
	...LEFT_TEXT_SOURCE_KINDS,
	"video-edit",
]
// Video-edit nodes intentionally have no default right-side menu actions.
const RIGHT_SOURCE_KINDS: readonly ConnectionMenuSourceKind[] = ["text", "image", "video", "audio"]

/**
 * The default connection menu is an allowlist. Add a new create action here
 * with its direction/source policy instead of adding removal conditions below.
 */
export const CONNECTION_MENU_CREATE_DEFINITIONS: readonly ConnectionMenuCreateDefinition[] = [
	{
		kind: "text",
		labelKey: "tools.text",
		fallbackLabel: "文本",
		iconKey: "text",
		bySide: {
			left: { acceptedKinds: LEFT_TEXT_SOURCE_KINDS },
			right: { acceptedKinds: RIGHT_SOURCE_KINDS },
		},
	},
	{
		kind: "image-generator",
		labelKey: "tools.imageGenerator",
		fallbackLabel: "图像生成",
		iconKey: "image",
		bySide: {
			// Left-side semantics are intentionally conservative until target input
			// capabilities are modeled explicitly.
			left: { acceptedKinds: LEFT_IMAGE_GENERATOR_SOURCE_KINDS },
			right: {
				acceptedKinds: ["text", "image"],
				requireUsableImages: true,
			},
		},
	},
	{
		kind: "video-generator",
		labelKey: "tools.videoGenerator",
		fallbackLabel: "视频生成",
		iconKey: "video",
		bySide: {
			left: { acceptedKinds: LEFT_VIDEO_GENERATOR_SOURCE_KINDS },
			right: { acceptedKinds: RIGHT_SOURCE_KINDS },
		},
	},
]

function getSourceKind(
	type: SelectionContentSnapshot["items"][number]["type"],
): ConnectionMenuSourceKind {
	if (type === ElementTypeEnum.Text) return "text"
	if (type === ElementTypeEnum.Image) return "image"
	if (type === ElementTypeEnum.Video) return "video"
	if (type === ElementTypeEnum.Audio) return "audio"
	if (type === ElementTypeEnum.Storyboard) return "storyboard"
	if (type === ElementTypeEnum.VideoEdit) return "video-edit"
	return "other"
}

export function getConnectionMenuSourceProfile(
	snapshot: SelectionContentSnapshot,
): ConnectionMenuSourceProfile {
	const kinds = new Set<ConnectionMenuSourceKind>()
	const usableImageIds = new Set(snapshot.imageSequence)
	let hasUnusableImages = false

	for (const item of snapshot.items) {
		const kind = getSourceKind(item.type)
		kinds.add(kind)
		if (kind === "image" && !usableImageIds.has(item.elementId)) {
			hasUnusableImages = true
		}
	}

	return { kinds, hasUnusableImages }
}

function matchesPolicy(
	policy: ConnectionMenuSourcePolicy | undefined,
	profile: ConnectionMenuSourceProfile,
): boolean {
	if (!policy) return false
	const acceptedKinds = new Set(policy.acceptedKinds)
	if (Array.from(profile.kinds).some((kind) => !acceptedKinds.has(kind))) return false
	if (policy.requireUsableImages && profile.kinds.has("image") && profile.hasUnusableImages) {
		return false
	}
	return true
}

export function resolveConnectionMenuCreateDefinitions(
	context: ConnectionMenuCapabilityContext,
): ConnectionMenuCreateDefinition[] {
	const profile = getConnectionMenuSourceProfile(context.snapshot)
	return CONNECTION_MENU_CREATE_DEFINITIONS.filter((definition) =>
		matchesPolicy(definition.bySide[context.origin.side], profile),
	)
}

export function isConnectionMenuSideDisabled(context: ConnectionMenuCapabilityContext): boolean {
	return resolveConnectionMenuCreateDefinitions(context).length === 0
}

export function getAllowedConnectionMenuCreateKinds(
	context: ConnectionMenuCapabilityContext,
): ConnectionMenuCreateKind[] {
	return resolveConnectionMenuCreateDefinitions(context).map((definition) => definition.kind)
}

export function isConnectionMenuCreateKindAllowed(
	context: ConnectionMenuCapabilityContext,
	kind: ConnectionMenuCreateKind,
): boolean {
	return getAllowedConnectionMenuCreateKinds(context).includes(kind)
}
