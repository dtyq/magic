import { describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { CanvasDesignMentionDataService } from "../CanvasDesignMentionDataService"
import type { ProjectAttachmentMentionNode } from "@/components/CanvasDesign/public/props"
import type { I18nTexts } from "@/components/business/MentionPanel/i18n/types"
import { zhCN } from "@/components/business/MentionPanel/i18n/locales/zh-CN"
import {
	ElementTypeEnum,
	type CanvasDocument,
	type LayerElement,
} from "@/components/CanvasDesign/runtime/document/types"
import { createTestResourceReferenceResolver } from "@/components/CanvasDesign/public/__tests__/testResourceReferenceResolver"

function folderNode(
	id: string,
	name: string,
	children: ProjectAttachmentMentionNode[] = [],
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

function fileNode(name: string, path: string): ProjectAttachmentMentionNode {
	return {
		id: path,
		fileId: path,
		name,
		path,
		extension: name.includes(".") ? `.${name.split(".").pop() ?? ""}` : "",
		isDirectory: false,
	}
}

function createService(
	attachmentRoots: ProjectAttachmentMentionNode[],
	options?: { referenceResourceType?: "image" | "video" },
): CanvasDesignMentionDataService {
	const attachmentPathsByFileId: Record<string, string> = {}
	const collectFiles = (nodes: ProjectAttachmentMentionNode[]) => {
		for (const node of nodes) {
			if (node.isDirectory) {
				collectFiles(node.children ?? [])
				continue
			}
			attachmentPathsByFileId[node.fileId] = node.path
		}
	}
	collectFiles(attachmentRoots)

	const service = new CanvasDesignMentionDataService(attachmentRoots)
	service.setLimitInfoGetter(() => ({
		...options,
		resolveResourceReference: createTestResourceReferenceResolver({
			currentCanvasWorkspacePath: "/design-a",
			attachmentPathsByFileId,
		}),
	}))
	return service
}

function mediaElement(
	type: typeof ElementTypeEnum.Image | typeof ElementTypeEnum.Video,
	id: string,
	src: string,
	name: string,
): LayerElement {
	const contentId = `${id}-content-1`
	return {
		id,
		type,
		name,
		zIndex: 1,
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [{ contentId, src }],
	} as LayerElement
}

describe("CanvasDesignMentionDataService", () => {
	it("keeps folders navigable while keeping project files selectable", async () => {
		const service = createService([
			folderNode("design-a", "Design A", [fileNode("cat.png", "design-a/cat.png")]),
			fileNode("cover.png", "cover.png"),
		])

		const result = await Promise.resolve(
			service.dispatch({
				kind: "default",
				options: { t: {} as I18nTexts },
			}),
		)

		const folder = result.items?.find((item) => item.id === "design-a")
		const file = result.items?.find((item) => item.id === "cover.png")

		expect(folder).toMatchObject({
			type: MentionItemType.FOLDER,
			unSelectable: false,
		})
		expect(file).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			unSelectable: false,
		})
	})

	it("injects current canvas elements into the current design folder", async () => {
		const service = createService([
			folderNode("design-a", "Design A", [
				folderNode("design-a/images", "images", [
					fileNode("cat.png", "design-a/images/cat.png"),
				]),
			]),
		])
		const document: CanvasDocument = {
			elements: [
				mediaElement(ElementTypeEnum.Image, "hero", "./images/cat.png", "Hero Layer"),
				{
					id: "shape",
					type: ElementTypeEnum.Rectangle,
					name: "Shape Layer",
					zIndex: 2,
					activeContentId: "shape-content-1",
					mainContentId: "shape-content-1",
					contents: [{ contentId: "shape-content-1" }],
				},
			],
		}

		const getCanvasDocument = vi.fn(() => document)
		service.setCanvasReferenceElementsContext({
			canvasName: "Design A",
			rootFolderId: "design-a",
			getCanvasDocument,
		})

		const folderResult = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "design-a",
				options: { t: zhCN },
			}),
		)

		expect(folderResult.items?.[0]).toMatchObject({
			id: "canvas-elements",
			type: MentionItemType.FOLDER,
			name: "画布元素",
		})
		expect(folderResult.items?.[0].description).toBeUndefined()
		expect(getCanvasDocument).not.toHaveBeenCalled()

		const rootResult = await Promise.resolve(
			service.dispatch({
				kind: "default",
				options: { t: {} as I18nTexts },
			}),
		)

		expect(rootResult.items?.some((item) => item.id === "canvas-elements")).toBe(false)
		expect(getCanvasDocument).not.toHaveBeenCalled()

		const canvasResult = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "canvas-elements",
			}),
		)

		expect(canvasResult.items).toHaveLength(1)
		expect(canvasResult.items?.[0]).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			name: "Hero Layer",
			data: {
				file_id: "design-a/images/cat.png",
				file_name: "cat.png",
				file_path: "design-a/images/cat.png",
			},
		})
		expect(getCanvasDocument).toHaveBeenCalledTimes(1)
	})

	it("resolves canvas elements when current design files are stored as dsl-relative paths", async () => {
		const service = createService([
			folderNode("/design-a/", "Design A", [fileNode("cat.png", "./images/cat.png")]),
		])
		service.setCanvasReferenceElementsContext({
			canvasName: "Design A",
			rootFolderId: "/design-a",
			getCanvasDocument: () => ({
				elements: [
					mediaElement(ElementTypeEnum.Image, "hero", "./images/cat.png", "Hero Layer"),
				],
			}),
		})

		const folderResult = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "/design-a",
				options: { t: zhCN },
			}),
		)

		expect(folderResult.items?.[0]).toMatchObject({
			id: "canvas-elements",
			type: MentionItemType.FOLDER,
			name: "画布元素",
		})

		const canvasResult = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "canvas-elements",
			}),
		)

		expect(canvasResult.items).toHaveLength(1)
		expect(canvasResult.items?.[0]).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			name: "Hero Layer",
			data: {
				file_id: "./images/cat.png",
				file_path: "./images/cat.png",
			},
		})
	})

	it("keeps dsl-relative canvas element matches scoped to the current design root", async () => {
		const service = createService([
			folderNode("images", "images", [fileNode("cat.png", "images/cat.png")]),
			folderNode("design-a", "Design A", [fileNode("cat.png", "./images/cat.png")]),
		])
		service.setCanvasReferenceElementsContext({
			canvasName: "Design A",
			rootFolderId: "design-a",
			getCanvasDocument: () => ({
				elements: [
					mediaElement(ElementTypeEnum.Image, "hero", "./images/cat.png", "Hero Layer"),
				],
			}),
		})

		const canvasResult = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "canvas-elements",
			}),
		)

		expect(canvasResult.items?.[0]).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			name: "Hero Layer",
			data: {
				file_id: "./images/cat.png",
				file_path: "./images/cat.png",
			},
		})
	})

	it("searches current canvas elements by element name", async () => {
		const service = createService([
			folderNode("design-a", "Design A", [fileNode("cat.png", "design-a/images/cat.png")]),
		])
		service.setCanvasReferenceElementsContext({
			canvasName: "Design A",
			rootFolderId: "design-a",
			getCanvasDocument: () => ({
				elements: [
					mediaElement(ElementTypeEnum.Image, "hero", "./images/cat.png", "Hero Layer"),
				],
			}),
		})

		const result = await Promise.resolve(
			service.dispatch({
				kind: "search",
				query: "Hero",
			}),
		)

		expect(result.items?.[0]).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			name: "Hero Layer",
			tags: ["canvas-element"],
			data: {
				file_name: "cat.png",
			},
		})
	})

	it("does not resolve current canvas relative resources from another design folder", async () => {
		const service = createService([
			folderNode("design-a", "Design A", []),
			folderNode("design-b", "Design B", [
				folderNode("design-b/images", "images", [
					fileNode("cat.png", "design-b/images/cat.png"),
				]),
			]),
		])
		service.setCanvasReferenceElementsContext({
			canvasName: "Design A",
			rootFolderId: "design-a",
			getCanvasDocument: () => ({
				elements: [
					mediaElement(ElementTypeEnum.Image, "hero", "./images/cat.png", "Hero Layer"),
				],
			}),
		})

		const result = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "canvas-elements",
			}),
		)

		expect(result.items).toEqual([])
	})

	it("does not guess other design resources by basename when strict lookup misses", async () => {
		const service = createService([
			folderNode("design-a", "Design A", [
				folderNode("design-a/images", "images", [
					fileNode("cat.png", "design-a/images/cat.png"),
				]),
			]),
		])
		service.setCanvasReferenceElementsContext({
			canvasName: "Design A",
			rootFolderId: "design-a",
			getCanvasDocument: () => ({
				elements: [
					mediaElement(
						ElementTypeEnum.Image,
						"hero",
						"design-b/images/cat.png",
						"Hero Layer",
					),
				],
			}),
		})

		const result = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "canvas-elements",
			}),
		)

		expect(result.items).toEqual([])
	})

	it("keeps video canvas elements visible when the current picker only accepts images", async () => {
		const service = createService(
			[
				folderNode("design-a", "Design A", [
					fileNode("cat.png", "design-a/images/cat.png"),
					fileNode("clip.mp4", "design-a/videos/clip.mp4"),
				]),
			],
			{ referenceResourceType: "image" },
		)
		service.setCanvasReferenceElementsContext({
			canvasName: "Design A",
			rootFolderId: "design-a",
			getCanvasDocument: () => ({
				elements: [
					mediaElement(ElementTypeEnum.Video, "clip", "./videos/clip.mp4", "Clip Layer"),
				],
			}),
		})

		const result = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "canvas-elements",
			}),
		)

		expect(result.items).toHaveLength(1)
		expect(result.items?.[0]).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			name: "Clip Layer",
			unSelectable: true,
			sourcePreview: {
				kind: "canvas-element",
				elementId: "clip",
				mediaType: "video",
				src: "./videos/clip.mp4",
			},
			data: {
				file_name: "clip.mp4",
				file_path: "design-a/videos/clip.mp4",
			},
		})
	})

	it("invalidates current canvas elements cache when refreshing", async () => {
		const service = createService([
			folderNode("design-a", "Design A", [
				fileNode("cat.png", "design-a/images/cat.png"),
				fileNode("clip.mp4", "design-a/videos/clip.mp4"),
			]),
		])
		const firstDocument: CanvasDocument = {
			elements: [
				mediaElement(ElementTypeEnum.Image, "hero", "./images/cat.png", "Hero Layer"),
			],
		}
		const nextDocument: CanvasDocument = {
			elements: [
				mediaElement(ElementTypeEnum.Video, "clip", "./videos/clip.mp4", "Clip Layer"),
			],
		}
		let currentDocument = firstDocument
		const getCanvasDocument = vi.fn(() => currentDocument)
		service.setCanvasReferenceElementsContext({
			canvasName: "Design A",
			rootFolderId: "design-a",
			getCanvasDocument,
		})

		await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "design-a",
			}),
		)

		const firstResult = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "canvas-elements",
			}),
		)
		expect(firstResult.items?.map((item) => item.name)).toEqual(["Hero Layer"])
		expect(getCanvasDocument).toHaveBeenCalledTimes(1)

		currentDocument = nextDocument
		service.requestRefresh()

		const result = await Promise.resolve(
			service.dispatch({
				kind: "children",
				id: "canvas-elements",
			}),
		)

		expect(result.items?.map((item) => item.name)).toEqual(["Clip Layer"])
		expect(getCanvasDocument).toHaveBeenCalledTimes(2)
	})
})
