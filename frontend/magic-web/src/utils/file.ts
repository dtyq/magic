import { t } from "i18next"
import type { FileTypeResult } from "file-type"
import { fileTypeFromStream } from "file-type"
import { IMAGE_EXTENSIONS } from "@/const/file"
import { safeBinaryToBtoa } from "@/utils/encoding"

const fileExtCache = new Map<string | File, FileTypeResult | undefined>()

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
 * 下载文件
 * @param url - 文件路径
 * @param name - 文件名(可选)
 */
export const downloadFile = async (url?: string, name?: string, ext?: string) => {
	if (!url)
		return {
			success: false,
			message: t("FileNotFound", { ns: "message" }),
		}

	try {
		const extension = ext ?? (await getFileExtension(url))?.ext ?? ""

		// 对于 Blob 链接,直接下载
		if (url.match(/^blob:/i)) {
			const fileName = ensureFileExtension(name || "download", extension)
			const link = document.createElement("a")
			link.href = url
			link.download = encodeURIComponent(fileName)
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			return { success: true }
		}

		// 对于图片文件,使用 fetch 下载
		if (IMAGE_EXTENSIONS.includes(extension)) {
			const blob =
				extension === "svg"
					? new File([url], name || "download.svg", { type: "image/svg+xml" })
					: await (await fetch(url)).blob()
			const downloadUrl = window.URL.createObjectURL(blob)
			const link = document.createElement("a")
			link.href = downloadUrl
			// 如果没有提供文件名,从 URL 中提取，并确保有扩展名
			const fileName = ensureFileExtension(name || "download", extension)
			link.download = encodeURIComponent(fileName)
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			window.URL.revokeObjectURL(downloadUrl)
			return { success: true }
		}

		// 对于其他文件使用原来的方式
		const fileName = ensureFileExtension(name || "download", extension)
		const link = document.createElement("a")
		link.href = url
		link.download = encodeURIComponent(fileName)

		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		return { success: true }
	} catch (error) {
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
