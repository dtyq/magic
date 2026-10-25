import { useState, useEffect, useRef, type ImgHTMLAttributes } from "react"
import ImageWrapper from "@/components/base/MagicImagePreview/components/ImageWrapper"
import { ImagePrefix } from "./constants"
import { KnowledgeFileService, type KnowledgeFileCacheData } from "@/services/file/KnowledgeFile"
import { useMemoizedFn } from "ahooks"

interface ImgProps extends ImgHTMLAttributes<HTMLImageElement> {
	src?: string
	alt?: string
}

/**
 * 自定义 Img 组件，支持处理 magic_knowledge_base_file_ 格式的图片
 */
function Img(props: ImgProps) {
	const { src, alt, ...restProps } = props
	const [realSrc, setRealSrc] = useState<string>(src || "")
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)
	const refreshAttemptRef = useRef(false)

	const loadImage = useMemoizedFn((src?: string) => {
		if (!src || typeof src !== "string") return

		// 检查是否是 magic_knowledge_base_file_ 格式
		if (src.startsWith(ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE)) {
			// 提取 file_key (去掉前缀)
			const fileKey = src.replace(ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE, "")

			if (fileKey) {
				setLoading(true)
				setError(false)

				// 使用 KnowledgeFileService 获取文件链接
				KnowledgeFileService.fetchFileUrl(fileKey)
					.then((fileInfo) => {
						if (fileInfo?.url) {
							setRealSrc(fileInfo.url)
							setError(false)
						} else {
							console.error("获取知识库文件链接失败：", fileInfo)
							setError(true)
						}
					})
					.catch((err) => {
						console.error("获取知识库文件链接出错：", err)
						setError(true)
					})
					.finally(() => {
						setLoading(false)
					})
			} else {
				setError(true)
			}
		} else {
			// 普通图片链接，直接使用
			setRealSrc(src)
		}
	})

	useEffect(() => {
		refreshAttemptRef.current = false
		loadImage(src)
	}, [src, loadImage])

	const handleImageError = useMemoizedFn(async () => {
		if (!src?.startsWith(ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE)) {
			setError(true)
			return
		}
		if (refreshAttemptRef.current) {
			setError(true)
			return
		}
		refreshAttemptRef.current = true
		const fileKey = src.replace(ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE, "")
		let fileInfo: KnowledgeFileCacheData | null
		try {
			fileInfo = await KnowledgeFileService.fetchFileUrl(fileKey, { forceRefresh: true })
		} catch {
			setError(true)
			return
		}
		if (fileInfo?.url) {
			setRealSrc(fileInfo.url)
			setError(false)
		} else {
			setError(true)
		}
	})

	return (
		<ImageWrapper
			{...restProps}
			isLoading={loading}
			isError={error}
			src={realSrc}
			alt={alt || "图片"}
			standalone={true}
			onError={handleImageError}
		/>
	)
}

export default Img
