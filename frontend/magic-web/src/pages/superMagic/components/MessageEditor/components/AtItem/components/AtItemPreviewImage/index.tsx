import { useFileUrl } from "@/pages/superMagic/hooks/useFileUrl"
import { memo } from "react"
import { createStyles } from "antd-style"
import useObjectUrl from "../../hooks/useObjectURL"
import { useIsMobile } from "@/hooks/useIsMobile"
import { showMobileImagePreview } from "../MobileImagePreview"

interface AtItemPreviewImageProps {
	fileId: string
	fileName: string
	size?: number
	fallback?: React.ReactNode
}

const useStyles = createStyles(({ css }) => ({
	atItemPreviewImage: css`
		width: 100%;
		height: 100%;
		max-width: 240px;
		max-height: 240px;
		object-fit: cover;
		border-radius: 4px;
		cursor: pointer;
	`,
}))

function ImageInProjectFileComp({
	fileId,
	fileName,
	size,
	fallback = null,
}: AtItemPreviewImageProps) {
	const { fileUrl } = useFileUrl({ file_id: fileId })
	const { styles } = useStyles()
	const isMobile = useIsMobile()

	const handleClick = () => {
		if (isMobile && fileUrl) {
			// showMobileImagePreview({
			// 	src: fileUrl,
			// 	alt: fileName,
			// })
		}
	}

	if (!fileUrl) return fallback

	return (
		<img
			className={styles.atItemPreviewImage}
			src={fileUrl}
			alt={fileName}
			style={size ? { width: size, height: size } : {}}
			onClick={handleClick}
		/>
	)
}

interface ImageInUploadFileProps {
	file: File
	fileName: string
	size?: number
	fallback?: React.ReactNode
}

function ImageInUploadFileComp({ file, fileName, size, fallback = null }: ImageInUploadFileProps) {
	const { styles } = useStyles()
	const fileUrl = useObjectUrl(file)
	const isMobile = useIsMobile()

	const handleClick = () => {
		if (isMobile && fileUrl) {
			showMobileImagePreview({
				src: fileUrl,
				alt: fileName,
			})
		}
	}

	if (!file || !fileUrl) return fallback

	return (
		<img
			className={styles.atItemPreviewImage}
			src={fileUrl}
			alt={fileName}
			style={size ? { width: size, height: size } : {}}
			onClick={handleClick}
		/>
	)
}

export const ImageInProjectFile = memo(ImageInProjectFileComp)
export const ImageInUploadFile = memo(ImageInUploadFileComp)
