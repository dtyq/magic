import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { generateNextFileName } from "../../../utils/generateUniqueFileName"

interface FileItem {
	name: string
	file: File
}

interface UseUploadFilesProps {
	uploadFiles?: File[]
	validateFileSize?: (files: File[]) => { validFiles: File[]; hasWarning: boolean }
	validateFileCount?: (files: File[]) => { validFiles: File[]; hasError: boolean }
}

export function useUploadFiles({
	uploadFiles,
	validateFileSize = (files) => ({ validFiles: files, hasWarning: false }),
	validateFileCount = (files) => ({ validFiles: files, hasError: false }),
}: UseUploadFilesProps) {
	const [fileList, setFileList] = useState<FileItem[]>(
		uploadFiles ? uploadFiles.map((file) => ({ name: file.name, file })) : [],
	)

	// Add files to upload list
	const addFiles = useMemoizedFn((files: FileList | File[]) => {
		const filesArray = Array.from(files)

		// 检测是否为文件夹上传（文件具有 webkitRelativePath 属性）
		const isFolderUpload = filesArray.some(
			(file) => "webkitRelativePath" in file && file.webkitRelativePath,
		)

		let newFiles: File[]

		if (isFolderUpload) {
			// 文件夹上传：保持原有文件名，不进行重命名
			newFiles = filesArray
		} else {
			// 单文件上传：执行重命名逻辑避免冲突
			const existingFileNames = new Set(fileList.map((f) => f.name))

			newFiles = filesArray.reduce((acc, file) => {
				if (existingFileNames.has(file.name)) {
					const uniqueFileName = generateNextFileName(
						file.name,
						Array.from(existingFileNames.values()),
					)
					existingFileNames.add(uniqueFileName)
					return [
						...acc,
						new File([file], uniqueFileName, {
							type: file.type,
							lastModified: file.lastModified,
						}),
					]
				}
				existingFileNames.add(file.name)
				return [...acc, file]
			}, [] as File[])
		}

		const validateFileSizeResult = validateFileSize(newFiles)
		const validateFileCountResult = validateFileCount(validateFileSizeResult.validFiles)

		if (validateFileCountResult.validFiles) {
			setFileList((prev) => [
				...prev,
				...validateFileCountResult.validFiles.map((f) => ({ name: f.name, file: f })),
			])
		}
	})

	useEffect(() => {
		if (uploadFiles) {
			addFiles(uploadFiles)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [uploadFiles])

	// Remove file from upload list
	const removeFile = useMemoizedFn((index: number) => {
		setFileList((prev) => prev.filter((_, i) => i !== index))
	})

	// Update file name
	const updateFileName = useMemoizedFn((index: number, newName: string) => {
		setFileList((prev) =>
			prev.map((item, i) =>
				i === index
					? {
							...item,
							name: newName,
							file: new File([item.file], newName, {
								type: item.file.type,
								lastModified: item.file.lastModified,
							}),
						}
					: item,
			),
		)
	})

	// Clear all files
	const clearFiles = useMemoizedFn(() => {
		setFileList([])
	})

	// Reset to initial files
	const resetFiles = useMemoizedFn(() => {
		setFileList(
			uploadFiles ? Array.from(uploadFiles).map((file) => ({ name: file.name, file })) : [],
		)
	})

	return {
		fileList,
		addFiles,
		removeFile,
		updateFileName,
		clearFiles,
		resetFiles,
	}
}
