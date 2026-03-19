import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { transformUniverToExcel } from "./utils-export"
import { transformUniverToDocx } from "./utils-export-docx"
import { transformFileToDocData } from "./utils-data-docs"
import { UniverWorkerManager } from "./UniverWorkerManager"
import { SupportedFileOutputModeMap } from "./types"

/**
 * 将 base64 字符串转换为 ArrayBuffer（参考 UniverViewer）
 */
const stringToBuffer = (string: string) => {
	const binary = atob(string)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes.buffer
}

/**
 * 判断文件扩展名类型
 */
function getFileTypeByExtension(extension: string): "excel" | "docx" | "unknown" {
	const ext = extension.toLowerCase()
	if (["xlsx", "xls", "csv"].includes(ext)) {
		return "excel"
	}
	if (["docx", "doc"].includes(ext)) {
		return "docx"
	}
	return "unknown"
}

/**
 * 根据文件 ID 和扩展名下载 Univer 文件（Excel 或 Docx）
 * 会自动获取文件数据，解析，然后重新导出为正确的格式
 */
export async function downloadUniverFile(params: {
	fileId: string
	fileName: string
	fileExtension: string
}): Promise<void> {
	const { fileId, fileName, fileExtension } = params
	const fileType = getFileTypeByExtension(fileExtension)

	if (fileType === "unknown") {
		// 如果不是 Univer 支持的文件类型，直接使用原始下载
		const res = await getTemporaryDownloadUrl({ file_ids: [fileId] })
		if (res[0]?.url) {
			downloadFileWithAnchor(res[0].url)
		}
		return
	}

	try {
		// 1. 获取文件下载 URL
		const res = await getTemporaryDownloadUrl({ file_ids: [fileId] })
		if (!res[0]?.url) {
			throw new Error("无法获取文件下载链接")
		}

		const fileUrl = res[0].url

		// 2. 下载文件数据
		const response = await fetch(fileUrl)
		if (!response.ok) {
			throw new Error(`下载文件失败: ${response.statusText}`)
		}

		const arrayBuffer = await response.arrayBuffer()

		// 3. 解析文件数据（参考 UniverViewer 的逻辑）
		let finalBuffer: ArrayBuffer

		// ✅ 步骤1：优先检查 ZIP 文件头（Excel/Docx 都是 ZIP 格式）
		if (arrayBuffer.byteLength >= 4) {
			const view = new DataView(arrayBuffer, 0, 4)
			const signature = view.getUint32(0, true)

			// ZIP 文件魔数: 0x504b0304 (PK\x03\x04)
			if (signature === 0x04034b50) {
				console.log("✅ [downloadUniverFile] 检测到 ZIP 文件头，直接使用二进制数据")
				finalBuffer = arrayBuffer
			} else {
				// 不是 ZIP 文件，尝试 base64 解码
				console.log("🔄 [downloadUniverFile] 非 ZIP 文件，尝试 base64 解码")
				const text = new TextDecoder("utf-8").decode(arrayBuffer)
				const decodedBuffer = stringToBuffer(text)
				finalBuffer = decodedBuffer
				console.log("✅ [downloadUniverFile] base64 解码成功")
			}
		} else {
			// 数据太小，直接使用
			finalBuffer = arrayBuffer
		}

		// 4. 将 ArrayBuffer 转换为 File 对象
		const mimeType =
			fileType === "excel"
				? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
				: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

		const file = new File([finalBuffer], fileName, { type: mimeType })

		// 5. 根据文件类型解析并重新导出
		if (fileType === "excel") {
			await downloadExcelFile(file, fileName)
		} else if (fileType === "docx") {
			await downloadDocxFile(file, fileName)
		}
	} catch (error) {
		console.error("[downloadUniverFile] 下载失败:", error)
		throw error
	}
}

/**
 * 下载 Excel 文件
 */
async function downloadExcelFile(file: File, fileName: string): Promise<void> {
	const workerManager = new UniverWorkerManager()

	try {
		// 1. 使用 Worker 解析 Excel 数据（与 UniverRenderer 中的逻辑一致）
		const workbookData = await workerManager.transformData(file, fileName, true)

		if (!workbookData) {
			throw new Error("解析 Excel 数据失败")
		}

		console.log("🚀 [downloadExcelFile] workbookData", workbookData)
		// 2. 重新导出为 Excel（使用 json 模式，因为 workbookData 是 JSON 对象）
		await transformUniverToExcel({
			mode: SupportedFileOutputModeMap.json,
			snapshot: workbookData,
			fileName: fileName || `export_${new Date().getTime()}.xlsx`,
		})
	} catch (error) {
		console.error("[downloadExcelFile] 下载失败:", error)
		throw error
	} finally {
		// 清理 Worker
		workerManager.dispose()
	}
}

/**
 * 下载 Docx 文件
 */
async function downloadDocxFile(file: File, fileName: string): Promise<void> {
	try {
		// 1. 解析 Docx 数据（与 UniverRenderer 中的逻辑一致）
		const docData = await transformFileToDocData(file)

		if (!docData) {
			throw new Error("解析 Docx 数据失败")
		}

		// 2. 重新导出为 Docx（使用 json 模式，因为 docData 是 JSON 对象）
		await transformUniverToDocx({
			docData: docData,
			mode: SupportedFileOutputModeMap.json,
			fileName: fileName || `export_${new Date().getTime()}.docx`,
		})
	} catch (error) {
		console.error("[downloadDocxFile] 下载失败:", error)
		throw error
	}
}
