import { useMemoizedFn } from "ahooks"
import { last } from "lodash-es"
import { useEffect, useRef, useState } from "react"
import { AttachmentItem } from "../../TopicFilesButton/hooks"
import { ProjectListItem } from "../../../pages/Workspace/types"
import { useTranslation } from "react-i18next"
import { IMAGE_EXTENSIONS } from "@/constants/file"
import { UploadModal } from "../components/UploadModal"
import type { AddFilesOptions } from "../stores/FileUploadStore"
import type { UploadModalSubmitParams } from "../components/UploadModal/types"

const imageExtensions = new Set(
	[...IMAGE_EXTENSIONS, "avif", "bmp", "heic", "heif", "ico", "tif", "tiff"].map((extension) =>
		extension.toLowerCase(),
	),
)

export function isImageUploadFile(file: File) {
	if (file.type.toLowerCase().startsWith("image/")) return true

	const extension = file.name.split(".").pop()?.toLowerCase()
	return Boolean(extension && imageExtensions.has(extension))
}

function useChooseUploadDirModal({
	addFiles: _addFiles,
	selectedProject,
	attachments,
	validateFileSize,
	validateFileCount,
}: {
	selectedProject?: ProjectListItem | null
	addFiles: (
		files: File[],
		path?: string,
		options?: AddFilesOptions | string,
	) => Promise<unknown> | unknown
	attachments?: AttachmentItem[]
	validateFileSize: (files: File[]) => { validFiles: File[]; hasWarning: boolean }
	validateFileCount: (files: File[]) => { validFiles: File[]; hasError: boolean }
}) {
	const [selectDirectoryModalVisible, setSelectDirectoryModalVisible] = useState(false)
	const [uploadFiles, setUploadFiles] = useState<File[]>([])
	const { t } = useTranslation("super")

	const chooseDirPromise = useRef<Promise<UploadModalSubmitParams> | null>(null)
	const chooseDirResolve = useRef<((value: UploadModalSubmitParams) => void) | null>(null)
	const chooseDirReject = useRef<
		((value: { type: "cancel" | "error"; message?: string }) => void) | null
	>(null)
	useEffect(() => () => chooseDirReject.current?.({ type: "cancel" }), [])

	const addFiles = useMemoizedFn(async (files: File[], options: AddFilesOptions = {}) => {
		if (options.isCurrent?.() === false) return
		const imageFiles = files.filter(isImageUploadFile)
		const filesRequiringDirectory = files.filter((file) => !isImageUploadFile(file))

		// Editor images are transient message assets, so keep them out of the visible
		// project tree. Without a selected project, the temp path metadata is retained
		// on the upload mention and resolved after the message creates its project.
		if (imageFiles.length > 0) {
			await _addFiles(imageFiles, undefined, { ...options, useTempDirectory: true })
		}

		if (options.isCurrent?.() === false) return
		if (filesRequiringDirectory.length === 0) return
		if (!selectedProject) {
			await _addFiles(filesRequiringDirectory, undefined, {
				...options,
				defaultRelativePathPrefix: "upload",
			})
			return
		}

		setUploadFiles(filesRequiringDirectory)
		setSelectDirectoryModalVisible(true)

		// 如果当前有选择目录的请求，则等待请求完成
		chooseDirPromise.current = chooseDirPromise.current
			? chooseDirPromise.current
			: new Promise<UploadModalSubmitParams>((resolve, reject) => {
					chooseDirResolve.current = resolve
					chooseDirReject.current = reject
				})

		try {
			const { path, files: editedFiles, originalFiles } = await chooseDirPromise.current
			if (options.isCurrent?.() === false) return
			const sources = new Map(editedFiles.map((file, index) => [file, originalFiles[index]]))
			await _addFiles(editedFiles, last(path)?.file_id, {
				...options,
				onFileAdded: options.onFileAdded
					? (addedFiles, sourceFiles) =>
							options.onFileAdded?.(
								addedFiles,
								sourceFiles.map((file) => sources.get(file) ?? file),
							)
					: undefined,
			})
		} catch (err: unknown) {
			if (err && typeof err === "object" && "type" in err && err.type === "cancel") {
				console.log("Canceled")
			} else {
				console.error("Error", err)
			}
		} finally {
			chooseDirResolve.current = null
			chooseDirReject.current = null
			chooseDirPromise.current = null
			setUploadFiles([])
		}
	})

	// 隐藏弹窗会触发内部 resetFiles；先清空父级输入，避免它恢复上一批待上传文件。
	const onModalClose = useMemoizedFn(() => {
		setUploadFiles([])
		chooseDirReject.current?.({ type: "cancel" })
		chooseDirResolve.current = null
		chooseDirReject.current = null
		setSelectDirectoryModalVisible(false)
	})

	const onModalSubmit = useMemoizedFn((value: UploadModalSubmitParams) => {
		setUploadFiles([])
		chooseDirResolve.current?.(value)
		chooseDirResolve.current = null
		chooseDirReject.current = null
		setSelectDirectoryModalVisible(false)
	})

	// 目录弹窗只有一个；连续粘贴分别完成选择，不能共用上一批的文件和确认结果。
	const uploadQueue = useRef(Promise.resolve())
	const addFilesWithDir = useMemoizedFn((files: File[], options?: AddFilesOptions) => {
		const operation = uploadQueue.current.then(() => addFiles(files, options))
		uploadQueue.current = operation.catch(() => undefined)
		return operation
	})

	const UploadModalComponent = selectedProject && (
		<UploadModal
			visible={selectDirectoryModalVisible}
			projectId={selectedProject.id}
			uploadFiles={uploadFiles}
			attachments={attachments}
			isShowCreateDirectory={true}
			tips={t("selectPathModal.uploadDirectoryTip")}
			onSubmit={onModalSubmit}
			onClose={onModalClose}
			validateFileSize={validateFileSize}
			validateFileCount={validateFileCount}
		/>
	)

	return {
		selectDirectoryModalVisible,
		setSelectDirectoryModalVisible,
		addFilesWithDir,
		onModalClose,
		onModalSubmit,
		uploadFiles,
		setUploadFiles,
		UploadModal: UploadModalComponent,
	}
}

export default useChooseUploadDirModal
