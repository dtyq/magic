import { useEffect, useState, useRef } from "react"
import { reaction } from "mobx"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	CanvasMarkerMentionData,
	TransformedCanvasMarkerMentionData,
	MentionItemType,
} from "@/components/business/MentionPanel/types"
import projectFilesStore from "@/stores/projectFiles"
import { getFileInfoByPath } from "@/pages/superMagic/components/Detail/contents/Design/utils/designFileInfoCache"
import {
	MarkerTypeEnum,
	type Marker,
	type MarkerArea,
	type MarkerPoint,
} from "@/components/CanvasDesign/canvas/types"
import type {
	IdentifyImageMarkResponse,
	IdentifyImageMarkAreaResponse,
	IdentifyImageMarkPointResponse,
} from "@/components/CanvasDesign/types.magic"

function normalizePath(path: string) {
	if (!path) return ""
	return path.replace(/^\/+|\/+$/g, "")
}

export function isCanvasMarkerMentionData(
	data: CanvasMarkerMentionData | TransformedCanvasMarkerMentionData,
): data is CanvasMarkerMentionData {
	return "image_path" in data && "data" in data && data.data !== null
}

export function isTransformedCanvasMarkerMentionData(
	data: CanvasMarkerMentionData | TransformedCanvasMarkerMentionData,
): data is TransformedCanvasMarkerMentionData {
	return "image" in data && !("image_path" in data)
}

async function transformMarkerData(
	transformedMarkerData: TransformedCanvasMarkerMentionData,
): Promise<CanvasMarkerMentionData | null> {
	const normalizedPath = normalizePath(transformedMarkerData.image)
	if (!normalizedPath) {
		return null
	}

	const fileInfo = await getFileInfoByPath(transformedMarkerData.image)
	if (!fileInfo?.src) {
		return null
	}

	const img = new Image()
	img.crossOrigin = "anonymous"
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve()
		img.onerror = reject
		img.src = fileInfo.src
	})

	const naturalWidth = img.naturalWidth
	const naturalHeight = img.naturalHeight
	const relativeX = transformedMarkerData.mark?.[0] ?? transformedMarkerData.area?.[0] ?? 0
	const relativeY = transformedMarkerData.mark?.[1] ?? transformedMarkerData.area?.[1] ?? 0

	let markResult: IdentifyImageMarkResponse | undefined
	if (transformedMarkerData.bbox) {
		const baseResult = {
			file_path: transformedMarkerData.image,
			project_id: "",
			suggestion: transformedMarkerData.label,
			suggestions: [
				{
					label: transformedMarkerData.label,
					kind: transformedMarkerData.kind,
					bbox: transformedMarkerData.bbox,
				},
			],
		}

		if (transformedMarkerData.mark_type === MarkerTypeEnum.Area && transformedMarkerData.area) {
			markResult = {
				...baseResult,
				type: MarkerTypeEnum.Area,
				area: transformedMarkerData.area,
			} as IdentifyImageMarkAreaResponse
		} else if (
			transformedMarkerData.mark_type === MarkerTypeEnum.Mark &&
			transformedMarkerData.mark
		) {
			markResult = {
				...baseResult,
				type: MarkerTypeEnum.Mark,
				mark: transformedMarkerData.mark,
			} as IdentifyImageMarkPointResponse
		}
	}

	let markerData: Marker

	if (transformedMarkerData.mark_type === MarkerTypeEnum.Area && transformedMarkerData.area) {
		const [, , pixelWidth, pixelHeight] = transformedMarkerData.area
		const areaMarker: MarkerArea = {
			id: "",
			elementId: "",
			type: MarkerTypeEnum.Area,
			relativeX,
			relativeY,
			areaWidth: pixelWidth / naturalWidth,
			areaHeight: pixelHeight / naturalHeight,
			result: markResult,
			selectedSuggestionIndex: 0,
		}
		markerData = areaMarker
	} else {
		const pointMarker: MarkerPoint = {
			id: "",
			elementId: "",
			type: MarkerTypeEnum.Mark,
			relativeX,
			relativeY,
			result: markResult,
			selectedSuggestionIndex: 0,
		}
		markerData = pointMarker
	}

	return {
		loading: false,
		mark_number: transformedMarkerData.mark_number,
		image_path: transformedMarkerData.image,
		element_width: naturalWidth,
		element_height: naturalHeight,
		data: markerData,
	}
}

export function useTransformedMarkerData(
	data: TiptapMentionAttributes,
	isInMessageList: boolean,
): { markerData: CanvasMarkerMentionData | null; loading: boolean } {
	const [transformedData, setTransformedData] = useState<CanvasMarkerMentionData | null>(null)
	const [loading, setLoading] = useState(false)
	const cancelledRef = useRef(false)
	const markerDataRef = useRef<TransformedCanvasMarkerMentionData | null>(null)

	const performTransform = (markerData: TransformedCanvasMarkerMentionData) => {
		if (!markerData.image) {
			setTransformedData(null)
			setLoading(false)
			return
		}

		if (
			!projectFilesStore.workspaceFilesList ||
			projectFilesStore.workspaceFilesList.length === 0
		) {
			setTransformedData(null)
			setLoading(true)
			return
		}

		setLoading(true)
		transformMarkerData(markerData)
			.then((result) => {
				if (!cancelledRef.current) {
					setTransformedData(result)
				}
			})
			.catch((error) => {
				console.error("[useTransformedMarkerData] Failed to transform marker data:", error)
				if (!cancelledRef.current) {
					setTransformedData(null)
				}
			})
			.finally(() => {
				if (!cancelledRef.current) {
					setLoading(false)
				}
			})
	}

	useEffect(() => {
		cancelledRef.current = false

		if (data.type !== MentionItemType.DESIGN_MARKER) {
			setTransformedData(null)
			setLoading(false)
			markerDataRef.current = null
			return
		}

		const markerData = data.data as CanvasMarkerMentionData | TransformedCanvasMarkerMentionData

		if (!isInMessageList) {
			if (isCanvasMarkerMentionData(markerData)) {
				setTransformedData(markerData)
			} else {
				setTransformedData(null)
			}
			setLoading(false)
			markerDataRef.current = null
			return
		}

		if (isCanvasMarkerMentionData(markerData)) {
			setTransformedData(markerData)
			setLoading(false)
			markerDataRef.current = null
			return
		}

		if (!isTransformedCanvasMarkerMentionData(markerData)) {
			setTransformedData(null)
			setLoading(false)
			markerDataRef.current = null
			return
		}

		markerDataRef.current = markerData
		performTransform(markerData)

		return () => {
			cancelledRef.current = true
		}
	}, [data, isInMessageList])

	useEffect(() => {
		if (!isInMessageList || !markerDataRef.current) {
			return
		}

		const disposer = reaction(
			() => projectFilesStore.workspaceFilesList,
			(attachmentList) => {
				if (
					attachmentList &&
					attachmentList.length > 0 &&
					markerDataRef.current &&
					!cancelledRef.current
				) {
					performTransform(markerDataRef.current)
				}
			},
			{ fireImmediately: false },
		)

		return () => {
			disposer()
		}
	}, [isInMessageList])

	return { markerData: transformedData, loading }
}
