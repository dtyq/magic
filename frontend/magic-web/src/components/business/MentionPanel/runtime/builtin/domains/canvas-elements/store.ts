import { createElement } from "react"
import { Folder, Image as ImageIcon, Video, Volume2 } from "lucide-react"
import { makeAutoObservable } from "mobx"
import type {
	CanvasDocument,
	ElementType,
	AudioElement,
	ImageElement,
	ImageElementContent,
	LayerElement,
	VideoElement,
} from "@/components/CanvasDesign/runtime/document/types"
import { ElementTypeEnum } from "@/components/CanvasDesign/runtime/document/types"
import {
	getActiveContent,
	getMainContent,
} from "@/components/CanvasDesign/runtime/document/elementContent"
import { CanvasFileIcon, FolderIcon } from "@/components/CanvasDesign/ui/primitives/icons"
import { MentionItemType, type MentionItem } from "../../../../types"
import {
	createProjectFileMentionData,
	getProjectFileResourceIdentity,
} from "../../../../utils/projectReferenceMention"
import { MentionPanelBuiltinItemId } from "../../catalog-ids"
import { CANVAS_ELEMENT_TAG } from "./item-utils"

const CANVAS_ELEMENT_ITEM_ID_PREFIX = `${MentionPanelBuiltinItemId.CANVAS_ELEMENTS}:element:`

export interface ActiveCanvasElementsContext {
	designProjectId: string
	canvasName: string
	getCanvasDocument: () => CanvasDocument | null | undefined
	resolveFileBySrc: (src: string) => CanvasElementResolvedFile | null
}

export interface CanvasElementResolvedFile {
	file_id?: string | number
	file_name?: string | number
	display_filename?: string | number
	filename?: string | number
	name?: string | number
	file_extension?: string
	file_size?: number
	relative_file_path?: string
	parent_id?: string | number | null
	display_config?: Record<string, unknown>
	unSelectable?: boolean
}

function encodeElementId(elementId: string): string {
	return encodeURIComponent(elementId)
}

export function getCanvasElementMentionItemId(elementId: string): string {
	return `${CANVAS_ELEMENT_ITEM_ID_PREFIX}${encodeElementId(elementId)}`
}

export function isCanvasElementsMentionItemId(id: string | undefined): boolean {
	return (
		id === MentionPanelBuiltinItemId.CANVAS_ELEMENTS ||
		Boolean(id?.startsWith(CANVAS_ELEMENT_ITEM_ID_PREFIX))
	)
}

function getSortedElements(elements: LayerElement[] | undefined): LayerElement[] {
	return [...(elements ?? [])].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
}

function getElementChildren(element: LayerElement): LayerElement[] {
	if (!("children" in element)) return []

	return Array.isArray(element.children) ? element.children : []
}

function isContainerElement(element: LayerElement): boolean {
	return element.type === ElementTypeEnum.Frame || element.type === ElementTypeEnum.Group
}

function isMediaElement(
	element: LayerElement,
): element is ImageElement | VideoElement | AudioElement {
	return (
		element.type === ElementTypeEnum.Image ||
		element.type === ElementTypeEnum.Video ||
		element.type === ElementTypeEnum.Audio
	)
}

function getElementTypeLabel(type: ElementType): string {
	switch (type) {
		case ElementTypeEnum.Frame:
			return "Frame"
		case ElementTypeEnum.Group:
			return "Group"
		case ElementTypeEnum.Image:
			return "图片"
		case ElementTypeEnum.Video:
			return "视频"
		case ElementTypeEnum.Audio:
			return "音频"
		case ElementTypeEnum.Text:
			return "文本"
		case ElementTypeEnum.Rectangle:
			return "矩形"
		case ElementTypeEnum.Ellipse:
			return "椭圆"
		case ElementTypeEnum.Triangle:
			return "三角形"
		case ElementTypeEnum.Star:
			return "星形"
		default:
			return "图层"
	}
}

function getElementDisplayName(element: LayerElement): string {
	const name = element.name?.trim()
	if (name) return name

	return getElementTypeLabel(element.type)
}

function getElementIcon(element: LayerElement) {
	switch (element.type) {
		case ElementTypeEnum.Frame:
			return createElement(FolderIcon, {
				size: 16,
				className: "text-slate-400",
			})
		case ElementTypeEnum.Group:
			return createElement(Folder, {
				size: 16,
				className: "text-slate-400",
			})
		case ElementTypeEnum.Image:
			return createElement(ImageIcon, { size: 16 })
		case ElementTypeEnum.Video:
			return createElement(Video, { size: 16 })
		case ElementTypeEnum.Audio:
			return createElement(Volume2, { size: 16 })
		default:
			return null
	}
}

function getMediaSource(element: ImageElement | VideoElement | AudioElement): {
	src: string
	crop?: ImageElementContent["crop"]
} | null {
	if (element.type === ElementTypeEnum.Image) {
		const content = getMainContent(element)
		if (!content?.src) return null

		return {
			src: content.src,
			...(content.crop ? { crop: content.crop } : {}),
		}
	}

	const content = getActiveContent(element)
	return content?.src ? { src: content.src } : null
}

function getCanvasRootIcon() {
	return createElement(CanvasFileIcon, {
		size: 16,
		gradientFrom: "#7C3AED",
		gradientTo: "#A78BFA",
	})
}

interface CanvasElementSearchEntry {
	elementName: string
	item: MentionItem
}

interface CanvasElementsSnapshot {
	rootItems: MentionItem[]
	folderItemsById: Map<string, MentionItem[]>
	searchEntriesByFolderId: Map<string, CanvasElementSearchEntry[]>
}

interface CanvasElementBuildResult {
	item: MentionItem
	searchEntries: CanvasElementSearchEntry[]
}

interface CanvasElementsBuildResult {
	items: MentionItem[]
	searchEntries: CanvasElementSearchEntry[]
}

export class MentionPanelCanvasElementsStore {
	private context: ActiveCanvasElementsContext | null = null
	private snapshot: CanvasElementsSnapshot | null = null

	constructor() {
		makeAutoObservable<MentionPanelCanvasElementsStore, "context" | "snapshot">(
			this,
			{
				context: false,
				snapshot: false,
			},
			{ autoBind: true },
		)
	}

	setActiveContext(context: ActiveCanvasElementsContext | null) {
		this.context = context
		this.invalidateCache()
	}

	clearActiveContext(designProjectId?: string) {
		if (!designProjectId || this.context?.designProjectId === designProjectId) {
			this.context = null
			this.invalidateCache()
		}
	}

	invalidateCache() {
		this.snapshot = null
	}

	getRootMentionItem(options?: { lazy?: boolean; label?: string }): MentionItem | null {
		if (!this.context) return null

		if (!options?.lazy) {
			const snapshot = this.getSnapshot()
			if (!snapshot || snapshot.rootItems.length === 0) return null
		}

		const description = this.context.canvasName || "当前画布"

		return {
			id: MentionPanelBuiltinItemId.CANVAS_ELEMENTS,
			type: MentionItemType.FOLDER,
			name: options?.label || "Canvas Elements",
			icon: getCanvasRootIcon(),
			description,
			hasChildren: true,
			isFolder: true,
		}
	}

	getFolderMentionItems(folderId: string): MentionItem[] {
		const snapshot = this.getSnapshot()
		if (!snapshot) return []

		if (folderId === MentionPanelBuiltinItemId.CANVAS_ELEMENTS) {
			return [...snapshot.rootItems]
		}

		return [...(snapshot.folderItemsById.get(folderId) ?? [])]
	}

	searchItems(
		query: string,
		scopeFolderId: string | undefined,
		matchesQuery: (target: string, query: string) => boolean,
	): MentionItem[] {
		if (!this.context || !query.trim()) return []

		const snapshot = this.getSnapshot()
		if (!snapshot) return []

		const normalizedQuery = query.trim()
		const searchScopeId = scopeFolderId ?? MentionPanelBuiltinItemId.CANVAS_ELEMENTS
		const entries = snapshot.searchEntriesByFolderId.get(searchScopeId) ?? []

		return entries
			.filter((entry) => matchesQuery(entry.elementName, normalizedQuery))
			.map((entry) => entry.item)
	}

	private getSnapshot(): CanvasElementsSnapshot | null {
		if (this.snapshot) return this.snapshot
		if (!this.context) return null

		const document = this.context.getCanvasDocument()
		if (!document) return null

		const folderItemsById = new Map<string, MentionItem[]>()
		const searchEntriesByFolderId = new Map<string, CanvasElementSearchEntry[]>()
		const rootResult = this.buildElementsSnapshot(
			getSortedElements(document.elements),
			folderItemsById,
			searchEntriesByFolderId,
		)
		searchEntriesByFolderId.set(
			MentionPanelBuiltinItemId.CANVAS_ELEMENTS,
			rootResult.searchEntries,
		)

		this.snapshot = {
			rootItems: rootResult.items,
			folderItemsById,
			searchEntriesByFolderId,
		}
		return this.snapshot
	}

	private buildElementsSnapshot(
		elements: LayerElement[],
		folderItemsById: Map<string, MentionItem[]>,
		searchEntriesByFolderId: Map<string, CanvasElementSearchEntry[]>,
	): CanvasElementsBuildResult {
		const items: MentionItem[] = []
		const searchEntries: CanvasElementSearchEntry[] = []

		for (const element of elements) {
			const result = this.buildElementSnapshot(
				element,
				folderItemsById,
				searchEntriesByFolderId,
			)
			if (!result) continue

			items.push(result.item)
			searchEntries.push(...result.searchEntries)
		}

		return { items, searchEntries }
	}

	private buildElementSnapshot(
		element: LayerElement,
		folderItemsById: Map<string, MentionItem[]>,
		searchEntriesByFolderId: Map<string, CanvasElementSearchEntry[]>,
	): CanvasElementBuildResult | null {
		const elementName = getElementDisplayName(element)
		const itemId = getCanvasElementMentionItemId(element.id)

		if (isContainerElement(element)) {
			const childResult = this.buildElementsSnapshot(
				getSortedElements(getElementChildren(element)),
				folderItemsById,
				searchEntriesByFolderId,
			)
			if (childResult.items.length === 0) return null

			const item: MentionItem = {
				id: itemId,
				type: MentionItemType.FOLDER,
				name: elementName,
				icon: getElementIcon(element),
				hasChildren: true,
				isFolder: true,
				tags: [CANVAS_ELEMENT_TAG],
			}
			folderItemsById.set(itemId, childResult.items)
			searchEntriesByFolderId.set(itemId, childResult.searchEntries)

			return {
				item,
				searchEntries: [{ elementName, item }, ...childResult.searchEntries],
			}
		}

		if (isMediaElement(element)) {
			const item = this.buildMediaMentionItem(element, elementName)
			if (item) {
				return {
					item,
					searchEntries: [{ elementName, item }],
				}
			}
		}

		return null
	}

	private buildMediaMentionItem(
		element: ImageElement | VideoElement | AudioElement,
		elementName: string,
	): MentionItem | null {
		const source = getMediaSource(element)
		const file = source?.src ? this.context?.resolveFileBySrc(source.src) : null
		if (!source || !file) return null

		const data = createProjectFileMentionData(file)
		return {
			id: getCanvasElementMentionItemId(element.id),
			type: MentionItemType.PROJECT_FILE,
			name: elementName,
			icon: file.file_extension || element.type,
			extension: file.file_extension,
			hasChildren: false,
			isFolder: false,
			path: file.relative_file_path,
			size: file.file_size,
			parentId: file.parent_id == null ? undefined : String(file.parent_id),
			displayConfig: file.display_config,
			data,
			tags: [CANVAS_ELEMENT_TAG],
			unSelectable: file.unSelectable || undefined,
			sourcePreview: {
				kind: "canvas-element",
				designProjectId: this.context?.designProjectId,
				elementId: element.id,
				mediaType:
					element.type === ElementTypeEnum.Video
						? "video"
						: element.type === ElementTypeEnum.Audio
							? "audio"
							: "image",
				src: source.src,
				...(source.crop ? { crop: source.crop } : {}),
			},
		}
	}
}

/** Silent cap for canvas-selection pending file mentions in MessageEditor. */
/** Cap pending canvas-selection mentions to avoid mounting hundreds of TipTap NodeViews at once. */
export const CANVAS_SELECTION_PENDING_MENTION_LIMIT = 20

export interface CollectCanvasElementMentionItemsOptions {
	document: CanvasDocument | null | undefined
	selectedElementIds: string[]
	designProjectId: string
	resolveFileBySrc: (src: string) => CanvasElementResolvedFile | null
	/** Soft max unique files to collect; collection stops once reached. */
	maxItems?: number
}

/**
 * Collects the project-file mentions used by the current selection.
 * Containers are expanded recursively, while repeated references to one file
 * are collapsed so the editor receives one mention per resource.
 * When maxItems is set, collection stops as soon as that many unique files are found.
 */
export function collectCanvasElementMentionItems(
	options: CollectCanvasElementMentionItemsOptions,
): MentionItem[] {
	const { document, selectedElementIds, designProjectId, resolveFileBySrc, maxItems } = options
	if (!document || selectedElementIds.length === 0) return []

	const elementsById = new Map<string, LayerElement>()
	const indexElements = (elements: LayerElement[]) => {
		for (const element of elements) {
			elementsById.set(element.id, element)
			if (isContainerElement(element)) indexElements(getElementChildren(element))
		}
	}
	indexElements(document.elements ?? [])

	const seenResources = new Set<string>()
	const items: MentionItem[] = []
	const hasReachedLimit = () => maxItems != null && items.length >= maxItems

	/** Returns false when the caller should stop walking the selection. */
	const visit = (element: LayerElement): boolean => {
		if (hasReachedLimit()) return false
		if (isContainerElement(element)) {
			for (const child of getSortedElements(getElementChildren(element))) {
				if (!visit(child)) return false
			}
			return true
		}
		if (!isMediaElement(element)) return true

		const source = getMediaSource(element)
		const file = source?.src ? resolveFileBySrc(source.src) : null
		if (!source || !file) return true

		const resourceKey = getProjectFileResourceIdentity(file, source.src)
		if (!resourceKey) return true
		if (seenResources.has(resourceKey)) return true
		seenResources.add(resourceKey)

		const data = createProjectFileMentionData(file)
		items.push({
			id: getCanvasElementMentionItemId(element.id),
			type: MentionItemType.PROJECT_FILE,
			name: getElementDisplayName(element),
			icon: file.file_extension || element.type,
			extension: file.file_extension,
			hasChildren: false,
			isFolder: false,
			path: file.relative_file_path,
			size: file.file_size,
			parentId: file.parent_id == null ? undefined : String(file.parent_id),
			displayConfig: file.display_config,
			data,
			tags: [CANVAS_ELEMENT_TAG],
			unSelectable: file.unSelectable || undefined,
			sourcePreview: {
				kind: "canvas-element",
				designProjectId,
				elementId: element.id,
				mediaType:
					element.type === ElementTypeEnum.Video
						? "video"
						: element.type === ElementTypeEnum.Audio
							? "audio"
							: "image",
				src: source.src,
				...(source.crop ? { crop: source.crop } : {}),
			},
		})
		return !hasReachedLimit()
	}

	for (const elementId of selectedElementIds) {
		const element = elementsById.get(elementId)
		if (element && !visit(element)) break
	}

	return items
}
