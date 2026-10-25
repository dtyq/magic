import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { ImageFormat, ImageProcessOptions } from "@/utils/image-processing"
import { t } from "i18next"
import type { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import type JSZip from "jszip"

export interface PackDownloadFileEntry {
	/** 元素级唯一键；同一个项目文件可以对应多个画布元素。 */
	key: string
	file: FileItem
	fileName?: string
	imageProcess?: ImageProcessOptions
	downloadMode?: DownloadImageMode
}

export interface PackDownloadFileEntriesOptions {
	signal?: AbortSignal
	onProgress?: (progress: number) => void
	retryCount?: number
	/** Bound file client; when present its captured access rides the download URL requests. */
	fileApi?: FileApi
	/** 原画布可交付成功子集；文件集合要求每个成员成功后才交付。 */
	failureMode?: "allow_partial" | "all_required"
	pathMode?: "basename" | "workspace_relative"
	maxBytes?: number
	concurrency?: number
}

export class FileBundleDownloadError extends Error {
	constructor(readonly results: PackDownloadFilesResult["results"]) {
		super("Some requested files could not be downloaded")
	}
}

export class FileBundleCapacityError extends Error {
	constructor() {
		super("The file collection exceeds the browser download budget")
	}
}

export interface PackDownloadFilesResult {
	successCount: number
	results: Array<{ success: boolean; fileName: string; error?: unknown }>
}

function createAbortError(): Error {
	if (typeof DOMException !== "undefined") {
		return new DOMException("Download aborted", "AbortError")
	}
	const error = new Error("Download aborted")
	error.name = "AbortError"
	return error
}

function throwIfDownloadAborted(signal?: AbortSignal) {
	if (signal?.aborted) throw createAbortError()
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError"
}

async function retryDownloadTask<T>(
	task: () => Promise<T>,
	retryCount: number,
	signal?: AbortSignal,
): Promise<T> {
	let lastError: unknown
	for (let attempt = 0; attempt <= retryCount; attempt += 1) {
		throwIfDownloadAborted(signal)
		try {
			return await task()
		} catch (error) {
			if (isAbortError(error) || signal?.aborted) throw createAbortError()
			if (error instanceof FileBundleCapacityError) throw error
			lastError = error
		}
	}
	throw lastError
}

function getPackEntryFileName(entry: PackDownloadFileEntry, index: number): string {
	const rawFileName =
		entry.fileName ||
		entry.file.file_name ||
		entry.file.display_filename ||
		entry.file.filename ||
		`file-${index + 1}`
	const processedFormat = normalizeImageProcessFormat(entry.imageProcess?.format)
	if (!processedFormat) {
		if (rawFileName.includes(".")) return rawFileName
		const originalExtension = entry.file.file_extension
		return originalExtension ? `${rawFileName}.${originalExtension}` : rawFileName
	}

	const lastDotIndex = rawFileName.lastIndexOf(".")
	const baseFileName = lastDotIndex === -1 ? rawFileName : rawFileName.slice(0, lastDotIndex)
	return `${baseFileName}.${processedFormat}`
}

function makePackEntryFileNames(entries: PackDownloadFileEntry[]): string[] {
	const usedFileNames = new Set<string>()
	return entries.map((entry, index) => {
		const requestedFileName = getPackEntryFileName(entry, index)
		const lastDotIndex = requestedFileName.lastIndexOf(".")
		const baseFileName =
			lastDotIndex === -1 ? requestedFileName : requestedFileName.slice(0, lastDotIndex)
		const extension = lastDotIndex === -1 ? "" : requestedFileName.slice(lastDotIndex)
		let finalFileName = requestedFileName
		let counter = 1
		while (usedFileNames.has(finalFileName)) {
			finalFileName = `${baseFileName}-${counter}${extension}`
			counter += 1
		}
		usedFileNames.add(finalFileName)
		return finalFileName
	})
}

function getWorkspaceArchiveNames(entries: PackDownloadFileEntry[]): string[] {
	const used = new Set<string>()
	return entries.map((entry) => {
		const path = entry.file.relative_file_path
		if (
			!path ||
			path.startsWith("/") ||
			path.includes("\u0000") ||
			path.split("/").some((part) => !part || part === "." || part === "..") ||
			used.has(path)
		) {
			throw new Error("Invalid or duplicate archive path")
		}
		used.add(path)
		return path
	})
}

/** 暂停 JSZip 标准流以终止后续输出；不把取消误报为已触发文件保存。 */
function createZipBlob(
	zip: JSZip,
	signal: AbortSignal | undefined,
	onProgress: (percent: number) => void,
): Promise<Blob> {
	throwIfDownloadAborted(signal)
	return new Promise((resolve, reject) => {
		const chunks: ArrayBuffer[] = []
		const stream = zip.generateInternalStream({ type: "uint8array" })
		let settled = false
		const finish = (error?: Error) => {
			if (settled) return
			settled = true
			signal?.removeEventListener("abort", abort)
			if (error) {
				stream.pause()
				chunks.length = 0
				reject(error)
			} else {
				resolve(new Blob(chunks, { type: "application/zip" }))
				chunks.length = 0
			}
		}
		const abort = () => finish(createAbortError())
		signal?.addEventListener("abort", abort, { once: true })
		stream.on("data", (chunk, metadata) => {
			if (settled) return
			chunks.push(new Uint8Array(chunk).buffer)
			onProgress(metadata.percent)
		})
		stream.on("error", (error) => finish(error))
		stream.on("end", () => finish())
		stream.resume()
	})
}

/**
 * 画布裁剪/同源多实例的客户端 ZIP 适配器。
 * 下载地址仍复用项目文件 API；这里只保留项目批量接口无法表达的逐元素图片处理参数。
 */
export async function packAndDownloadFileEntries(
	entries: PackDownloadFileEntry[],
	downloadMode?: DownloadImageMode,
	zipFileName = "design-media.zip",
	options: PackDownloadFileEntriesOptions = {},
): Promise<PackDownloadFilesResult> {
	const { loadJSZip } = await import("@/infrastructure/vendors/jszip")
	const { getTemporaryDownloadUrl } = await import("@/pages/superMagic/utils/api")
	const { downloadFileWithAnchor } = await import("@/pages/superMagic/utils/handleFIle")
	// Prefer the boundary-bound client so share downloads carry their access token;
	// host-only callers keep the unbound leaf.
	const resolveTemporaryDownloadUrl =
		options.fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl
	const JSZip = await loadJSZip()
	const zip = new JSZip()
	const fileNames =
		options.pathMode === "workspace_relative"
			? getWorkspaceArchiveNames(entries)
			: makePackEntryFileNames(entries)
	const retryCount = options.retryCount ?? 1
	if (
		options.maxBytes !== undefined &&
		(!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1)
	) {
		throw new Error("Download budget must be a positive byte count")
	}
	const sharedDownloadUrlByFileId = new Map<string, string>()
	let completedCount = 0
	let retainedBytes = 0
	const readBlob = async (response: Response): Promise<Blob> => {
		if (options.maxBytes === undefined) return response.blob()
		const reader = response.body?.getReader()
		if (!reader) throw new Error("The response does not provide a readable body")
		const chunks: ArrayBuffer[] = []
		let fileBytes = 0
		let finished = false
		try {
			while (!finished) {
				throwIfDownloadAborted(options.signal)
				const { done, value } = await reader.read()
				finished = done
				if (done) break
				if (retainedBytes + value.byteLength > options.maxBytes) {
					throw new FileBundleCapacityError()
				}
				retainedBytes += value.byteLength
				fileBytes += value.byteLength
				chunks.push(new Uint8Array(value).buffer)
			}
			return new Blob(chunks)
		} catch (error) {
			// 重试不保留失败请求的缓冲，否则同一文件会被重复计算为在用内存。
			retainedBytes -= fileBytes
			await reader.cancel().catch(() => undefined)
			throw error
		} finally {
			reader.releaseLock()
		}
	}

	throwIfDownloadAborted(options.signal)
	const groupedFileIds = new Map<DownloadImageMode | undefined, Set<string>>()
	for (const entry of entries) {
		if (entry.imageProcess) continue
		const mode = entry.downloadMode ?? downloadMode
		const group = groupedFileIds.get(mode) ?? new Set<string>()
		group.add(entry.file.file_id)
		groupedFileIds.set(mode, group)
	}
	for (const [mode, group] of groupedFileIds) {
		const unprocessedFileIds = [...group]
		try {
			const downloadUrls = await retryDownloadTask(
				() =>
					resolveTemporaryDownloadUrl({
						file_ids: unprocessedFileIds,
						download_mode: mode,
						is_download: true,
						enableErrorMessagePrompt: false,
					}),
				retryCount,
				options.signal,
			)
			downloadUrls.forEach((item, index) => {
				const fileId =
					item.file_id ||
					(options.failureMode === "all_required" ? undefined : unprocessedFileIds[index])
				if (fileId && item.url) sharedDownloadUrlByFileId.set(fileId, item.url)
			})
		} catch (error) {
			if (isAbortError(error) || options.signal?.aborted) throw createAbortError()
			// 批量取地址失败后由各元素单独重试，确保仍可产出成功子集。
		}
	}

	const downloadEntry = async (entry: PackDownloadFileEntry, index: number) => {
		const fileName = fileNames[index]
		try {
			let downloadUrl = entry.imageProcess
				? undefined
				: sharedDownloadUrlByFileId.get(entry.file.file_id)
			if (!downloadUrl) {
				downloadUrl = await retryDownloadTask(
					async () => {
						const downloadUrls = await resolveTemporaryDownloadUrl({
							file_ids: [entry.file.file_id],
							download_mode: entry.downloadMode ?? downloadMode,
							is_download: true,
							options: entry.imageProcess
								? { xMagicImageProcess: entry.imageProcess }
								: undefined,
							enableErrorMessagePrompt: false,
						})
						const url =
							options.failureMode === "all_required"
								? downloadUrls.find((item) => item.file_id === entry.file.file_id)
										?.url
								: downloadUrls?.[0]?.url
						if (!url) throw new Error(t("design.errors.cannotGetDownloadUrl"))
						return url
					},
					retryCount,
					options.signal,
				)
			}

			let downloadAttempt = 0
			const blob = await retryDownloadTask(
				async () => {
					throwIfDownloadAborted(options.signal)
					if (downloadAttempt++ > 0 && options.failureMode === "all_required") {
						const refreshed = await resolveTemporaryDownloadUrl({
							file_ids: [entry.file.file_id],
							download_mode: entry.downloadMode ?? downloadMode,
							is_download: true,
							cache: false,
							enableErrorMessagePrompt: false,
						})
						downloadUrl = refreshed.find(
							(item) => item.file_id === entry.file.file_id,
						)?.url
						if (!downloadUrl) throw new Error("No authorized download URL was returned")
					}
					if (!downloadUrl) throw new Error("No authorized download URL was returned")
					throwIfDownloadAborted(options.signal)
					const response = await fetch(downloadUrl, { signal: options.signal })
					if (!response.ok) {
						throw new Error(
							t("design.errors.downloadImageFailed", {
								statusText: response.statusText,
							}),
						)
					}
					return readBlob(response)
				},
				retryCount,
				options.signal,
			)
			zip.file(fileName, blob)
			return { success: true, fileName }
		} catch (error) {
			if (isAbortError(error) || options.signal?.aborted) throw createAbortError()
			return { success: false, fileName, error }
		} finally {
			completedCount += 1
			options.onProgress?.(entries.length ? (completedCount / entries.length) * 90 : 90)
		}
	}
	const results: PackDownloadFilesResult["results"] = new Array(entries.length)
	let nextIndex = 0
	const concurrency = options.concurrency ?? entries.length
	if (entries.length && (!Number.isInteger(concurrency) || concurrency < 1)) {
		throw new Error("Download concurrency must be a positive integer")
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
			while (nextIndex < entries.length) {
				const index = nextIndex++
				results[index] = await downloadEntry(entries[index], index)
			}
		}),
	)

	const successCount = results.filter((result) => result.success).length
	if (options.failureMode === "all_required" && successCount !== entries.length) {
		if (results.some((result) => result.error instanceof FileBundleCapacityError)) {
			throw new FileBundleCapacityError()
		}
		throw new FileBundleDownloadError(results)
	}
	if (successCount === 0) {
		throw new Error(t("design.errors.noDownloadableImages"))
	}

	throwIfDownloadAborted(options.signal)
	const reportZipProgress = (percent: number) => {
		options.onProgress?.(90 + percent * 0.1)
	}
	const zipBlob =
		options.failureMode === "all_required"
			? await createZipBlob(zip, options.signal, reportZipProgress)
			: await zip.generateAsync({ type: "blob" }, ({ percent }) => reportZipProgress(percent))
	throwIfDownloadAborted(options.signal)

	const url = URL.createObjectURL(zipBlob)
	try {
		await downloadFileWithAnchor(url, zipFileName, undefined, {
			onModalClose: () => URL.revokeObjectURL(url),
		})
	} catch (error) {
		URL.revokeObjectURL(url)
		throw error
	}
	options.onProgress?.(100)

	return { successCount, results }
}

/** 兼容设计页已有调用；逐元素能力由 packAndDownloadFileEntries 承担。 */
export async function packAndDownloadFiles(
	imageFiles: FileItem[],
	downloadMode?: import("@/pages/superMagic/pages/Workspace/types").DownloadImageMode,
	zipFileName = "design-images.zip",
	xMagicImageProcessByFileId?: Record<string, ImageProcessOptions>,
	fileApi?: FileApi,
): Promise<PackDownloadFilesResult> {
	return packAndDownloadFileEntries(
		imageFiles.map((file, index) => ({
			key: `${file.file_id}:${index}`,
			file,
			imageProcess: xMagicImageProcessByFileId?.[file.file_id],
		})),
		downloadMode,
		zipFileName,
		{ fileApi },
	)
}

function normalizeImageProcessFormat(format?: ImageFormat): string | undefined {
	if (!format) return undefined
	if (format === "jpg") return "jpg"
	if (format === "tiff") return "tiff"
	return format
}
