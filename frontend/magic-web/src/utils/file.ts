import { t } from "i18next"
import type { FileTypeResult } from "file-type"
import { fileTypeFromStream } from "file-type"
import { safeBinaryToBtoa } from "@/utils/encoding"

const fileExtCache = new Map<string | File, FileTypeResult | undefined>()

/**
 * 获取文件名扩展名
 * @param name 文件名
 * @returns 文件名扩展名
 */
export const getFileNameExtension = (name: string) => {
	const extension = name.split(".").pop()
	return extension ?? ""
}

/**
 * 获取文件扩展名
 * @param url - 文件路径或文件对象
 * @returns 文件扩展名
 */
export const getFileExtension = async (url?: string | File) => {
	if (!url) return undefined

	if (fileExtCache.has(url)) {
		return fileExtCache.get(url)
	}

	if (typeof url === "string") {
		try {
			const response = await fetch(url)
			if (!response.body) return undefined
			const res = await fileTypeFromStream(response.body)

			fileExtCache.set(url, res)

			return res
		} catch (err) {
			return undefined
		}
	}
	const res = await fileTypeFromStream(url.stream())
	fileExtCache.set(url, res)
	return res
}

/**
 * Check if filename has extension
 * @param filename - The filename to check
 * @returns true if filename has extension, false otherwise
 */
const hasFileExtension = (filename: string): boolean => {
	const lastDotIndex = filename.lastIndexOf(".")
	const lastSlashIndex = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"))

	// Extension must be after the last path separator and contain at least one character
	return lastDotIndex > lastSlashIndex && lastDotIndex < filename.length - 1
}

/**
 * Ensure filename has extension
 * @param filename - The original filename
 * @param extension - The extension to append (with or without dot)
 * @returns filename with extension
 */
const ensureFileExtension = (filename: string, extension: string): string => {
	if (!filename || hasFileExtension(filename) || !extension) {
		return filename
	}

	// Ensure extension starts with dot
	const ext = extension.startsWith(".") ? extension : `.${extension}`
	return `${filename}${ext}`
}

/**
 * Create and trigger download link
 * @param url - Download URL
 * @param fileName - File name with extension
 */
const createDownloadLink = (url: string, fileName: string, target?: string) => {
	const link = document.createElement("a")
	link.href = url
	link.download = fileName
	if (target) {
		link.target = target
	}
	link.rel = "noopener noreferrer"
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
}

/**
 * Check if URL is cross-origin
 * @param url - URL to check
 * @returns true if cross-origin, false otherwise
 */
const isCrossOrigin = (url: string): boolean => {
	try {
		const urlObj = new URL(url, window.location.href)
		return urlObj.origin !== window.location.origin
	} catch {
		return false
	}
}

/**
 * Download progress callback type
 */
export interface DownloadProgress {
	loaded: number
	total: number
	percentage: number
}

/**
 * Download options interface
 */
export interface DownloadOptions {
	/** 强制使用代理下载(解决跨域问题) */
	forceProxy?: boolean
	/** 下载进度回调 */
	onProgress?: (progress: DownloadProgress) => void
	/** 请求超时时间(毫秒) */
	timeout?: number
	/** 下载目标(如 _blank) */
	target?: string
}

/**
 * Download file using fetch (for cross-origin or when blob conversion is needed)
 * @param url - File URL
 * @param fileName - File name with extension
 * @param options - Download options
 * @returns Download result
 */
const downloadWithFetch = async (url: string, fileName: string, options: DownloadOptions = {}) => {
	const { onProgress, timeout = 30000 } = options

	try {
		// Create abort controller for timeout
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), timeout)

		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Content-Type": "application/octet-stream",
			},
			signal: controller.signal,
		})

		clearTimeout(timeoutId)

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		// Handle progress if callback provided and content-length available
		if (onProgress && response.body) {
			const contentLength = response.headers.get("content-length")
			const total = contentLength ? parseInt(contentLength, 10) : 0

			const reader = response.body.getReader()
			const chunks: Uint8Array[] = []
			let loaded = 0

			try {
				let done = false
				while (!done) {
					const result = await reader.read()
					done = result.done

					if (!done && result.value) {
						chunks.push(result.value)
						loaded += result.value.length

						if (total > 0) {
							onProgress({
								loaded,
								total,
								percentage: Math.round((loaded / total) * 100),
							})
						}
					}
				}

				// Combine chunks into single blob
				// 强制使用 application/octet-stream 避免浏览器预览 PDF 等文件
				const blob = new Blob(chunks, { type: "application/octet-stream" })
				const blobUrl = window.URL.createObjectURL(blob)

				createDownloadLink(blobUrl, fileName, options?.target)

				// Clean up the blob URL after a short delay
				setTimeout(() => {
					window.URL.revokeObjectURL(blobUrl)
				}, 100)

				return { success: true }
			} finally {
				reader.releaseLock()
			}
		} else {
			// Fallback to simple blob conversion
			const originalBlob = await response.blob()
			// 强制使用 application/octet-stream 避免浏览器预览 PDF 等文件
			const blob = new Blob([originalBlob], { type: "application/octet-stream" })
			const blobUrl = window.URL.createObjectURL(blob)

			createDownloadLink(blobUrl, fileName, options?.target)

			setTimeout(() => {
				window.URL.revokeObjectURL(blobUrl)
			}, 100)

			return { success: true }
		}
	} catch (error) {
		console.error("Fetch download failed:", error)

		// Check if it's a timeout or network error
		if (error instanceof Error) {
			if (error.name === "AbortError") {
				return {
					success: false,
					message: t("DownloadTimeout", { ns: "message" }) || "Download timeout",
				}
			}
			if (error.message.includes("CORS") || error.message.includes("cross-origin")) {
				return {
					success: false,
					message:
						t("CrossOriginError", { ns: "message" }) || "Cross-origin download blocked",
				}
			}
		}

		// Fallback to direct download for other errors
		try {
			createDownloadLink(url, fileName, options?.target)
			return {
				success: true,
				fallback: true,
				message: "Used fallback download method",
			}
		} catch (fallbackError) {
			return {
				success: false,
				message: t("DownloadFailed", { ns: "message" }),
			}
		}
	}
}

/**
 * 下载文件
 * @param url - 文件路径
 * @param name - 文件名(可选)
 * @param ext - 文件扩展名(可选)
 * @param options - 下载选项
 */
export const downloadFile = async (
	url?: string,
	name?: string,
	ext?: string,
	options: DownloadOptions = {},
) => {
	if (!url) {
		return {
			success: false,
			message: t("FileNotFound", { ns: "message" }),
		}
	}

	try {
		const extension = ext ?? (await getFileExtension(url))?.ext ?? ""
		const fileName = ensureFileExtension(name || "download", extension)
		const { forceProxy = false } = options

		// 对于 Blob 链接,直接下载
		if (url.match(/^blob:/i)) {
			createDownloadLink(url, fileName, options?.target)
			return { success: true }
		}

		// 对于跨域资源或强制使用代理下载的情况，使用 fetch 方式
		if (forceProxy || isCrossOrigin(url)) {
			return await downloadWithFetch(url, fileName, options)
		}

		// 对于同源资源，使用直接下载方式
		createDownloadLink(url, fileName, options?.target)
		return { success: true }
	} catch (error) {
		console.error("Download failed:", error)
		return {
			success: false,
			message: t("DownloadFailed", { ns: "message" }),
		}
	}
}

/**
 * sha1
 * @param content - 内容
 * @returns sha1
 */
async function sha1(content: ArrayBuffer | ArrayBufferView): Promise<Uint8Array> {
	const hashBuffer = await crypto.subtle.digest("SHA-1", content)
	return new Uint8Array(hashBuffer)
}

/**
 * 获取文件etag
 * @param file - 文件对象
 * @returns 文件etag
 */
export async function getFileEtag(file: Blob) {
	const buffer = await new Promise<Uint8Array>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			// @ts-ignore
			resolve(new Uint8Array(reader.result))
		}
		reader.onerror = () => {
			reject(reader.error)
		}
		reader.readAsArrayBuffer(file)
	})

	// 以4M为单位分割
	const blockSize = 4 * 1024 * 1024
	const sha1String: Uint8Array[] = []
	let prefix = 0x16
	let blockCount = 0

	const bufferSize = buffer.length
	blockCount = Math.ceil(bufferSize / blockSize)

	for (let i = 0; i < blockCount; i += 1) {
		const blockBuffer = buffer.slice(i * blockSize, (i + 1) * blockSize)
		sha1String.push(await sha1(blockBuffer))
	}

	let length = 0
	sha1String.forEach((item) => {
		length += item.length
	})
	let sha1Buffer: Uint8Array = new Uint8Array(length)
	let offset = 0
	sha1String.forEach((item) => {
		sha1Buffer.set(item, offset)
		offset += item.length
	})

	// 如果大于4M，则对各个块的sha1结果再次sha1
	if (blockCount > 1) {
		prefix = 0x96
		sha1Buffer = await sha1(sha1Buffer)
	}

	sha1Buffer = new Uint8Array([...new Uint8Array([prefix]), ...sha1Buffer])

	return safeBinaryToBtoa(sha1Buffer).replace(/\//g, "_").replace(/\+/g, "-")
}
