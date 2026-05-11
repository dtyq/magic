import { useEffect, useState, useRef } from "react"
import { reaction } from "mobx"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { CanvasMarkerMentionData, MentionItemType } from "@/components/business/MentionPanel/types"
import {
	getCanvasMarkerMentionImagePath,
	normalizeCanvasMarkerMentionData,
} from "@/components/business/MentionPanel/utils/canvasMarkerMention"
import projectFilesStore from "@/stores/projectFiles"
import { getFileInfoByPath } from "@/pages/superMagic/components/Detail/contents/Design/utils/designFileInfoCache"

async function hydrateMarkerImageSize(
	markerData: CanvasMarkerMentionData,
): Promise<CanvasMarkerMentionData | null> {
	const imagePath = getCanvasMarkerMentionImagePath(markerData)
	if (!imagePath) return markerData

	const fileInfo = await getFileInfoByPath(imagePath, undefined, {
		useImageProcess: true,
	})
	if (!fileInfo?.src) {
		return markerData
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

	return {
		...markerData,
		element_width: naturalWidth,
		element_height: naturalHeight,
	}
}

export function useTransformedMarkerData(
	data: TiptapMentionAttributes,
	isInMessageList: boolean,
): { markerData: CanvasMarkerMentionData | null; loading: boolean } {
	const [transformedData, setTransformedData] = useState<CanvasMarkerMentionData | null>(null)
	const [loading, setLoading] = useState(false)
	const cancelledRef = useRef(false)
	const markerDataRef = useRef<CanvasMarkerMentionData | null>(null)

	const performHydrate = (markerData: CanvasMarkerMentionData) => {
		if (!getCanvasMarkerMentionImagePath(markerData)) {
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
		hydrateMarkerImageSize(markerData)
			.then((result) => {
				if (!cancelledRef.current) {
					setTransformedData(result)
				}
			})
			.catch((error) => {
				console.error("[useTransformedMarkerData] Failed to hydrate marker data:", error)
				if (!cancelledRef.current) {
					setTransformedData(markerData)
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

		const markerData = normalizeCanvasMarkerMentionData(data.data)

		if (!markerData) {
			setTransformedData(null)
			setLoading(false)
			markerDataRef.current = null
			return
		}

		// 编辑态和已带尺寸的消息态可直接渲染；旧消息缺尺寸时再异步补图像尺寸，供 tooltip 定位使用。
		if (!isInMessageList || markerData.element_width || markerData.element_height) {
			setTransformedData(markerData)
			setLoading(false)
			markerDataRef.current = null
			return
		}

		markerDataRef.current = markerData
		performHydrate(markerData)

		return () => {
			cancelledRef.current = true
		}
	}, [data, isInMessageList])

	useEffect(() => {
		if (!isInMessageList || !markerDataRef.current) {
			return
		}

		// 历史消息刷新时附件列表可能晚于消息到达，等附件加载后再补一次图片尺寸。
		const disposer = reaction(
			() => projectFilesStore.workspaceFilesList,
			(attachmentList) => {
				if (
					attachmentList &&
					attachmentList.length > 0 &&
					markerDataRef.current &&
					!cancelledRef.current
				) {
					performHydrate(markerDataRef.current)
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
