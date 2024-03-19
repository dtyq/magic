import { useTranslation } from "react-i18next"
import { IconPencil, IconTrash } from "@tabler/icons-react"
import { useEffect, useRef } from "react"

import { useFileEditState } from "../hooks/useFileEditState"
import { useStyles } from "./UploadFileList/styles"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import UploadAction from "@/opensource/components/base/UploadAction"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"
import DragOverlay from "../../DragOverlay"
import { useDragUpload } from "../../../hooks"

interface FileItem {
	name: string
	file: File
}

interface UploadFileListProps {
	fileList: FileItem[]
	onAddFiles?: (files: FileList) => void
	onRemoveFile?: (index: number) => void
	onUpdateFileName?: (index: number, newName: string) => void
}

function UploadFileList({
	fileList,
	onAddFiles,
	onRemoveFile,
	onUpdateFileName,
}: UploadFileListProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const inputRef = useRef<HTMLInputElement>(null)

	// 创建拖拽上传管理
	const { isDragOver, dragEvents } = useDragUpload({
		onFilesDropped: onAddFiles,
	})

	const {
		editingIndex,
		editingName,
		startEditing,
		cancelEditing,
		updateEditingName,
		confirmEditing,
	} = useFileEditState()

	// Utility function to extract filename without extension
	const getFileNameWithoutExtension = (fileName: string) => {
		const lastDotIndex = fileName.lastIndexOf(".")
		if (lastDotIndex === -1 || lastDotIndex === 0) {
			return fileName // No extension or hidden file
		}
		return fileName.substring(0, lastDotIndex)
	}

	// Focus input when editing starts and select filename without extension
	useEffect(() => {
		if (editingIndex !== null && inputRef.current) {
			inputRef.current.focus()

			// Select only the filename part (without extension)
			const fileNameWithoutExt = getFileNameWithoutExtension(editingName)
			if (fileNameWithoutExt.length > 0) {
				inputRef.current.setSelectionRange(0, fileNameWithoutExt.length)
			} else {
				inputRef.current.select()
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editingIndex])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			confirmEditing(onUpdateFileName)
		} else if (e.key === "Escape") {
			cancelEditing()
		}
	}

	const handleInputBlur = () => {
		confirmEditing(onUpdateFileName)
	}

	// Handle double click on filename to enter edit mode
	const handleFileNameDoubleClick = (index: number, fileName: string) => {
		startEditing(index, fileName)
	}

	const renderFileIcon = (file: FileItem) => {
		const extension = file.file.name.split(".").pop()
		// For images, try to show thumbnail
		return <MagicFileIcon type={extension} className={styles.fileIcon} />
	}

	const renderFileName = (file: FileItem, index: number) => {
		if (editingIndex === index) {
			return (
				<input
					ref={inputRef}
					value={editingName}
					onChange={(e) => updateEditingName(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={handleInputBlur}
					className={styles.fileNameInput}
				/>
			)
		}

		return (
			<SmartTooltip
				className={styles.fileName}
				onDoubleClick={() => handleFileNameDoubleClick(index, file.name)}
			>
				{file.name}
			</SmartTooltip>
		)
	}

	return (
		<>
			<div className={styles.container} {...dragEvents}>
				<div className={styles.header}>
					<div className={styles.headerTitle}>
						{t("uploadModal.filesToUpload")} ({fileList.length})
					</div>
					<UploadAction
						handler={(onUpload) => {
							return (
								<button className={styles.addFilesButton} onClick={onUpload}>
									{t("uploadModal.addUploadFiles")}
								</button>
							)
						}}
						multiple
						onFileChange={onAddFiles}
					/>
				</div>

				<div className={styles.fileList}>
					{fileList.map((file, index) => (
						<div key={index} className={styles.fileItem}>
							<div className={styles.fileInfo}>
								{renderFileIcon(file)}
								{renderFileName(file, index)}
							</div>

							<div className={styles.actions}>
								<button
									className={`${styles.actionButton} edit`}
									onClick={() => startEditing(index, file.name)}
									title={t("uploadModal.editFilename")}
								>
									<IconPencil size={18} />
								</button>

								{onRemoveFile && (
									<button
										className={`${styles.actionButton} delete`}
										onClick={() => onRemoveFile(index)}
										title={t("uploadModal.removeFile")}
									>
										<IconTrash size={18} />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
				<DragOverlay visible={isDragOver} />
			</div>
		</>
	)
}

export default UploadFileList
