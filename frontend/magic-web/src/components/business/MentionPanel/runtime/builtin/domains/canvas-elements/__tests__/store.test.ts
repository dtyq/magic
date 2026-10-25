import { beforeEach, describe, expect, it, vi } from "vitest"
import { isValidElement } from "react"
import { Folder } from "lucide-react"
import {
	ElementTypeEnum,
	type CanvasDocument,
} from "@/components/CanvasDesign/runtime/document/types"
import { FolderIcon } from "@/components/CanvasDesign/ui/primitives/icons"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { I18nTexts } from "../../../../../i18n/types"
import {
	MentionItemType,
	type MentionItem,
	type ProjectFileMentionData,
} from "../../../../../types"
import { workspaceFilesRendererEntries } from "../../workspace-files/renderer"
import {
	CANVAS_SELECTION_PENDING_MENTION_LIMIT,
	collectCanvasElementMentionItems,
	getCanvasElementMentionItemId,
	MentionPanelCanvasElementsStore,
} from "../store"

const files: FileItem[] = [
	{
		file_id: "file-hero",
		file_name: "hero.png",
		file_extension: "png",
		relative_file_path: "/design/images/hero.png",
		is_directory: false,
	},
	{
		file_id: "file-clip",
		file_name: "clip.mp4",
		file_extension: "mp4",
		relative_file_path: "/design/videos/clip.mp4",
		is_directory: false,
	},
]

function content(contentId: string, fields: Record<string, unknown> = {}) {
	return { contentId, ...fields }
}

function contentElement(
	element: Record<string, unknown>,
	contentId: string,
	contentFields: Record<string, unknown> = {},
) {
	return {
		...element,
		contents: [content(contentId, contentFields)],
		activeContentId: contentId,
		mainContentId: contentId,
	}
}

const canvasDocument: CanvasDocument = {
	elements: [
		contentElement(
			{
				id: "shape",
				type: ElementTypeEnum.Rectangle,
				name: "Background Shape",
				zIndex: 1,
			},
			"shape-content",
		),
		contentElement(
			{
				id: "frame",
				type: ElementTypeEnum.Frame,
				name: "Main Frame",
				zIndex: 3,
				children: [
					contentElement(
						{
							id: "hero",
							type: ElementTypeEnum.Image,
							name: "Hero Layer",
							zIndex: 2,
						},
						"hero-content",
						{ src: "./images/hero.png" },
					),
					contentElement(
						{
							id: "caption",
							type: ElementTypeEnum.Text,
							name: "Caption Text",
							zIndex: 1,
						},
						"caption-content",
					),
					contentElement(
						{
							id: "missing",
							type: ElementTypeEnum.Image,
							name: "Missing Media",
							zIndex: 0,
						},
						"missing-content",
						{ src: "./images/missing.png" },
					),
					contentElement(
						{
							id: "group",
							type: ElementTypeEnum.Group,
							name: "Nested Group",
							zIndex: 4,
							children: [
								contentElement(
									{
										id: "clip",
										type: ElementTypeEnum.Video,
										name: "Clip Layer",
										zIndex: 1,
									},
									"clip-content",
									{ src: "./videos/clip.mp4" },
								),
							],
						},
						"group-content",
					),
				],
			},
			"frame-content",
		),
	],
}

function createStore() {
	const store = new MentionPanelCanvasElementsStore()
	store.setActiveContext({
		designProjectId: "design-id",
		canvasName: "Pink Design",
		getCanvasDocument: () => canvasDocument,
		resolveFileBySrc: (src) => {
			if (src === "./images/hero.png") return files[0]
			if (src === "./videos/clip.mp4") return files[1]
			return null
		},
	})
	return store
}

function matchesQuery(target: string, query: string) {
	return target.toLowerCase().includes(query.toLowerCase())
}

const t = {
	selectPathItemDescription: {
		rootDirectory: "根目录",
	},
	defaultItems: {
		canvasElements: "画布元素",
	},
} as I18nTexts

function getTypeDescription(item: MentionItem, isSearch = false) {
	const renderer = workspaceFilesRendererEntries.find(([type]) => type === item.type)?.[1]
	return renderer?.getTypeDescription?.({
		item,
		t,
		isSearch,
		platform: "desktop",
	})
}

describe("MentionPanelCanvasElementsStore", () => {
	let store: MentionPanelCanvasElementsStore

	beforeEach(() => {
		store = createStore()
	})

	it("builds a root entry for the active canvas", () => {
		const rootItem = store.getRootMentionItem({ label: t.defaultItems.canvasElements })
		if (!rootItem) throw new Error("Expected canvas elements root item")

		expect(rootItem).toMatchObject({
			id: "canvas-elements",
			type: MentionItemType.FOLDER,
			name: "画布元素",
			description: "Pink Design",
			hasChildren: true,
			isFolder: true,
		})
		expect(getTypeDescription(rootItem, false)).toBe("Pink Design")
	})

	it("builds a lazy root entry without reading the canvas document", () => {
		const getCanvasDocument = vi.fn(() => ({
			elements: [],
		}))
		const lazyStore = new MentionPanelCanvasElementsStore()
		lazyStore.setActiveContext({
			designProjectId: "empty-design-id",
			canvasName: "Empty Design",
			getCanvasDocument,
			resolveFileBySrc: () => null,
		})

		const rootItem = lazyStore.getRootMentionItem({
			lazy: true,
			label: t.defaultItems.canvasElements,
		})

		expect(rootItem).toMatchObject({
			id: "canvas-elements",
			type: MentionItemType.FOLDER,
			name: "画布元素",
			description: "Empty Design",
		})
		expect(getCanvasDocument).not.toHaveBeenCalled()
	})

	it("reuses the warmed snapshot when entering the canvas elements root", () => {
		const getCanvasDocument = vi.fn(() => canvasDocument)
		const warmedStore = new MentionPanelCanvasElementsStore()
		warmedStore.setActiveContext({
			designProjectId: "design-id",
			canvasName: "Pink Design",
			getCanvasDocument,
			resolveFileBySrc: (src) => {
				if (src === "./images/hero.png") return files[0]
				if (src === "./videos/clip.mp4") return files[1]
				return null
			},
		})

		expect(warmedStore.getRootMentionItem()).not.toBeNull()
		expect(
			warmedStore.getFolderMentionItems("canvas-elements").map((item) => item.name),
		).toEqual(["Main Frame"])
		expect(getCanvasDocument).toHaveBeenCalledTimes(1)
	})

	it("rebuilds the snapshot after cache invalidation", () => {
		const nextDocument: CanvasDocument = {
			elements: [
				contentElement(
					{
						id: "clip",
						type: ElementTypeEnum.Video,
						name: "Fresh Clip",
						zIndex: 1,
					},
					"fresh-clip-content",
					{ src: "./videos/clip.mp4" },
				),
			],
		}
		let currentDocument = canvasDocument
		const getCanvasDocument = vi.fn(() => currentDocument)
		const cachedStore = new MentionPanelCanvasElementsStore()
		cachedStore.setActiveContext({
			designProjectId: "design-id",
			canvasName: "Pink Design",
			getCanvasDocument,
			resolveFileBySrc: (src) => {
				if (src === "./images/hero.png") return files[0]
				if (src === "./videos/clip.mp4") return files[1]
				return null
			},
		})

		expect(
			cachedStore.getFolderMentionItems("canvas-elements").map((item) => item.name),
		).toEqual(["Main Frame"])
		currentDocument = nextDocument
		cachedStore.invalidateCache()

		expect(
			cachedStore.getFolderMentionItems("canvas-elements").map((item) => item.name),
		).toEqual(["Fresh Clip"])
		expect(getCanvasDocument).toHaveBeenCalledTimes(2)
	})

	it("does not build a root entry when the active canvas has no selectable media", () => {
		const emptyStore = new MentionPanelCanvasElementsStore()
		emptyStore.setActiveContext({
			designProjectId: "empty-design-id",
			canvasName: "Empty Design",
			getCanvasDocument: () => ({
				elements: [
					{
						id: "shape",
						type: ElementTypeEnum.Rectangle,
						name: "Background Shape",
						zIndex: 1,
					},
				],
			}),
			resolveFileBySrc: () => null,
		})

		expect(emptyStore.getRootMentionItem()).toBeNull()
	})

	it("shows available root layers and keeps frame/group as folders", () => {
		const items = store.getFolderMentionItems("canvas-elements")

		expect(items.map((item) => item.name)).toEqual(["Main Frame"])
		expect(items[0]).toMatchObject({
			type: MentionItemType.FOLDER,
			isFolder: true,
			hasChildren: true,
			tags: ["canvas-element"],
		})
		expect(items[0].description).toBeUndefined()
		expect(isValidElement(items[0].icon)).toBe(true)
		if (isValidElement(items[0].icon)) {
			expect(items[0].icon.type).toBe(FolderIcon)
		}
	})

	it("resolves media layers to project file mention data and hides unavailable layers", () => {
		const frameItems = store.getFolderMentionItems(getCanvasElementMentionItemId("frame"))

		expect(frameItems.map((item) => item.name)).toEqual(["Nested Group", "Hero Layer"])

		const heroItem = frameItems.find((item) => item.name === "Hero Layer")
		const groupItem = frameItems.find((item) => item.name === "Nested Group")
		expect(isValidElement(groupItem?.icon)).toBe(true)
		if (isValidElement(groupItem?.icon)) {
			expect(groupItem.icon.type).toBe(Folder)
		}

		expect(heroItem).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			tags: ["canvas-element"],
			sourcePreview: {
				kind: "canvas-element",
				elementId: "hero",
				mediaType: "image",
				src: "./images/hero.png",
			},
			data: {
				file_id: "file-hero",
				file_name: "hero.png",
				file_path: "design/images/hero.png",
			},
		})
		expect(heroItem?.description).toBeUndefined()
		expect(heroItem?.unSelectable).toBeUndefined()
		expect(frameItems.some((item) => item.unSelectable)).toBe(false)
		expect(frameItems.find((item) => item.name === "Caption Text")).toBeUndefined()
		expect(frameItems.find((item) => item.name === "Missing Media")).toBeUndefined()
	})

	it("keeps resolved media visible when selection rules mark it unavailable", () => {
		const limitedStore = new MentionPanelCanvasElementsStore()
		limitedStore.setActiveContext({
			designProjectId: "design-id",
			canvasName: "Pink Design",
			getCanvasDocument: () => ({
				elements: [
					contentElement(
						{
							id: "clip",
							type: ElementTypeEnum.Video,
							name: "Clip Layer",
							zIndex: 1,
						},
						"clip-content",
						{ src: "./videos/clip.mp4" },
					),
				],
			}),
			resolveFileBySrc: () => ({
				...files[1],
				unSelectable: true,
			}),
		})

		const items = limitedStore.getFolderMentionItems("canvas-elements")

		expect(items).toHaveLength(1)
		expect(items[0]).toMatchObject({
			name: "Clip Layer",
			type: MentionItemType.PROJECT_FILE,
			unSelectable: true,
			sourcePreview: {
				kind: "canvas-element",
				elementId: "clip",
				mediaType: "video",
				src: "./videos/clip.mp4",
			},
		})
	})

	it("searches by element name while selection data remains the resolved file", () => {
		const results = store.searchItems("Clip", "canvas-elements", matchesQuery)

		expect(results).toHaveLength(1)
		const resultItem = results[0]
		if (!resultItem) throw new Error("Expected one canvas element search result")

		expect(resultItem).toMatchObject({
			name: "Clip Layer",
			type: MentionItemType.PROJECT_FILE,
			tags: ["canvas-element"],
			data: {
				file_id: "file-clip",
				file_name: "clip.mp4",
			},
		})
		expect(resultItem.description).toBeUndefined()
		expect(getTypeDescription(resultItem, true)).toBe("画布元素")
	})

	it("keeps scoped search inside the current canvas element folder", () => {
		const groupResults = store.searchItems(
			"Hero",
			getCanvasElementMentionItemId("group"),
			matchesQuery,
		)
		const frameResults = store.searchItems(
			"Hero",
			getCanvasElementMentionItemId("frame"),
			matchesQuery,
		)

		expect(groupResults).toEqual([])
		expect(frameResults.map((item) => item.name)).toEqual(["Hero Layer"])
	})

	it("collects selected nested image, video and audio media with main-image and resource dedupe", () => {
		const selectedDocument: CanvasDocument = {
			elements: [
				{
					id: "frame",
					type: ElementTypeEnum.Frame,
					zIndex: 1,
					children: [
						{
							id: "image-main-version",
							type: ElementTypeEnum.Image,
							zIndex: 3,
							contents: [
								{ contentId: "active", src: "./images/older-version.png" },
								{ contentId: "main", src: "./images/hero.png" },
							],
							activeContentId: "active",
							mainContentId: "main",
						},
						contentElement(
							{
								id: "duplicate-image",
								type: ElementTypeEnum.Image,
								zIndex: 2,
							},
							"duplicate-image-content",
							{ src: "./images/hero.png" },
						),
						{
							id: "nested-group",
							type: ElementTypeEnum.Group,
							zIndex: 1,
							children: [
								contentElement(
									{
										id: "video",
										type: ElementTypeEnum.Video,
										zIndex: 2,
									},
									"video-content",
									{ src: "./videos/clip.mp4" },
								),
								contentElement(
									{
										id: "audio",
										type: ElementTypeEnum.Audio,
										zIndex: 1,
									},
									"audio-content",
									{ src: "./audio/voice.mp3" },
								),
							],
						},
					],
				},
			],
		}

		const items = collectCanvasElementMentionItems({
			document: selectedDocument,
			selectedElementIds: ["frame", "image-main-version"],
			designProjectId: "design-id",
			resolveFileBySrc: (src) => {
				if (src === "./images/hero.png") return files[0]
				if (src === "./videos/clip.mp4") return files[1]
				if (src === "./audio/voice.mp3") {
					return {
						file_id: "file-audio",
						file_name: "voice.mp3",
						file_extension: "mp3",
						relative_file_path: "/design/audio/voice.mp3",
					}
				}
				return null
			},
		})

		expect(items).toHaveLength(3)
		expect(
			items.map((item) =>
				item.type === MentionItemType.PROJECT_FILE
					? (item.data as ProjectFileMentionData).file_id
					: undefined,
			),
		).toEqual(["file-hero", "file-clip", "file-audio"])
		expect(items[0]?.sourcePreview).toMatchObject({
			mediaType: "image",
			src: "./images/hero.png",
		})
		expect(items[2]?.sourcePreview).toMatchObject({ mediaType: "audio" })
	})

	it("silently stops collecting after maxItems unique files", () => {
		const selectedDocument = {
			elements: Array.from({ length: 25 }, (_, index) =>
				contentElement(
					{
						id: `image-${index}`,
						type: ElementTypeEnum.Image,
						zIndex: 25 - index,
					},
					`content-${index}`,
					{ src: `./images/file-${index}.png` },
				),
			),
		} as unknown as CanvasDocument

		const resolveCalls: string[] = []
		const items = collectCanvasElementMentionItems({
			document: selectedDocument,
			selectedElementIds: selectedDocument.elements.map((element) => element.id),
			designProjectId: "design-id",
			maxItems: 20,
			resolveFileBySrc: (src) => {
				resolveCalls.push(src)
				const index = src.match(/file-(\d+)/)?.[1]
				if (index == null) return null
				return {
					file_id: `file-${index}`,
					file_name: `file-${index}.png`,
					file_extension: "png",
					relative_file_path: `/design/images/file-${index}.png`,
				}
			},
		})

		expect(items).toHaveLength(20)
		expect(resolveCalls).toHaveLength(20)
		expect(
			items.map((item) =>
				item.type === MentionItemType.PROJECT_FILE
					? (item.data as ProjectFileMentionData).file_id
					: undefined,
			),
		).toEqual(Array.from({ length: 20 }, (_, index) => `file-${index}`))
	})
})
