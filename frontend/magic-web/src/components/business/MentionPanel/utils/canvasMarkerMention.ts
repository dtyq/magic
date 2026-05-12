import {
	MarkerTypeEnum,
	type Marker,
	type MarkerArea,
	type MarkerPoint,
} from "@/components/CanvasDesign/canvas/types"
import type {
	IdentifyImageMarkAreaResponse,
	IdentifyImageMarkPointResponse,
	IdentifyImageMarkResponse,
	IdentifyImageMarkResponseBase,
} from "@/components/CanvasDesign/types.magic"
import type {
	CanvasMarkerMentionData,
	CanvasMarkerMentionSuggestion,
} from "@/components/business/MentionPanel/types"

interface LegacyCanvasMarkerMentionData {
	loading?: boolean
	project_id?: string
	topic_id?: string
	design_project_id?: string
	mark_number?: number
	image_path?: string
	image_relative_path?: string
	element_width?: number
	element_height?: number
	data: Marker
}

interface CreateCanvasMarkerMentionDataOptions {
	marker: Marker
	designProjectId: string
	markNumber?: number
	projectId?: string
	topicId?: string
	loading?: boolean
	imagePath?: string
	imageRelativePath?: string
	elementWidth?: number
	elementHeight?: number
}

export function isLegacyCanvasMarkerMentionData(
	data: unknown,
): data is LegacyCanvasMarkerMentionData {
	if (!data || typeof data !== "object") return false

	const markerData = data as Record<string, unknown>
	return Boolean(markerData.data && typeof markerData.data === "object")
}

export function isCanvasMarkerMentionData(data: unknown): data is CanvasMarkerMentionData {
	if (!data || typeof data !== "object") return false

	const markerData = data as Record<string, unknown>
	return "image" in markerData && "label" in markerData
}

export function normalizeCanvasMarkerMentionData(data: unknown): CanvasMarkerMentionData | null {
	if (isCanvasMarkerMentionData(data)) return data
	if (!isLegacyCanvasMarkerMentionData(data)) return null

	// 兼容历史 TipTap content：旧数据把完整 Marker 放在 data 字段里，新链路统一转成轻量 CanvasMarkerMentionData。
	const marker = data.data
	return createCanvasMarkerMentionData({
		marker,
		designProjectId: data.design_project_id ?? "",
		markNumber: data.mark_number,
		projectId: data.project_id,
		topicId: data.topic_id,
		loading: data.loading,
		imagePath: data.image_path,
		imageRelativePath: data.image_relative_path,
		elementWidth: data.element_width,
		elementHeight: data.element_height,
	})
}

export function createCanvasMarkerMentionData({
	marker,
	designProjectId,
	markNumber,
	projectId,
	topicId,
	loading,
	imagePath,
	imageRelativePath,
	elementWidth,
	elementHeight,
}: CreateCanvasMarkerMentionDataOptions): CanvasMarkerMentionData {
	const selectedSuggestionIndex = marker.selectedSuggestionIndex ?? 0
	const suggestions = marker.result?.suggestions
	const selectedSuggestion = suggestions?.[selectedSuggestionIndex]
	const fallbackSuggestion = suggestions?.[0]
	const suggestion = selectedSuggestion ?? fallbackSuggestion
	const image =
		imagePath ?? imageRelativePath ?? marker.result?.file_path ?? marker.filePath ?? ""
	const markType = marker.type

	// 这里是 Manager/旧 content 进入消息模型的唯一出口，后续渲染和发送都只依赖轻量字段。
	return {
		image,
		image_relative: imageRelativePath ?? imagePath,
		design_project_id: designProjectId,
		label: suggestion?.label ?? marker.result?.suggestion ?? "Marker",
		kind: suggestion?.kind ?? "object",
		bbox: suggestion?.bbox,
		mark_type: markType,
		area: getCanvasMarkerMentionArea(marker, elementWidth, elementHeight),
		mark: markType === MarkerTypeEnum.Mark ? [marker.relativeX, marker.relativeY] : undefined,
		mark_number: markNumber,
		marker_id: marker.id,
		element_id: marker.elementId,
		loading,
		project_id: projectId,
		topic_id: topicId,
		element_width: elementWidth,
		element_height: elementHeight,
		suggestions,
		selected_suggestion_index: marker.selectedSuggestionIndex,
		error: marker.error,
	}
}

export function buildMarkerFromCanvasMarkerMentionData(
	data: CanvasMarkerMentionData,
): Marker | null {
	if (!data.marker_id || !data.element_id) return null

	// 草稿恢复、复制粘贴等场景需要从轻量 mention 反推 Manager 可识别的 Marker。
	const result = buildIdentifyResult(data)
	const relativeX = data.mark?.[0] ?? data.area?.[0] ?? 0
	const relativeY = data.mark?.[1] ?? data.area?.[1] ?? 0
	const common = {
		id: data.marker_id,
		elementId: data.element_id,
		relativeX,
		relativeY,
		result,
		selectedSuggestionIndex: data.selected_suggestion_index,
		error: data.error,
	}

	if (data.mark_type === MarkerTypeEnum.Area) {
		const [, , areaWidth = 0, areaHeight = 0] = data.area ?? []
		const markerArea: MarkerArea = {
			...common,
			type: MarkerTypeEnum.Area,
			areaWidth: data.element_width && areaWidth ? areaWidth / data.element_width : areaWidth,
			areaHeight:
				data.element_height && areaHeight ? areaHeight / data.element_height : areaHeight,
		}
		return markerArea
	}

	const markerPoint: MarkerPoint = {
		...common,
		type: MarkerTypeEnum.Mark,
	}
	return markerPoint
}

export function getCanvasMarkerMentionId(data: unknown): string | undefined {
	const markerData = normalizeCanvasMarkerMentionData(data)
	return markerData?.marker_id
}

export function getCanvasMarkerMentionElementId(data: unknown): string | undefined {
	const markerData = normalizeCanvasMarkerMentionData(data)
	return markerData?.element_id
}

export function getCanvasMarkerMentionImagePath(data: CanvasMarkerMentionData): string {
	return data.image_relative ?? data.image
}

export function getCanvasMarkerMentionSuggestions(
	data: CanvasMarkerMentionData,
): CanvasMarkerMentionSuggestion[] {
	if (data.suggestions?.length) return data.suggestions
	return [
		{
			label: data.label,
			kind: data.kind,
			bbox: data.bbox,
		},
	]
}

export function getSelectedCanvasMarkerMentionSuggestion(
	data: CanvasMarkerMentionData,
): CanvasMarkerMentionSuggestion | undefined {
	const suggestions = getCanvasMarkerMentionSuggestions(data)
	return suggestions[data.selected_suggestion_index ?? 0] ?? suggestions[0]
}

export function mergeCanvasMarkerMentionRecognitionData({
	data,
	result,
	suggestions,
	selectedSuggestionIndex,
	error,
	loading,
}: {
	data: CanvasMarkerMentionData
	result?: IdentifyImageMarkResponse
	suggestions?: IdentifyImageMarkResponseBase["suggestions"]
	selectedSuggestionIndex?: number
	error?: string
	loading?: boolean
}): CanvasMarkerMentionData {
	const nextSuggestions = result?.suggestions ?? suggestions ?? data.suggestions
	const nextSelectedIndex = selectedSuggestionIndex ?? data.selected_suggestion_index
	const selectedSuggestion = nextSuggestions?.[nextSelectedIndex ?? 0] ?? nextSuggestions?.[0]

	return {
		...data,
		loading: loading ?? (error !== undefined || result !== undefined ? false : data.loading),
		label: selectedSuggestion?.label ?? result?.suggestion ?? data.label,
		kind: selectedSuggestion?.kind ?? data.kind,
		bbox: selectedSuggestion?.bbox ?? data.bbox,
		mark_type: result?.type ?? data.mark_type,
		mark:
			"mark" in (result ?? {}) ? (result as IdentifyImageMarkPointResponse).mark : data.mark,
		area: "area" in (result ?? {}) ? (result as IdentifyImageMarkAreaResponse).area : data.area,
		suggestions: nextSuggestions,
		selected_suggestion_index: nextSelectedIndex,
		error: error !== undefined ? error : data.error,
	}
}

function getCanvasMarkerMentionArea(
	marker: Marker,
	elementWidth?: number,
	elementHeight?: number,
): [number, number, number, number] | undefined {
	if (marker.type !== MarkerTypeEnum.Area) return undefined
	const width = elementWidth ? marker.areaWidth * elementWidth : marker.areaWidth
	const height = elementHeight ? marker.areaHeight * elementHeight : marker.areaHeight
	return [marker.relativeX, marker.relativeY, width, height]
}

function buildIdentifyResult(data: CanvasMarkerMentionData): IdentifyImageMarkResponse | undefined {
	const suggestions = getCanvasMarkerMentionSuggestions(data)
	const base = {
		file_path: data.image,
		project_id: data.project_id ?? "",
		suggestion: data.label,
		suggestions,
	}

	if (data.mark_type === MarkerTypeEnum.Area && data.area) {
		return {
			...base,
			type: MarkerTypeEnum.Area,
			area: data.area,
		}
	}

	if (data.mark) {
		return {
			...base,
			type: MarkerTypeEnum.Mark,
			mark: data.mark,
		}
	}

	return undefined
}
