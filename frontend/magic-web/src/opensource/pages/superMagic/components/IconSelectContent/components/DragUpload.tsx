import { Flex } from "antd"
import { IconCircleDotted, IconCloudUpload } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useRef, useState } from "react"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import { genFileData } from "@/opensource/pages/vectorKnowledge/utils"
import { useDragUploadStyles } from "../styles"
import UploadButton from "@/opensource/components/business/UploadButton"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface DragUploadProps {
	bgColor: string
	imagePreviewUrl?: string
	setImagePreviewUrl: (url: string) => void
}

const IMAGE_TYPE = ["image/jpg", "image/png", "image/jpeg"]

const DragUpload = ({ bgColor, imagePreviewUrl, setImagePreviewUrl }: DragUploadProps) => {
	const { t } = useTranslation("super")
	const { styles, cx } = useDragUploadStyles()

	const parentRef = useRef<HTMLDivElement>(null)

	const [loading, setLoading] = useState(false)
	const [dragging, setDragging] = useState(false)

	const { uploadAndGetFileUrl } = useUpload({
		storageType: "public",
	})

	const onDragEnter = (e: React.DragEvent<HTMLElement>) => {
		if (dragging) return

		const target = e.target as HTMLElement
		if (parentRef.current?.contains(target) || parentRef.current === target) {
			setDragging(true)
		}
	}

	const onDragLeave = (e: React.DragEvent<HTMLElement>) => {
		if (!dragging) {
			return
		}

		if (
			parentRef.current === e.target ||
			(e.target as HTMLElement).getAttribute("id") === "drag-file-send-tip-container"
		) {
			setDragging(false)
		}
	}

	const uploadValidator = (file: File, maxSize = 2): Promise<boolean> => {
		return new Promise((resolve) => {
			// 检查文件类型
			const validTypes = IMAGE_TYPE
			if (!validTypes.includes(file.type)) {
				magicToast.error(t("common.onlySupportUploadImage"))
				resolve(false)
				return
			}

			if (file.size / 1024 / 1024 > maxSize) {
				magicToast.error(t("common.imageSizeTooLarge", { size: "2M" }))
				resolve(false)
				return
			}

			const img = new Image()
			const objectUrl = URL.createObjectURL(file)
			img.src = objectUrl

			img.onload = () => {
				URL.revokeObjectURL(objectUrl) // 清理内存
				if (img.width < 28 || img.height < 28) {
					magicToast.error(t("common.imageSizeTooSmall", { width: 28, height: 28 }))
					resolve(false)
				} else {
					resolve(true)
				}
			}

			img.onerror = () => {
				URL.revokeObjectURL(objectUrl) // 清理内存
				magicToast.error(t("common.imageLoadFailed"))
				resolve(false)
			}
		})
	}

	const onDrop = async (e: React.DragEvent<HTMLElement>) => {
		e.preventDefault()
		e.stopPropagation()

		try {
			setLoading(true)
			const files = Array.from(e.dataTransfer?.files ?? []).map(genFileData)
			if (!files.length) {
				setDragging(false)
				return
			}
			const { fullfilled } = await uploadAndGetFileUrl(files, uploadValidator)
			if (fullfilled.length) {
				const { path, url } = fullfilled[0].value
				setImagePreviewUrl(url)
			}
		} catch (error) {
			console.error("🚀 ~ onDrop ~ error:", error)
			magicToast.error(t("file.uploadFail", { ns: "message" }))
		} finally {
			setLoading(false)
			setDragging(false)
		}
	}

	const onFileChange = async (fileList: FileList) => {
		try {
			setLoading(true)
			const newFiles = Array.from(fileList).map(genFileData)
			// 先上传文件
			const { fullfilled } = await uploadAndGetFileUrl(newFiles, uploadValidator)
			if (fullfilled.length) {
				const { path, url } = fullfilled[0].value
				setImagePreviewUrl(url)
			}
		} catch (error) {
			console.error("🚀 ~ onFileChange ~ error:", error)
			magicToast.error(t("file.uploadFail", { ns: "message" }))
		} finally {
			setLoading(false)
			setDragging(false)
		}
	}

	return (
		<div
			ref={parentRef}
			className={cx(styles.uploadWrapper, { [styles.dragEntered]: dragging })}
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
		>
			<div className={styles.previewWrapper}>
				{t("agentEditor.configPanel.preview")}
				<div className={styles.previewImage} style={{ backgroundColor: bgColor }}>
					{loading ? (
						<IconCircleDotted
							size={48}
							color="currentColor"
							className={styles.dragEnteredLoader}
						/>
					) : imagePreviewUrl ? (
						<img src={imagePreviewUrl} className={styles.imagePreview} alt="image" />
					) : null}
				</div>
			</div>
			<Flex vertical align="center" gap={8}>
				<UploadButton
					loading={loading}
					accept="image/*"
					multiple={false}
					onFileChange={onFileChange}
					icon={<IconCloudUpload size={20} />}
					type="primary"
				>
					{t("agentEditor.configPanel.uploadIcon")}
				</UploadButton>
				<span className={styles.desc}>{t("agentEditor.configPanel.uploadImageDesc")}</span>
			</Flex>
		</div>
	)
}

export default DragUpload
