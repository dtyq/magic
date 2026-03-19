import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { cx } from "antd-style"
import { useConversationMessage } from "@/pages/chatNew/components/ChatMessageList/components/MessageItem/components/ConversationMessageProvider/hooks"
import type { FC, SyntheticEvent } from "react"
import { useCallback, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import ImageWrapper from "@/components/base/MagicImagePreview/components/ImageWrapper"
import type { ElementDimensions } from "../../hooks/use-drag-resize"
import { useStyles } from "./styles"
import MessageEditStore from "@/stores/chatNew/messageUI/Edit"

interface ImageState {
	src: string
	isServerUploading: boolean
	imageLoaded: boolean
	isZoomed: boolean
	error: boolean
	naturalSize: ElementDimensions
}

/**
 * 富文本图片渲染
 * @param node 节点
 * @param selected 是否选中
 * @param updateAttributes 更新属性
 */
export const ImageViewBlock: FC<NodeViewProps> = ({ node, selected, updateAttributes }) => {
	const {
		src: initSrc,
		width: initialWidth,
		height: initialHeight,
		file_name,
		file_id,
		file_extension,
		file_size,
		alt,
		title,
	} = node?.attrs || {}

	const [imageState, setImageState] = useState<ImageState>({
		src: initSrc,
		isServerUploading: false,
		imageLoaded: false,
		isZoomed: false,
		error: false,
		naturalSize: { width: initialWidth, height: initialHeight },
	})

	// 消息ID
	const { messageId } = useConversationMessage()
	// 编辑消息状态下，原始消息的消息 ID，用于渲染
	const { editMessage } = MessageEditStore

	const containerRef = useRef<HTMLDivElement>(null)

	const handleImageLoad = useCallback(
		(ev: SyntheticEvent<HTMLImageElement>) => {
			const img = ev.target as HTMLImageElement
			const newNaturalSize = {
				width: img.naturalWidth,
				height: img.naturalHeight,
			}
			setImageState((prev) => ({
				...prev,
				naturalSize: newNaturalSize,
				imageLoaded: true,
			}))
			updateAttributes({
				width: img.width || newNaturalSize.width,
				height: img.height || newNaturalSize.height,
				alt: img.alt,
				title: img.title,
			})
		},
		[updateAttributes],
	)

	const handleImageError = useMemoizedFn(() => {
		setImageState((prev) => ({ ...prev, error: true, imageLoaded: true }))
	})

	const { styles } = useStyles()

	return (
		<NodeViewWrapper
			ref={containerRef}
			className={styles.wrapper}
			onMouseDown={(e: MouseEvent) => {
				e.preventDefault()
				e.stopPropagation()
				return false
			}}
		>
			<ImageWrapper
				className={cx(styles.image, {
					[styles.hiddenImage]: !imageState.imageLoaded || imageState.error,
					[styles.selected]: selected,
				})}
				fileId={file_id}
				// 编辑消息状态下，原始消息的消息 ID，用于渲染
				messageId={messageId || editMessage?.message_id}
				src={imageState.src}
				onError={handleImageError}
				onLoad={handleImageLoad}
				alt={alt || file_name || ""}
				title={title || ""}
				imgExtension={file_extension}
				fileSize={file_size}
			/>
		</NodeViewWrapper>
	)
}
