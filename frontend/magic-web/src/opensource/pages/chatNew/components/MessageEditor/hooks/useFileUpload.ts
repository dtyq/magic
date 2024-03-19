import { useState } from "react"
import type { DragEvent } from "react"

import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

import { useUpload } from "@/opensource/hooks/useUploadFiles"
import type { MagicRichEditorRef } from "@/opensource/components/base/MagicRichEditor"
import {
	isValidImageFile,
	fileToBase64,
	FileError,
	transformJSONContent,
} from "@/opensource/components/base/MagicRichEditor/utils"
import { Image } from "@/opensource/components/base/MagicRichEditor/extensions/image"
import type { FileData } from "../components/InputFiles/types"
import { genFileData } from "../components/InputFiles/utils"
import type { JSONContent } from "@tiptap/react"
import type { ReportFileUploadsResponse } from "@/opensource/apis/modules/file"
import { FileApi } from "@/opensource/apis"
import type { UploadResult } from "@/opensource/hooks/useUploadFiles/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

function dataUrlToFile(dataUrl: string, fileName: string): File {
	const parts = dataUrl.split(",")
	const header = parts[0] ?? ""
	const base64 = parts[1] ?? ""
	const mimeMatch = header.match(/data:(.+);base64/)
	const mime = mimeMatch?.[1] || "application/octet-stream"
	const binary = atob(base64)
	const len = binary.length
	const bytes = new Uint8Array(len)
	for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
	return new File([bytes], fileName, { type: mime })
}

export interface UseFileUploadProps {
	/** Maximum number of files that can be uploaded */
	maxUploadCount?: number
	/** Callback when files change (for draft saving etc.) */
	onFilesChange?: () => void
	/** Editor reference for image insertion */
	editorRef?: React.RefObject<MagicRichEditorRef>
}

export interface UseFileUploadReturn {
	/** Current files list */
	files: FileData[]
	/** Set files with validation and limits */
	setFiles: (l: FileData[] | ((prev: FileData[]) => FileData[])) => void
	/** Whether files are currently uploading */
	uploading: boolean
	/** Upload files function */
	upload: (files: FileData[]) => Promise<UploadResult>
	/** Upload files for sending message */
	uploadFilesForSend: (jsonValue: JSONContent | undefined) => Promise<{
		transformedJsonContent: JSONContent | undefined
		reportedFiles: ReportFileUploadsResponse[]
	}>
	/** Handle file selection/drop */
	onFileChange: (fileList: FileList | File[]) => Promise<void>
	/** Handle paste file errors */
	handlePasteFileFail: (errors: FileError[]) => void
	/** Handle drag and drop */
	onDrop: (e: DragEvent<HTMLElement>) => void
	/** Handle drag over */
	onDragOver: (e: DragEvent<HTMLElement>) => void
}

export function useFileUpload({
	maxUploadCount = 20,
	onFilesChange,
	editorRef,
}: UseFileUploadProps = {}): UseFileUploadReturn {
	const { t } = useTranslation("interface")

	const [files, setFilesRaw] = useState<FileData[]>([])

	const setFiles = useMemoizedFn((l: FileData[] | ((prev: FileData[]) => FileData[])) => {
		const list = typeof l === "function" ? l(files) : l
		setFilesRaw(list.slice(0, maxUploadCount))

		if (list.length > maxUploadCount) {
			magicToast.error(t("file.uploadLimit", { count: maxUploadCount }))
		}

		// Trigger files change callback (for draft saving etc.)
		onFilesChange?.()
	})

	const { upload, uploading } = useUpload<FileData>({
		storageType: "private",
		onProgress(file, progress) {
			setFiles((l) => {
				const newFiles = [...l]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					if (target.status !== "uploading") {
						target.status = "uploading"
					}
					target.progress = progress
				}
				return newFiles
			})
		},
		onSuccess(file, response) {
			setFiles((l) => {
				const newFiles = [...l]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.status = "done"
					target.result = response
				}
				return newFiles
			})
		},
		onFail(file, error) {
			setFiles((l) => {
				const newFiles = [...l]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.status = "error"
					target.error = error
				}
				return newFiles
			})
		},
		onInit(file, { cancel }) {
			setFiles((l) => {
				const newFiles = [...l]
				const target = newFiles.find((f) => f.id === file.id)
				if (target) {
					target.cancel = cancel
				}
				return newFiles
			})
		},
	})

	const onFileChange = useMemoizedFn(async (fileList: FileList | File[]) => {
		const imageFiles: File[] = []
		const otherFiles: File[] = []

		// Categorize files: images and others using improved detection
		for (let i = 0; i < fileList.length; i += 1) {
			if (isValidImageFile(fileList[i])) {
				imageFiles.push(fileList[i])
			} else {
				otherFiles.push(fileList[i])
			}
		}

		// Process images and insert into editor
		if (imageFiles.length > 0 && editorRef?.current?.editor) {
			const pos = editorRef.current.editor.state.selection.$from.pos ?? 0
			await Promise.all(
				imageFiles.map(async (file) => {
					const file_extension = file.type.split("/").pop() ?? ""
					const src = await fileToBase64(file)

					editorRef.current?.editor?.commands.insertContentAt(pos, {
						type: Image.name,
						attrs: {
							src,
							file_name: file.name,
							file_size: file.size,
							file_extension,
						},
					})
				}),
			)
			editorRef.current.editor.commands.focus(pos + imageFiles.length)
		}

		// Process other files
		if (otherFiles.length > 0) {
			setFiles((l) => [...l, ...otherFiles.map(genFileData)])
		}

		// Focus editor after file processing
		editorRef?.current?.editor?.chain().focus().run()
	})

	const handlePasteFileFail = useMemoizedFn((errors: FileError[]) => {
		const fileList: FileData[] = []
		errors.forEach((error) => {
			switch (error.reason) {
				case "size":
					magicToast.error(t("richEditor.fileTooLarge"))
					break
				case "invalidBase64":
					magicToast.error(t("richEditor.invalidBase64"))
					break
				case "type":
					if (error.file && error.file instanceof File) {
						fileList.push(genFileData(error.file as File))
					}
					break
				default:
					break
			}
		})

		if (!errors.length && fileList.length) {
			setFiles((prev) => [...prev, ...fileList])
		}
	})

	const onDrop = useMemoizedFn((e: DragEvent<HTMLElement>) => {
		e.stopPropagation()
		e.preventDefault()
		onFileChange(e.dataTransfer?.files ?? [])
	})

	const onDragOver = useMemoizedFn((e: DragEvent<HTMLElement>) => {
		e.stopPropagation()
		e.preventDefault()
	})

	const uploadFilesForSend = useMemoizedFn(async (jsonValue: JSONContent | undefined) => {
		// Upload attachment files first
		const { fullfilled, rejected } = await upload(files)
		if (rejected.length > 0) {
			throw new Error("File upload failed")
		}

		// Report uploaded files
		const reportedFiles: ReportFileUploadsResponse[] =
			fullfilled.length > 0
				? await FileApi.reportFileUploads(
						fullfilled.map((d) => ({
							file_extension: d.value.name.split(".").pop() ?? "",
							file_key: d.value.key,
							file_size: d.value.size,
							file_name: d.value.name,
						})),
					)
				: []

		// Collect image nodes without file_id for batch upload
		const pendingNodes: { node: JSONContent; src: string; name: string }[] = []

		const transformedJsonContent = await transformJSONContent(
			jsonValue,
			(c) => c.type === Image.name,
			async (c) => {
				const src = c.attrs?.src
				const fileId = c.attrs?.file_id
				if (!fileId && typeof src === "string" && src) {
					const fileName = c.attrs?.file_name ?? `image_${Date.now()}`
					pendingNodes.push({ node: c, src, name: fileName })
				}
			},
		)

		// Batch process collected images: convert -> upload -> report -> mutate nodes
		if (pendingNodes.length > 0) {
			const files: File[] = await Promise.all(
				pendingNodes.map(async ({ src, name }) => {
					if (src.startsWith("data:")) return dataUrlToFile(src, name)
					const blob = await fetch(src).then((res) => res.blob())
					return new File([blob], name, { type: blob.type })
				}),
			)

			const newFiles = files.map(genFileData)
			const { fullfilled, rejected } = await upload(newFiles)
			if (rejected.length > 0 || fullfilled.length !== newFiles.length)
				throw new Error("Image upload failed")

			const reportPayload = fullfilled.map((d, idx) => ({
				file_extension: files[idx].type.split("/").pop() ?? "",
				file_key: d.value.key,
				file_size: d.value.size,
				file_name: d.value.name,
			}))
			const reportResults = await FileApi.reportFileUploads(reportPayload)

			pendingNodes.forEach((entry, idx) => {
				const file = files[idx]
				const file_extension = file.type.split("/").pop() ?? ""
				const res = reportResults[idx]
				const c = entry.node
				c.attrs = {
					...(c?.attrs ?? {}),
					src: "",
					file_id: res.file_id,
					file_extension,
					file_size: file.size,
					file_name: file.name,
				}
			})
		}

		return {
			transformedJsonContent,
			reportedFiles,
		}
	})

	return {
		files,
		setFiles,
		uploading,
		upload,
		uploadFilesForSend,
		onFileChange,
		handlePasteFileFail,
		onDrop,
		onDragOver,
	}
}
