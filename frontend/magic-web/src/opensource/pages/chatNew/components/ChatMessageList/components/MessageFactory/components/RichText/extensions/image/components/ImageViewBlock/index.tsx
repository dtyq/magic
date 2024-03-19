import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { cx } from "antd-style"
import type { FC, SyntheticEvent } from "react"
import { useCallback, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import ImageWrapper from "@/opensource/components/base/MagicImagePreview/components/ImageWrapper"
import type { ElementDimensions } from "../../hooks/use-drag-resize"
import { useStyles } from "./styles"

interface ImageState {
	src: string
	isServerUploading: boolean
	imageLoaded: boolean
	isZoomed: boolean
	error: boolean
	naturalSize: ElementDimensions
}

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

	// useEffect(() => {
	//   const handleImage = async () => {

	//     console.log()

	// 		// 已经上传过了
	// 		if (uploadAttemptedRef.current) return

	// 		const imageExtension = editor.options.extensions.find((ext) => ext.name === Image.name)
	// 		const { uploadFn } = imageExtension?.options ?? {}

	// 		// 没有上传函数, 转化为 base64
	// 		if (!uploadFn) {
	// 			try {
	// 				const base64 = file_extension?.startsWith("svg")
	// 					? initSrc
	// 					: await blobUrlToBase64(initSrc)
	// 				setImageState((prev) => ({ ...prev, src: base64 }))
	// 				updateAttributes({ src: base64 })
	// 				uploadAttemptedRef.current = true
	// 			} catch {
	// 				setImageState((prev) => ({ ...prev, error: true }))
	// 			}
	// 			return
	// 		}

	// 		// 有上传函数
	// 		try {
	// 			setImageState((prev) => ({ ...prev, isServerUploading: true }))
	// 			const response = await fetch(initSrc)
	// 			const blob = await response.blob()
	// 			const file = new File([blob], file_name, { type: blob.type })
	// 			const res = await uploadFn(file, editor)
	// 			setImageState((prev) => ({ ...prev, isServerUploading: false }))
	// 			updateAttributes({ ...res, src: "" })
	// 			uploadAttemptedRef.current = true
	// 		} catch (error) {
	// 			setImageState((prev) => ({
	// 				...prev,
	// 				error: true,
	// 				isServerUploading: false,
	// 			}))
	// 		}
	// 	}

	// 	if (!messageId && !file_id && initSrc) handleImage()
	// 	// eslint-disable-next-line
	// }, [file_id, messageId])

	return (
		<NodeViewWrapper ref={containerRef} className={styles.wrapper}>
			<ImageWrapper
				className={cx(styles.image, {
					[styles.hiddenImage]: !imageState.imageLoaded || imageState.error,
					[styles.selected]: selected,
				})}
				fileId={file_id}
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
