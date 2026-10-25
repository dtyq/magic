import { GenerationStatus, ImageGenerationTaskTypeMap } from "../../public/magic-types"
import type { GenerateHightImageRequest, ImageGenerationTaskMeta } from "../../public/magic-types"
import { ElementTypeEnum } from "./types"
import type {
	ContentElementProps,
	ElementContentBase,
	ImageElement,
	ImageElementContent,
	LayerElement,
	VideoElement,
	VideoElementContent,
} from "./types"

export type ContentElement = ContentElementProps<ElementContentBase>

export type ElementContentOf<TElement extends ContentElement> =
	TElement extends ContentElementProps<infer TContent> ? TContent : never

export type ElementContentPatch<TElement extends ContentElement> =
	ElementContentOf<TElement> extends infer TContent
		? TContent extends ElementContentBase
			? Partial<Omit<TContent, "contentId">>
			: never
		: never

function getTypedContents<TElement extends ContentElement>(
	element: TElement,
): Array<ElementContentOf<TElement>> {
	return element.contents as Array<ElementContentOf<TElement>>
}

function getTypedContentById<TElement extends ContentElement>(
	element: TElement,
	contentId?: string | null,
): ElementContentOf<TElement> | undefined {
	if (!contentId) return undefined
	return getTypedContents(element).find((content) => content.contentId === contentId)
}

export type ImageContentFields = Omit<ImageElementContent, "contentId">

const CONTENT_FIELDS_BY_TYPE: Partial<Record<string, readonly string[]>> = {
	[ElementTypeEnum.Frame]: [],
	[ElementTypeEnum.Group]: [],
	[ElementTypeEnum.Image]: [
		"discarded",
		"generationTiming",
		"visualUnderstanding",
		"src",
		"assetId",
		"complianceStatus",
		"complianceFailedReason",
		"complianceCheckId",
		"status",
		"errorMessage",
		"generateImageRequest",
		"imageGenerationTaskMeta",
		"crop",
	],
	[ElementTypeEnum.Video]: [
		"visualUnderstanding",
		"src",
		"assetId",
		"complianceStatus",
		"complianceFailedReason",
		"complianceCheckId",
		"status",
		"errorMessage",
		"generateVideoRequest",
		"videoEditorDraft",
		"videoGenerationResultMeta",
	],
	[ElementTypeEnum.Audio]: ["src", "assetId"],
	[ElementTypeEnum.Text]: ["content", "defaultStyle"],
	[ElementTypeEnum.Rectangle]: ["fill", "stroke", "strokeWidth", "cornerRadius"],
	[ElementTypeEnum.Ellipse]: ["fill", "stroke", "strokeWidth"],
	[ElementTypeEnum.Triangle]: ["fill", "stroke", "strokeWidth"],
	[ElementTypeEnum.Star]: [
		"fill",
		"stroke",
		"strokeWidth",
		"cornerRadius",
		"sides",
		"innerRadiusRatio",
	],
	[ElementTypeEnum.Storyboard]: ["generationConfig", "shots"],
	[ElementTypeEnum.VideoEdit]: ["videoSequence", "audioSequence"],
}

export function getElementContentFields(type: string): readonly string[] {
	return CONTENT_FIELDS_BY_TYPE[type] ?? []
}

/** 视觉理解结果仅属于后端支持的图片、视频 Content。 */
export function supportsVisualUnderstanding(type: string): boolean {
	return type === ElementTypeEnum.Image || type === ElementTypeEnum.Video
}

/** 所有新建 Content 使用统一的 content-<uuid> 命名，类型语义由元素和字段结构表达。 */
export function createContentId(): string {
	return `content-${generateContentUuid()}`
}

function generateContentUuid(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
		const random = (Math.random() * 16) | 0
		const value = character === "x" ? random : (random & 0x3) | 0x8
		return value.toString(16)
	})
}

export function getContents<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
): TContent[] {
	return Array.isArray(element.contents) ? element.contents : []
}

export function getContentById<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
	contentId?: string | null,
): TContent | undefined {
	if (!contentId) return undefined
	return getContents(element).find((content) => content.contentId === contentId)
}

export function getActiveContent<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
): TContent | undefined {
	return getContentById(element, element.activeContentId) ?? getContents(element)[0]
}

export function getMainContent<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
): TContent | undefined {
	return getContentById(element, element.mainContentId) ?? getContents(element)[0]
}

/**
 * 返回 Element 提供给 Connection 和下游业务消费的 Content。
 *
 * active Content 只表示当前画布展示和编辑目标；所有关联输入必须通过该语义入口读取 main。
 */
export function getDownstreamContent<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
): TContent | undefined {
	return getMainContent(element)
}

export function isImageContentUsableDownstream(
	content: ImageElementContent | undefined,
): content is ImageElementContent {
	// src is the durable resource signal used by downstream consumers. status can
	// be missing or stale after persistence/recovery and must not hide a usable image.
	return Boolean(content?.src)
}

export function getUsableDownstreamImageContent(
	element: ImageElement,
): ImageElementContent | undefined {
	const content = getDownstreamContent<ImageElementContent>(element)
	return isImageContentUsableDownstream(content) ? content : undefined
}

export function getActiveContentId<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
): string | undefined {
	return getActiveContent(element)?.contentId
}

export function getMainContentId<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
): string | undefined {
	return getMainContent(element)?.contentId
}

export interface ContentGenerationState<TContent extends ElementContentBase> {
	activeContent: TContent | undefined
	activeContentIsGenerating: boolean
	hasSiblingGenerating: boolean
	hasAnyGenerating: boolean
}

export type ContentState = "empty" | "pending" | "processing" | "completed" | "failed"

/** 统一把持久化字段和运行态字段投影为工具层可消费的 Content 状态。 */
export function getContentState(content: ElementContentBase | undefined): ContentState {
	if (!content) return "empty"
	const candidate = content as ElementContentBase & {
		status?: GenerationStatus
		src?: string
	}
	if (candidate.status === GenerationStatus.Pending) return "pending"
	if (candidate.status === GenerationStatus.Processing) return "processing"
	if (
		candidate.status === GenerationStatus.Failed ||
		candidate.status === GenerationStatus.Terminated
	)
		return "failed"
	if (candidate.status === GenerationStatus.Completed || candidate.src) return "completed"
	return isContentGenerationPending(content) ? "pending" : "empty"
}

export function getContentStateMap<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
): ReadonlyMap<string, ContentState> {
	return new Map(
		getContents(element).map((content) => [content.contentId, getContentState(content)]),
	)
}

/** 统一派生当前版本与其他版本的生成状态，避免 UI 各自做元素级判断。 */
export function getContentGenerationState<TContent extends ElementContentBase>(
	element: ContentElementProps<TContent>,
): ContentGenerationState<TContent> {
	const activeContent = getActiveContent(element)
	const activeContentIsGenerating = Boolean(
		activeContent && isContentGenerationPending(activeContent),
	)
	const hasSiblingGenerating = getContents(element).some(
		(content) =>
			content.contentId !== activeContent?.contentId && isContentGenerationPending(content),
	)

	return {
		activeContent,
		activeContentIsGenerating,
		hasSiblingGenerating,
		hasAnyGenerating: activeContentIsGenerating || hasSiblingGenerating,
	}
}

/** 生成中的状态属于单个 Content；元素级操作需要读取整个版本集合。 */
export function isContentGenerationPending(content: ElementContentBase): boolean {
	const candidate = content as {
		status?: GenerationStatus
		src?: string
		generateImageRequest?: { image_id?: string }
		imageGenerationTaskMeta?: { image_id?: string }
		generateVideoRequest?: { video_id?: string }
	}
	if (
		candidate.status === GenerationStatus.Pending ||
		candidate.status === GenerationStatus.Processing
	) {
		return true
	}
	if (
		candidate.src ||
		candidate.status === GenerationStatus.Completed ||
		candidate.status === GenerationStatus.Failed ||
		candidate.status === GenerationStatus.Terminated
	) {
		return false
	}
	return Boolean(
		candidate.generateImageRequest?.image_id ||
		candidate.imageGenerationTaskMeta?.image_id ||
		candidate.generateVideoRequest?.video_id,
	)
}

/** 删除版本前只保证不会删除唯一 Content，兄弟版本状态不影响当前版本删除。 */
export function canDeleteActiveContentVersion(element: ContentElement): boolean {
	const contents = getContents(element)
	const activeContent = getActiveContent(element)
	return contents.length > 1 && Boolean(activeContent)
}

export function updateContent<TElement extends ContentElement>(
	element: TElement,
	contentId: string | undefined,
	patch: ElementContentPatch<TElement>,
): TElement {
	const contents = getTypedContents(element)
	const targetId = contentId ?? element.activeContentId ?? contents[0]?.contentId
	if (!targetId) return element

	let found = false
	const nextContents = contents.map((content) => {
		if (content.contentId !== targetId) return content
		found = true
		return {
			...content,
			...(patch as Record<string, unknown>),
			contentId: content.contentId,
		} as ElementContentOf<TElement>
	})
	return found ? materializeElement(element, nextContents) : element
}

export function appendContent<TElement extends ContentElement>(
	element: TElement,
	content: ElementContentOf<TElement>,
): TElement {
	const contents = getTypedContents(element)
	const normalizedContent = {
		...content,
		contentId: content.contentId || createContentId(),
	}
	if (contents.some((item) => item.contentId === normalizedContent.contentId)) {
		throw new Error(`Duplicate content ${content.contentId}`)
	}

	const nextContents = [...contents, normalizedContent]
	return {
		...element,
		contents: nextContents,
		activeContentId: element.activeContentId ?? normalizedContent.contentId,
		mainContentId: element.mainContentId ?? normalizedContent.contentId,
	}
}

export function switchActiveContent<TElement extends ContentElement>(
	element: TElement,
	contentId: string,
): TElement {
	if (!getTypedContentById(element, contentId) || element.activeContentId === contentId) {
		return element
	}
	return materializeElement(element, getTypedContents(element), { activeContentId: contentId })
}

export function setMainContent<TElement extends ContentElement>(
	element: TElement,
	contentId: string,
	canSetMain: (content: ElementContentOf<TElement>) => boolean = () => true,
): TElement {
	const content = getTypedContentById(element, contentId)
	if (!content || !canSetMain(content) || element.mainContentId === contentId) return element
	return materializeElement(element, getTypedContents(element), { mainContentId: contentId })
}

export interface DeleteActiveContentResult<TElement extends ContentElement> {
	element: TElement
	deletedContent: ElementContentOf<TElement>
}

export function deleteActiveContent<TElement extends ContentElement>(
	element: TElement,
	isMainEligible: (content: ElementContentOf<TElement>) => boolean = () => true,
): DeleteActiveContentResult<TElement> | null {
	const contents = getTypedContents(element)
	if (contents.length <= 1) return null
	const activeId = element.activeContentId
	const deletedIndex = contents.findIndex((content) => content.contentId === activeId)
	if (deletedIndex < 0) return null

	const deletedContent = contents[deletedIndex]
	const nextContents = contents.filter((content) => content.contentId !== activeId)
	const nextActive = nextContents[Math.max(0, deletedIndex - 1)] ?? nextContents[0]
	let mainContentId = element.mainContentId
	if (
		mainContentId === activeId ||
		!nextContents.some((content) => content.contentId === mainContentId)
	) {
		mainContentId =
			findNearestEligibleContentId(nextContents, deletedIndex, isMainEligible) ??
			nextActive.contentId
	}

	return {
		deletedContent,
		element: materializeElement(element, nextContents, {
			activeContentId: nextActive.contentId,
			mainContentId,
		}),
	}
}

export function mapContents<TElement extends ContentElement>(
	element: TElement,
	map: (content: ElementContentOf<TElement>) => ElementContentOf<TElement>,
): TElement {
	return materializeElement(element, getTypedContents(element).map(map))
}

export function isContentElement(value: unknown): value is ContentElement {
	if (!value || typeof value !== "object") return false
	const element = value as Partial<ContentElement>
	return (
		Array.isArray(element.contents) &&
		"activeContentId" in element &&
		"mainContentId" in element
	)
}

export function isImageElementContent(value: unknown): value is ImageElement {
	if (!value || typeof value !== "object") return false
	const element = value as Partial<ImageElement>
	return element.type === ElementTypeEnum.Image && Array.isArray(element.contents)
}

export function getElementContents(element: LayerElement): ElementContentBase[] {
	return isContentElement(element) ? element.contents : []
}

function findNearestEligibleContentId<TContent extends ElementContentBase>(
	contents: TContent[],
	deletedIndex: number,
	isEligible: (content: TContent) => boolean,
): string | undefined {
	for (let distance = 1; distance <= contents.length; distance += 1) {
		const previous = contents[deletedIndex - distance]
		if (previous && isEligible(previous)) return previous.contentId
		const next = contents[deletedIndex - 1 + distance]
		if (next && isEligible(next)) return next.contentId
	}
	return undefined
}

function materializeElement<TElement extends ContentElement>(
	element: TElement,
	contents: Array<ElementContentOf<TElement>>,
	patch?: Partial<Pick<ContentElement, "activeContentId" | "mainContentId">>,
): TElement {
	return {
		...(element as TElement),
		contents,
		activeContentId:
			patch?.activeContentId ?? element.activeContentId ?? contents[0]?.contentId ?? null,
		mainContentId:
			patch?.mainContentId ?? element.mainContentId ?? contents[0]?.contentId ?? null,
	}
}

export function getImageContents(element: ImageElement): ImageElementContent[] {
	return getContents(element)
}

export function getActiveImageContent(element: ImageElement): ImageElementContent {
	return getActiveContent(element) ?? { contentId: `${element.id}-content-1` }
}

export function getMainImageContent(element: ImageElement): ImageElementContent {
	return getMainContent(element) ?? { contentId: `${element.id}-content-1` }
}

export function getImageContentById(
	element: ImageElement,
	contentId?: string | null,
): ImageElementContent | undefined {
	return getContentById(element, contentId ?? element.activeContentId)
}

export function getActiveImageContentId(element: ImageElement): string | undefined {
	return getActiveContentId(element)
}

export function hasProcessingImageContent(element: ImageElement): boolean {
	return getImageContents(element).some((content) => content.status === "processing")
}

/** 未完成视频任务可能不是 active（用户可切回旧版本），轮询与提交互斥必须遍历 Contents。 */
export function getPendingVideoGenerationContent(
	element: VideoElement,
): VideoElementContent | undefined {
	return getContents(element).find(
		(content) =>
			Boolean(content.generateVideoRequest?.video_id) &&
			!content.src &&
			content.status !== "completed" &&
			content.status !== "failed",
	)
}

export function hasPendingVideoGenerationContent(element: VideoElement): boolean {
	return Boolean(getPendingVideoGenerationContent(element))
}

export function appendImageContent(
	element: ImageElement,
	content: ImageElementContent,
): ImageElement {
	return appendContent(element, content)
}

export function updateImageContent(
	element: ImageElement,
	contentId: string | undefined,
	patch: Partial<ImageContentFields>,
): ImageElement {
	return updateContent(element, contentId, patch)
}

export function switchActiveImageContent(element: ImageElement, contentId: string): ImageElement {
	return switchActiveContent(element, contentId)
}

export function setMainImageContent(element: ImageElement, contentId: string): ImageElement {
	return setMainContent<ImageElement>(
		element,
		contentId,
		(content) => Boolean(content.src) && content.status === "completed",
	)
}

export interface DeleteImageContentResult {
	element: ImageElement
	deletedContent: ImageElementContent
}

export function deleteActiveImageContent(element: ImageElement): DeleteImageContentResult | null {
	if (!canDeleteActiveContentVersion(element)) return null
	return deleteActiveContent<ImageElement>(
		element,
		(content) => Boolean(content.src) && content.status === "completed",
	)
}

/** 替换图片或视频资源时清掉元素自有合规记录，避免旧检查结果跟到新文件上。 */
export const CLEARED_MEDIA_COMPLIANCE_PATCH = {
	complianceStatus: undefined,
	complianceFailedReason: undefined,
	complianceCheckId: undefined,
} as const

export function replaceImageContentFields(
	element: ImageElement,
	fields: ImageContentFields,
): ImageElement {
	const cleared: Partial<ImageContentFields> = {
		src: undefined,
		assetId: undefined,
		...CLEARED_MEDIA_COMPLIANCE_PATCH,
		status: undefined,
		errorMessage: undefined,
		generateImageRequest: undefined,
		imageGenerationTaskMeta: undefined,
		crop: undefined,
	}
	return updateImageContent(element, getActiveImageContentId(element), {
		...cleared,
		...fields,
	})
}

export function normalizeLegacyHighImageTaskMeta(
	request?: GenerateHightImageRequest,
): ImageGenerationTaskMeta | undefined {
	if (!request) return undefined
	return {
		type: ImageGenerationTaskTypeMap.High,
		image_id: request.image_id,
		file_path: request.file_path,
		size: request.size,
		reference_image_options: request.reference_image_options,
	}
}
