import { fireEvent, render, screen } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CanvasDesignI18nProvider } from "../../../../app/providers/I18nProvider"
import { MagicProvider } from "../../../../app/providers/MagicProvider"
import type {
	MentionDataServiceCtor,
	MentionExtensionCtor,
	CanvasMentionNodeViewRenderer,
	ProjectAttachmentMentionNode,
	ReferenceResourcePanelLimitInfo,
} from "../../../../public/props"
import type { CanvasDesignMethods } from "../../../../public/magic-types"
import type { ResolveCanvasResourceReference } from "../../../../public/resource-reference"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import { CANVAS_REFERENCE_MENTION_ITEM_TYPE } from "../reference-assets/canvasReferenceMention.constants"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
} from "../reference-assets/reference-resource.types"
import { useCanvasReferenceMentionRuntime } from "../reference-assets/useCanvasReferenceMentionRuntime"
import { useCanvasReferenceMention } from "../useCanvasReferenceMention"
import { getContentFromString } from "../tiptap/contentUtils"

vi.mock("@tiptap/react", () => ({ NodeViewWrapper: "span" }))

class TestMentionDataService {
	static instances: TestMentionDataService[] = []

	roots: ProjectAttachmentMentionNode[]
	limitInfoGetter?: () => ReferenceResourcePanelLimitInfo | undefined
	refreshCount = 0

	constructor(roots: ProjectAttachmentMentionNode[]) {
		this.roots = roots
		TestMentionDataService.instances.push(this)
	}

	dispatch = vi.fn(() => ({ items: [] }))

	setLimitInfoGetter(getter: (() => ReferenceResourcePanelLimitInfo | undefined) | undefined) {
		this.limitInfoGetter = getter
	}

	syncProjectAttachmentRoots(roots: ProjectAttachmentMentionNode[]) {
		this.roots = roots
	}

	requestRefresh() {
		this.refreshCount += 1
	}
}

const TestMentionDataServiceCtor = TestMentionDataService as unknown as MentionDataServiceCtor

const imageVideoLimits: ReferenceAssetPerTypeLimits = {
	reference_images: { min: 0, max: 2 },
	reference_videos: { min: 0, max: 1 },
	reference_audios: { min: 0, max: 0 },
	total: { min: 0, max: 3 },
}

const currentVideoFullCounts: ReferenceAssetTypeCounts = {
	images: 0,
	videos: 1,
	audios: 0,
}

let latestRuntime: ReturnType<typeof useCanvasReferenceMentionRuntime> | undefined
let latestMention: ReturnType<typeof useCanvasReferenceMention> | undefined
let configureMentionExtension: ReturnType<typeof vi.fn>
const TestMentionExtension = {
	configure: (options: unknown) => configureMentionExtension(options),
} as unknown as MentionExtensionCtor

function getRuntime() {
	if (!latestRuntime) throw new Error("Runtime hook did not render")
	return latestRuntime
}

function getMention() {
	if (!latestMention) throw new Error("Mention hook did not render")
	return latestMention
}

function getConfiguredOptions() {
	const firstCall = configureMentionExtension.mock.calls[0]
	if (!firstCall) throw new Error("Mention extension was not configured")
	return firstCall[0] as {
		getInitialLoadOptions?: () => { itemId?: string } | undefined
		getInitialNavigationStack?: () => Array<{ id: string; name: string }> | undefined
		getSelectionSummary?: () =>
			| {
					currentCounts: Record<string, number>
					limits: Record<string, number | undefined>
			  }
			| undefined
		canSelectItem?: (item: { type?: string; isFolder?: boolean }) => boolean
		canToggleMultiSelectItem?: (item: { type?: string; isFolder?: boolean }) => boolean
		nodeViewRenderers?: Record<string, CanvasMentionNodeViewRenderer>
	}
}

function fileNode(name: string, path: string): ProjectAttachmentMentionNode {
	const extension = name.includes(".") ? `.${name.split(".").pop() ?? ""}` : ""
	return {
		id: path,
		fileId: path,
		name,
		path,
		extension,
		isDirectory: false,
	}
}

function folderNode(
	id: string,
	name: string,
	children: ProjectAttachmentMentionNode[],
): ProjectAttachmentMentionNode {
	return {
		id,
		fileId: id,
		name,
		path: id,
		isDirectory: true,
		children,
	}
}

interface ProviderProps {
	children: ReactNode
	folderId?: string
	folderName?: string
	tree?: ProjectAttachmentMentionNode[]
	methods?: CanvasDesignMethods
}
type ProviderConfig = Omit<ProviderProps, "children">

function Providers(props: ProviderProps) {
	return (
		<MagicProvider
			methods={props.methods}
			projectAttachmentMentionTree={props.tree}
			defaultProjectAttachmentFolderId={props.folderId}
			defaultProjectAttachmentFolderName={props.folderName}
			mentionDataServiceCtor={TestMentionDataServiceCtor}
			mentionExtension={TestMentionExtension}
		>
			<CanvasDesignI18nProvider
				t={(key, defaultValue) => (typeof defaultValue === "string" ? defaultValue : key)}
			>
				{props.children}
			</CanvasDesignI18nProvider>
		</MagicProvider>
	)
}

const resolveDesignAResourceReference: ResolveCanvasResourceReference = (input) => {
	const path =
		input.namespace === "external-url" ? input.url : "path" in input ? input.path : input.fileId
	const normalized = path.replace(/\\/g, "/")
	let workspacePath: string
	if (normalized.startsWith("./")) {
		workspacePath = `/画布A/${normalized.replace(/^\.\/+/, "")}`
	} else if (normalized.startsWith("/")) {
		workspacePath = normalized
	} else if (normalized.startsWith("画布A/") || normalized.startsWith("画布B/")) {
		workspacePath = `/${normalized}`
	} else {
		workspacePath = `/${normalized}`
	}
	const storagePath = workspacePath.startsWith("/画布A/")
		? `./${workspacePath.slice("/画布A/".length)}`
		: workspacePath
	return {
		status: "resolved",
		resourceKind: "workspace-file",
		rawReference: path,
		workspacePath,
		storagePath,
		identity: `workspace:${workspacePath}`,
		candidates: [workspacePath],
		legacyRecovered: false,
		resolutionSource: "strict-path",
	}
}

const designAMethods = {
	resolveResourceReference: resolveDesignAResourceReference,
} as CanvasDesignMethods

type RuntimeOptions = Parameters<typeof useCanvasReferenceMentionRuntime>[0]
type MentionOptions = Parameters<typeof useCanvasReferenceMention>[0]

function RuntimeProbe(props: { options: RuntimeOptions }) {
	latestRuntime = useCanvasReferenceMentionRuntime(props.options)
	return null
}

function MentionProbe(props: { options?: MentionOptions }) {
	latestMention = useCanvasReferenceMention(props.options)
	return null
}

function renderRuntime(props: ProviderConfig & { options?: Partial<RuntimeOptions> }) {
	const runtimeOptions: RuntimeOptions = {
		referenceResourceType: "image",
		referenceFileInfos: [],
		...props.options,
	}
	return render(
		<Providers {...props}>
			<RuntimeProbe options={runtimeOptions} />
		</Providers>,
	)
}

function renderMention(props: ProviderConfig & { options?: MentionOptions }) {
	return render(
		<Providers {...props}>
			<MentionProbe options={props.options} />
		</Providers>,
	)
}

function getItemDisabled(name: string) {
	const item = getMention().matchableItems.find((entry) => entry.name === name)
	if (!item) throw new Error(`Missing matchable item: ${name}`)
	return item.disabled ?? false
}

describe("useCanvasReferenceMention", () => {
	beforeEach(() => {
		latestRuntime = undefined
		latestMention = undefined
		TestMentionDataService.instances = []
		configureMentionExtension = vi.fn((options: unknown) => ({ options }))
	})

	it("keeps default directory getters fresh without rebuilding the mention extension", () => {
		const { rerender } = renderMention({
			folderId: "design-a",
			folderName: "Design A",
			tree: [],
		})
		const options = getConfiguredOptions()

		expect(configureMentionExtension).toHaveBeenCalledTimes(1)
		expect(options.getInitialLoadOptions?.()).toEqual({ itemId: "design-a" })
		expect(options.getInitialNavigationStack?.()).toEqual([
			{ id: "design-a", name: "Design A", state: "default" },
		])

		rerender(
			<Providers folderId="design-b" folderName="Design B" tree={[]}>
				<MentionProbe />
			</Providers>,
		)

		expect(configureMentionExtension).toHaveBeenCalledTimes(1)
		expect(options.getInitialLoadOptions?.()).toEqual({ itemId: "design-b" })
		expect(options.getInitialNavigationStack?.()).toEqual([
			{ id: "design-b", name: "Design B", state: "default" },
		])
	})

	it("keeps selection summary fresh without rebuilding the mention extension", () => {
		const { rerender } = renderMention({
			folderId: "design-a",
			folderName: "Design A",
			tree: [],
			options: {
				maxReferenceFiles: 2,
				currentReferenceFiles: [],
				referenceResourceType: "image",
			},
		})
		const options = getConfiguredOptions()

		expect(configureMentionExtension).toHaveBeenCalledTimes(1)
		expect(options.getSelectionSummary?.()?.currentCounts).toEqual({
			image: 0,
			video: 0,
			audio: 0,
		})

		rerender(
			<Providers folderId="design-a" folderName="Design A" tree={[]}>
				<MentionProbe
					options={{
						maxReferenceFiles: 2,
						currentReferenceFiles: ["design-a/cat.png"],
						referenceResourceType: "image",
					}}
				/>
			</Providers>,
		)

		expect(configureMentionExtension).toHaveBeenCalledTimes(1)
		expect(options.getSelectionSummary?.()?.currentCounts).toEqual({
			image: 1,
			video: 0,
			audio: 0,
		})
	})

	it("returns the same default directory for @ mention and project-select panel runtime", () => {
		const { rerender } = renderRuntime({
			folderId: "design-a",
			folderName: "Design A",
		})
		const runtime = getRuntime()
		const getInitialLoadOptions = runtime.getInitialLoadOptions
		const getInitialNavigationStack = runtime.getInitialNavigationStack

		expect(runtime.initialLoadOptions).toEqual(getInitialLoadOptions())
		expect(runtime.initialNavigationStack).toEqual(getInitialNavigationStack())
		expect(runtime.selectionScopeId).toBe("design-a")

		rerender(
			<Providers folderId="design-b" folderName="Design B">
				<RuntimeProbe
					options={{ referenceResourceType: "image", referenceFileInfos: [] }}
				/>
			</Providers>,
		)

		expect(getRuntime().getInitialLoadOptions).toBe(getInitialLoadOptions)
		expect(getRuntime().getInitialNavigationStack).toBe(getInitialNavigationStack)
		expect(getRuntime().initialLoadOptions).toEqual({ itemId: "design-b" })
		expect(getRuntime().selectionScopeId).toBe("design-b")
		expect(getInitialLoadOptions()).toEqual({ itemId: "design-b" })
	})

	it("allows folder navigation but prevents folder insertion", () => {
		render(
			<Providers folderId="design-a" folderName="Design A" tree={[]}>
				<RuntimeProbe
					options={{ referenceResourceType: "image", referenceFileInfos: [] }}
				/>
				<MentionProbe />
			</Providers>,
		)
		const runtime = getRuntime()
		const options = getConfiguredOptions()

		expect(
			runtime.catalogBehavior.shouldEnterFolderDirectly?.({
				selectedItem: {
					type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.folder,
					isFolder: true,
				},
				enterFolder: false,
			}),
		).toBe(true)
		expect(
			runtime.canSelectItem({
				type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.folder,
				isFolder: true,
			}),
		).toBe(false)
		expect(
			runtime.canSelectItem({
				type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile,
				isFolder: true,
			}),
		).toBe(false)
		expect(
			options.canToggleMultiSelectItem?.({
				type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.folder,
				isFolder: true,
			}),
		).toBe(false)
		expect(
			runtime.canSelectItem({
				type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile,
			}),
		).toBe(true)
	})

	it("disables unselected files after reaching the total reference limit", () => {
		renderMention({
			tree: [
				folderNode("design-a", "Design A", [
					fileNode("cat.png", "design-a/cat.png"),
					fileNode("dog.png", "design-a/dog.png"),
				]),
			],
			options: {
				maxReferenceFiles: 1,
				currentReferenceFiles: ["design-a/cat.png"],
				isReferenceFileLimitReached: true,
				referenceResourceType: "image",
			},
		})

		expect(getItemDisabled("cat.png")).toBe(false)
		expect(getItemDisabled("dog.png")).toBe(true)
	})

	it("applies image and video editor type/capacity limits", () => {
		const tree = [
			folderNode("design-a", "Design A", [
				fileNode("cat.png", "design-a/cat.png"),
				fileNode("clip.mp4", "design-a/clip.mp4"),
				fileNode("voice.mp3", "design-a/voice.mp3"),
			]),
		]

		renderMention({
			tree,
			options: {
				referenceResourceType: "image",
			},
		})
		expect(getItemDisabled("cat.png")).toBe(false)
		expect(getItemDisabled("clip.mp4")).toBe(true)
		expect(getItemDisabled("voice.mp3")).toBe(true)

		renderMention({
			tree,
			options: {
				referenceResourceType: ["image", "video"],
				assetLimits: imageVideoLimits,
				currentAssetCounts: currentVideoFullCounts,
			},
		})
		expect(getItemDisabled("cat.png")).toBe(false)
		expect(getItemDisabled("clip.mp4")).toBe(true)
		expect(getItemDisabled("voice.mp3")).toBe(true)
	})

	it("prefers current reference files before project attachments for duplicate names", () => {
		renderMention({
			tree: [folderNode("design-a", "Design A", [fileNode("cat.png", "project/cat.png")])],
			options: {
				matchableItems: [{ name: "cat.png", path: "current/cat.png" }],
				referenceResourceType: "image",
			},
		})

		const catItems = getMention().matchableItems.filter((item) => item.name === "cat.png")
		expect(catItems.map((item) => item.path)).toEqual(["current/cat.png", "project/cat.png"])

		const doc = getContentFromString("@cat.png", getMention().matchableItems)
		const mentionNode = doc.content?.[0]?.content?.[0] as
			{ attrs?: { data?: { file_path?: string } } } | undefined
		expect(mentionNode?.attrs?.data?.file_path).toBe("current/cat.png")
	})

	it("can exclude project-tree candidates for frame-only editors", () => {
		renderMention({
			tree: [folderNode("design-a", "Design A", [fileNode("cat.png", "project/cat.png")])],
			options: {
				matchableItems: [],
				includeProjectTreeCandidates: false,
				mentionEnabledOverride: false,
				referenceResourceType: "image",
			},
		})

		expect(getMention().matchableItems).toEqual([])
		expect(getMention().mentionEnabled).toBe(false)
		const doc = getContentFromString("@cat.png", getMention().matchableItems)
		const paragraphText = (doc.content?.[0]?.content || [])
			.map((node) => (node.type === "text" ? node.text || "" : ""))
			.join("")
		expect(paragraphText).toBe("@cat.png")
		expect(doc.content?.[0]?.content?.some((node) => node.type === "mention")).toBe(false)
	})

	it("deduplicates current-canvas absolute and DSL-relative paths by host identity", () => {
		renderMention({
			methods: designAMethods,
			tree: [
				folderNode("design-a", "Design A", [fileNode("cat.png", "/画布A/images/cat.png")]),
			],
			options: {
				matchableItems: [{ name: "cat.png", path: "./images/cat.png" }],
				referenceResourceType: "image",
			},
		})

		expect(getMention().matchableItems.filter((item) => item.name === "cat.png")).toEqual([
			expect.objectContaining({ path: "./images/cat.png" }),
		])
	})

	it("keeps same-name project-tree files with a distinct resolver identity", () => {
		renderMention({
			methods: designAMethods,
			tree: [folderNode("root", "Root", [fileNode("cat.png", "/images/cat.png")])],
			options: {
				matchableItems: [{ name: "cat.png", path: "./images/cat.png" }],
				referenceResourceType: "image",
			},
		})

		expect(getMention().matchableItems.filter((item) => item.name === "cat.png")).toEqual([
			expect.objectContaining({ path: "./images/cat.png", source: "element-reference" }),
			expect.objectContaining({ path: "/images/cat.png", source: "project-tree" }),
		])
	})

	it("keeps relative and absolute spellings when the host resolver is missing", () => {
		renderMention({
			tree: [folderNode("root", "Root", [fileNode("cat.png", "/images/cat.png")])],
			options: {
				matchableItems: [{ name: "cat.png", path: "./images/cat.png" }],
				referenceResourceType: "image",
			},
		})

		expect(getMention().matchableItems.filter((item) => item.name === "cat.png")).toEqual([
			expect.objectContaining({ path: "./images/cat.png", source: "element-reference" }),
			expect.objectContaining({ path: "/images/cat.png", source: "project-tree" }),
		])
	})

	it("keeps relative and absolute spellings when the host resolver cannot resolve them", () => {
		const unresolvedMethods = {
			resolveResourceReference: ((input) => {
				const rawReference =
					input.namespace === "external-url"
						? input.url
						: "path" in input
							? input.path
							: input.fileId
				return {
					status: "not-found",
					rawReference,
					candidates: [],
				}
			}) as ResolveCanvasResourceReference,
		} as CanvasDesignMethods

		renderMention({
			methods: unresolvedMethods,
			tree: [folderNode("root", "Root", [fileNode("cat.png", "/images/cat.png")])],
			options: {
				matchableItems: [{ name: "cat.png", path: "./images/cat.png" }],
				referenceResourceType: "image",
			},
		})

		expect(getMention().matchableItems.filter((item) => item.name === "cat.png")).toEqual([
			expect.objectContaining({ path: "./images/cat.png", source: "element-reference" }),
			expect.objectContaining({ path: "/images/cat.png", source: "project-tree" }),
		])
	})

	it("keeps distinct project-tree names alongside current references", () => {
		renderMention({
			methods: designAMethods,
			tree: [folderNode("root", "Root", [fileNode("dog.png", "/images/dog.png")])],
			options: {
				matchableItems: [{ name: "cat.png", path: "./images/cat.png" }],
				referenceResourceType: "image",
			},
		})

		expect(getMention().matchableItems.map((item) => item.path)).toEqual([
			"./images/cat.png",
			"/images/dog.png",
		])
	})

	it("renders a confirmed deleted mention in red semantics and disables locating it", () => {
		const locateProjectFile = vi.fn()
		const resolveResourceReference = createTestResourceReferenceResolver({
			attachmentsReady: true,
		})
		const methods = {
			resolveResourceReference,
			locateProjectFile,
		} as unknown as CanvasDesignMethods
		renderMention({ methods, tree: [] })
		const Renderer =
			getConfiguredOptions().nodeViewRenderers?.[
				CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile
			]
		if (!Renderer) throw new Error("Missing project-file node view renderer")

		render(
			<Providers methods={methods}>
				{createElement(Renderer, {
					node: {
						attrs: {
							type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile,
							data: {
								file_id: "deleted",
								file_name: "截屏.png",
								file_path: "/images/images/截屏.png",
								file_extension: "png",
							},
						},
					},
					extension: { options: {} },
				})}
			</Providers>,
		)

		const mention = screen.getByTestId("canvas-project-file-mention")
		expect(mention).toHaveAttribute("data-deleted", "true")
		expect(mention).toHaveTextContent("截屏.png（已删除）")
		fireEvent.click(mention)
		expect(locateProjectFile).not.toHaveBeenCalled()
	})

	it("uses the shared desktop visual contract for media mentions", () => {
		renderMention({ methods: designAMethods, tree: [] })
		const Renderer =
			getConfiguredOptions().nodeViewRenderers?.[
				CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile
			]
		if (!Renderer) throw new Error("Missing project-file node view renderer")

		render(
			<Providers methods={designAMethods}>
				{createElement(Renderer, {
					node: {
						attrs: {
							type: CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile,
							data: {
								file_id: "image-1",
								file_name: "cat.png",
								file_path: "/images/cat.png",
								file_extension: "png",
							},
						},
					},
					extension: { options: {} },
				})}
			</Providers>,
		)

		const visual = document.querySelector(".magic-message-file-mention-visual")
		expect(visual).toHaveClass("bg-primary-10", "text-primary", "h-[18px]")
		expect(visual).toHaveClass("inline-flex", "items-center")
	})
})
