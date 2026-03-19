import type { TFunction } from "i18next"
import type { FileData } from "../../types"
import magicToast from "@/components/base/MagicToaster/utils"

interface LoggerLike {
	warn: (message: string, meta?: Record<string, unknown>) => void
}

interface DuplicateValidationParams {
	newFiles: File[]
	existingFiles: FileData[]
	targetSuffixDir: string
	needFilterSameFile: boolean
	t: TFunction
	logger: LoggerLike
}

interface SizeValidationParams {
	files: File[]
	maxUploadSize: number
	t: TFunction
	logger: LoggerLike
}

interface CountValidationParams {
	filesToValidate: File[]
	currentCount: number
	maxUploadCount: number
	t: TFunction
	logger: LoggerLike
}

export function validateDuplicateFiles({
	newFiles,
	existingFiles,
	targetSuffixDir,
	needFilterSameFile,
	t,
	logger,
}: DuplicateValidationParams) {
	if (!needFilterSameFile) {
		return { validFiles: newFiles, hasWarning: false }
	}

	const uniqueFiles = newFiles.filter((newFile) => {
		const isDuplicate = existingFiles.some((existingFile) => {
			return (
				existingFile.file.name === newFile.name &&
				existingFile.file.size === newFile.size &&
				existingFile.file.lastModified === newFile.lastModified &&
				existingFile.suffixDir === targetSuffixDir
			)
		})
		return !isDuplicate
	})

	const hasWarning = uniqueFiles.length < newFiles.length
	if (hasWarning) {
		const duplicateCount = newFiles.length - uniqueFiles.length
		magicToast.warning(
			t("fileUpload.duplicateFilesFiltered", { ns: "super", count: duplicateCount }),
		)
		logger.warn("duplicate files filtered", {
			count: duplicateCount,
			suffixDir: targetSuffixDir,
		})
	}

	return { validFiles: uniqueFiles, hasWarning }
}

export function validateFileSize({ files, maxUploadSize, t, logger }: SizeValidationParams) {
	const originalLength = files.length
	const validFiles = files.filter((file) => file.size <= maxUploadSize)

	const hasWarning = originalLength !== validFiles.length
	if (hasWarning) {
		magicToast.warning(
			t("fileUpload.fileSizeExceeded", {
				ns: "super",
				maxSize: maxUploadSize / 1024 / 1024,
			}),
		)
		logger.warn("file size exceeded filtered", {
			maxSize: maxUploadSize,
			filteredCount: originalLength - validFiles.length,
		})
	}

	return { validFiles, hasWarning }
}

export function validateFileCount({
	filesToValidate,
	currentCount,
	maxUploadCount,
	t,
	logger,
}: CountValidationParams) {
	if (!maxUploadCount) {
		return { validFiles: filesToValidate, hasError: false }
	}

	const totalCount = currentCount + filesToValidate.length
	if (totalCount <= maxUploadCount) {
		return { validFiles: filesToValidate, hasError: false }
	}

	const allowedCount = maxUploadCount - currentCount
	const validFiles = filesToValidate.slice(0, allowedCount)

	magicToast.error(t("fileUpload.maxFilesReached", { ns: "super", maxCount: maxUploadCount }))
	logger.warn("max files reached", { maxUploadCount, currentCount })

	return { validFiles, hasError: true }
}

export function validateEmptyFiles(files: File[], logger: LoggerLike) {
	if (files.length === 0) {
		logger.warn("no files to add after filtering")
		return false
	}
	return true
}
