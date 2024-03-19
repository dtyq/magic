import { useState } from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { Upload } from "antd"
import { useTranslation } from "react-i18next"
import type { Editor } from "@tiptap/react"
import { useStyles } from "../styles"
import FlexBox from "@/opensource/components/base/FlexBox"
import { MAX_FILE_SIZE } from "@/opensource/lib/tiptap-utils"

const { Dragger } = Upload

interface UploadTabProps {
	editor: Editor | null
	projectId?: string
	onSuccess?: () => void
}

export function UploadTab({ editor, projectId, onSuccess }: UploadTabProps) {
	const { t } = useTranslation("tiptap")
	const { styles } = useStyles()
	const [uploading, setUploading] = useState(false)
	const [isDragging, setIsDragging] = useState(false)

	const handleUpload = async (file: File) => {
		if (!editor) {
			magicToast.error(t("projectImage.errors.uploadFailed"))
			return false
		}

		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024)
			magicToast.error(t("projectImage.errors.fileTooLarge", { maxSize: maxSizeMB }))
			return false
		}

		// Validate file type
		const validTypes = [
			"image/jpeg",
			"image/jpg",
			"image/png",
			"image/gif",
			"image/webp",
			"image/svg+xml",
			"image/bmp",
			"image/x-icon",
		]
		if (!validTypes.includes(file.type)) {
			magicToast.error(t("projectImage.errors.invalidFile"))
			return false
		}

		setUploading(true)

		try {
			// Use the insertProjectImageFromFile command if available
			if (projectId && editor.commands.insertProjectImageFromFile) {
				editor.commands.insertProjectImageFromFile(file)
				magicToast.success(t("projectImage.upload.success"))
				onSuccess?.()
			}
			// Use the insertStorageImageFromFile command if available
			else if (!projectId && editor.commands.insertStorageImageFromFile) {
				editor.commands.insertStorageImageFromFile(file)
				onSuccess?.()
			}
		} catch (error) {
			console.error("Upload failed:", error)
			magicToast.error(t("projectImage.errors.uploadFailed"))
		} finally {
			setUploading(false)
		}
	}

	return (
		<FlexBox vertical gap={10} justify="center" align="center" className={styles.tabContent}>
			<Dragger
				accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/x-icon"
				multiple={false}
				showUploadList={false}
				beforeUpload={handleUpload}
				disabled={uploading}
				className={styles.uploadArea}
				onDrop={() => setIsDragging(false)}
			>
				<div
					className={styles.uploadTitle}
					onDragEnter={() => setIsDragging(true)}
					onDragLeave={() => setIsDragging(false)}
				>
					{isDragging
						? t("projectImage.dropdown.upload.dropFile")
						: t("projectImage.dropdown.upload.selectFile")}
				</div>
			</Dragger>
			<div className={styles.hint}>{t("projectImage.dropdown.upload.hint")}</div>
		</FlexBox>
	)
}
