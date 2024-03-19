import { getExtensions, loadEditorApi } from "./utils"
import { g_sEmpty_bin } from "./empty_bin"
import { getDocmentObj } from "./document-state"
import { editorManager, editorManagerFactory, EditorManager } from "./editor-manager"
import {
	ONLYOFFICE_RESOURCE,
	ONLYOFFICE_EVENT_KEYS,
	ONLYOFFICE_CONTAINER_CONFIG,
	READONLY_TIMEOUT_CONFIG,
	ONLYOFFICE_LANG_KEY,
	ONLYOFFICE_CACHE_FILE,
	ONLYOFFICE_INDEXEDDB_NAME,
} from "./const"
import { onlyofficeEventbus } from "./eventbus"

declare global {
	interface Window {
		Module: EmscriptenModule
		x2tConverter?: X2TConverter
	}
}

// types/x2t.d.ts - 类型定义文件
interface EmscriptenFileSystem {
	mkdir(path: string): void
	readdir(path: string): string[]
	readFile(path: string, options?: { encoding: "binary" }): BlobPart
	writeFile(path: string, data: Uint8Array | string): void
}

interface EmscriptenModule {
	FS: EmscriptenFileSystem
	ccall: (funcName: string, returnType: string, argTypes: string[], args: any[]) => number
	onRuntimeInitialized: () => void
}

interface ConversionResult {
	fileName: string
	type: DocumentType
	bin: BlobPart
	media: Record<string, string>
}

interface BinConversionResult {
	fileName: string
	data: BlobPart
}

type DocumentType = "word" | "cell" | "slide"

/**
 * X2T 工具类 - 负责文档转换功能
 */
class X2TConverter {
	private x2tModule: EmscriptenModule | null = null
	private isReady = false
	private initPromise: Promise<EmscriptenModule> | null = null
	private hasScriptLoaded = false

	// 支持的文件类型映射
	private readonly DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
		docx: "word",
		doc: "word",
		odt: "word",
		rtf: "word",
		txt: "word",
		xlsx: "cell",
		xls: "cell",
		ods: "cell",
		csv: "cell",
		pptx: "slide",
		ppt: "slide",
		odp: "slide",
	}

	private readonly WORKING_DIRS = [
		"/working",
		"/working/media",
		"/working/fonts",
		"/working/themes",
	]
	private readonly SCRIPT_PATH = ONLYOFFICE_RESOURCE.X2T
	private dbName = ONLYOFFICE_INDEXEDDB_NAME
	private dbVersion = 1
	private db: IDBDatabase | null = null

	/**
	 * 初始化 IndexedDB
	 */
	private async initDB(): Promise<IDBDatabase> {
		if (this.db) {
			return this.db
		}

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion)

			request.onerror = () => {
				reject(new Error("Failed to open IndexedDB"))
			}

			request.onsuccess = () => {
				this.db = request.result
				resolve(this.db)
			}

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result
				if (!db.objectStoreNames.contains("wasm-cache")) {
					db.createObjectStore("wasm-cache", { keyPath: "url" })
				}
			}
		})
	}

	/**
	 * 从 IndexedDB 获取缓存的 WASM 文件
	 */
	private async getCachedWasm(url: string): Promise<ArrayBuffer | null> {
		try {
			const db = await this.initDB()
			return new Promise((resolve, reject) => {
				const transaction = db.transaction(["wasm-cache"], "readonly")
				const store = transaction.objectStore("wasm-cache")
				const request = store.get(url)

				request.onsuccess = () => {
					const result = request.result
					if (result && result.data) {
						resolve(result.data)
					} else {
						resolve(null)
					}
				}

				request.onerror = () => {
					resolve(null)
				}
			})
		} catch (error) {
			console.warn("Failed to get cached WASM:", error)
			return null
		}
	}

	/**
	 * 将 WASM 文件缓存到 IndexedDB
	 */
	private async cacheWasm(url: string, data: ArrayBuffer): Promise<void> {
		try {
			const db = await this.initDB()
			return new Promise((resolve, reject) => {
				const transaction = db.transaction(["wasm-cache"], "readwrite")
				const store = transaction.objectStore("wasm-cache")
				const request = store.put({ url, data, timestamp: Date.now() })

				request.onsuccess = () => {
					resolve()
				}

				request.onerror = () => {
					reject(new Error("Failed to cache WASM"))
				}
			})
		} catch (error) {
			console.warn("Failed to cache WASM:", error)
		}
	}

	/**
	 * 拦截 fetch，缓存 WASM 文件到 IndexedDB
	 */
	private interceptFetch(): void {
		if (
			typeof window === "undefined" ||
			!window.fetch ||
			(window.fetch as any).__wasmIntercepted
		) {
			return
		}

		const originalFetch = window.fetch

		window.fetch = async function (
			input: RequestInfo | URL,
			init?: RequestInit,
		): Promise<Response> {
			let url: string

			if (typeof input === "string") {
				url = input
			} else if (input instanceof URL) {
				url = input.href
			} else if (input instanceof Request) {
				url = input.url
			} else {
				return originalFetch(input, init)
			}

			// 拦截所有 WASM 文件请求
			const cacheConfig = ONLYOFFICE_CACHE_FILE.find((file: any) => {
				if (typeof file.url === "string") {
					return url.includes(file.url)
				} else if (file.url instanceof RegExp) {
					return file.url.test(url)
				}
				return false
			})

			if (cacheConfig) {
				// 调用 event 函数处理 URL，获取压缩版本
				const { fetchUrl, isCompressed, compressionType } = cacheConfig.event(url)

				// 先尝试从缓存读取（使用原始 URL 作为缓存 key）
				const cached = await (this as any).getCachedWasm(url)
				if (cached) {
					console.log("onlyoffice: Loading WASM from IndexedDB cache:", url)
					return new Response(cached, {
						headers: { "Content-Type": "application/wasm" },
					})
				}

				// 缓存未命中，从网络加载
				console.log(
					"onlyoffice: Loading WASM from network:",
					fetchUrl,
					isCompressed ? `(${compressionType})` : "",
				)

				// 构建请求：如果 URL 不同则构建新请求，否则使用原请求
				const fetchInput =
					fetchUrl !== url
						? typeof input === "string"
							? fetchUrl
							: new Request(fetchUrl, input instanceof Request ? input : undefined)
						: input

				const response = await originalFetch(fetchInput, init)

				if (!response.ok) {
					return response
				}

				let arrayBuffer: ArrayBuffer

				// 检查是否需要手动解压
				// 如果响应头包含 Content-Encoding: gzip，浏览器会自动解压，我们不需要再解压
				const contentEncoding = response.headers.get("Content-Encoding")
				const needsManualDecompression =
					isCompressed && compressionType === "gzip" && !contentEncoding

				if (needsManualDecompression) {
					// 浏览器没有自动解压，我们需要手动解压
					console.log("onlyoffice: 📦 Manually decompressing...")
					const blob = await response.blob()
					const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"))
					arrayBuffer = await new Response(stream).arrayBuffer()
					console.log(
						"onlyoffice: ✅ Decompressed:",
						blob.size,
						"→",
						arrayBuffer.byteLength,
						"bytes",
					)
				} else {
					// 浏览器已自动解压或文件本身未压缩
					if (contentEncoding) {
						console.log(
							"onlyoffice: ✅ Browser auto-decompressed (Content-Encoding:",
							contentEncoding + ")",
						)
					}
					arrayBuffer = await response.arrayBuffer()
				}

				// 缓存到 IndexedDB（使用原始 URL 作为 key，存储解压后的数据）
				;(this as any).cacheWasm(url, arrayBuffer).catch((err: any) => {
					console.warn("Failed to cache WASM:", err)
				})

				return new Response(arrayBuffer, {
					status: response.status,
					statusText: response.statusText,
					headers: { "Content-Type": "application/wasm" },
				})
			}

			return originalFetch(input, init)
		}.bind(this) as typeof fetch
		;(window.fetch as any).__wasmIntercepted = true
	}

	/**
	 * 加载 X2T 脚本文件
	 */
	async loadScript(): Promise<void> {
		if (this.hasScriptLoaded) return

		// 拦截 fetch，缓存 WASM 文件到 IndexedDB
		this.interceptFetch()

		return new Promise((resolve, reject) => {
			const script = document.createElement("script")
			script.id = "onlyoffice-script-x2t"
			script.src = this.SCRIPT_PATH
			script.onload = () => {
				this.hasScriptLoaded = true
				console.log("X2T WASM script loaded successfully")
				resolve()
			}

			script.onerror = (error) => {
				const errorMsg = "Failed to load X2T WASM script"
				console.error(errorMsg, error)
				reject(new Error(errorMsg))
			}

			document.head.appendChild(script)
		})
	}

	/**
	 * 初始化 X2T 模块
	 */
	async initialize(): Promise<EmscriptenModule> {
		if (this.isReady && this.x2tModule) {
			return this.x2tModule
		}

		// 防止重复初始化
		if (this.initPromise) {
			return this.initPromise
		}

		this.initPromise = this.doInitialize()
		return this.initPromise
	}

	private async doInitialize(): Promise<EmscriptenModule> {
		try {
			await this.loadScript()
			return new Promise((resolve, reject) => {
				const x2t = window.Module
				if (!x2t) {
					reject(new Error("X2T module not found after script loading"))
					return
				}

				// 设置超时处理
				const timeoutId = setTimeout(() => {
					if (!this.isReady) {
						reject(
							new Error(
								`X2T initialization timeout after ${READONLY_TIMEOUT_CONFIG.X2T_INIT}ms`,
							),
						)
					}
				}, READONLY_TIMEOUT_CONFIG.X2T_INIT)

				x2t.onRuntimeInitialized = () => {
					try {
						clearTimeout(timeoutId)
						this.createWorkingDirectories(x2t)
						this.x2tModule = x2t
						this.isReady = true
						console.log("X2T module initialized successfully")
						resolve(x2t)
					} catch (error) {
						reject(error)
					}
				}
			})
		} catch (error) {
			this.initPromise = null // 重置以允许重试
			throw error
		}
	}

	/**
	 * 创建工作目录
	 */
	private createWorkingDirectories(x2t: EmscriptenModule): void {
		this.WORKING_DIRS.forEach((dir) => {
			try {
				x2t.FS.mkdir(dir)
			} catch (error) {
				// 目录可能已存在，忽略错误
				console.warn(`Directory ${dir} may already exist:`, error)
			}
		})
	}

	/**
	 * 获取文档类型
	 */
	private getDocumentType(extension: string): DocumentType {
		const docType = this.DOCUMENT_TYPE_MAP[extension.toLowerCase()]
		if (!docType) {
			throw new Error(`Unsupported file format: ${extension}`)
		}
		return docType
	}

	/**
	 * 清理文件名
	 */
	private sanitizeFileName(input: string): string {
		if (typeof input !== "string" || !input.trim()) {
			return "file.bin"
		}

		const parts = input.split(".")
		const ext = parts.pop() || "bin"
		const name = parts.join(".")

		const illegalChars = /[/?<>\\:*|"]/g
		// eslint-disable-next-line no-control-regex
		const controlChars = /[\x00-\x1f\x80-\x9f]/g
		const reservedPattern = /^\.+$/
		const unsafeChars = /[&'%!"{}[\]]/g

		let sanitized = name
			.replace(illegalChars, "")
			.replace(controlChars, "")
			.replace(reservedPattern, "")
			.replace(unsafeChars, "")

		sanitized = sanitized.trim() || "file"
		return `${sanitized.slice(0, 200)}.${ext}` // 限制长度
	}

	/**
	 * 执行文档转换
	 */
	private executeConversion(paramsPath: string): void {
		if (!this.x2tModule) {
			throw new Error("X2T module not initialized")
		}

		const result = this.x2tModule.ccall("main1", "number", ["string"], [paramsPath])
		if (result !== 0) {
			throw new Error(`Conversion failed with code: ${result}`)
		}
	}

	/**
	 * 创建转换参数 XML
	 */
	private createConversionParams(
		fromPath: string,
		toPath: string,
		additionalParams = "",
	): string {
		return `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFileFrom>${fromPath}</m_sFileFrom>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileTo>${toPath}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
  ${additionalParams}
</TaskQueueDataConvert>`
	}

	/**
	 * 读取媒体文件
	 */
	private readMediaFiles(): Record<string, string> {
		if (!this.x2tModule) return {}

		const media: Record<string, string> = {}

		try {
			const files = this.x2tModule.FS.readdir("/working/media/")

			files
				.filter((file) => file !== "." && file !== "..")
				.forEach((file) => {
					try {
						const fileData = this.x2tModule!.FS.readFile(`/working/media/${file}`, {
							encoding: "binary",
						}) as BlobPart

						const blob = new Blob([fileData])
						const mediaUrl = window.URL.createObjectURL(blob)
						media[`media/${file}`] = mediaUrl
					} catch (error) {
						console.warn(`Failed to read media file ${file}:`, error)
					}
				})
		} catch (error) {
			console.warn("Failed to read media directory:", error)
		}

		return media
	}

	/**
	 * 加载 xlsx 库（SheetJS）
	 */
	private async loadXlsxLibrary(): Promise<any> {
		// 检查是否已经加载
		if (typeof window !== "undefined" && (window as any).XLSX) {
			return (window as any).XLSX
		}

		return new Promise((resolve, reject) => {
			const script = document.createElement("script")
			script.src = ONLYOFFICE_RESOURCE.XLSX
			script.onload = () => {
				if (typeof window !== "undefined" && (window as any).XLSX) {
					resolve((window as any).XLSX)
				} else {
					reject(new Error("Failed to load xlsx library"))
				}
			}
			script.onerror = () => {
				reject(new Error("Failed to load xlsx library from local file"))
			}
			document.head.appendChild(script)
		})
	}

	/**
	 * 分块解析 CSV 行（处理引号内的换行符）
	 */
	private parseCsvLines(
		csvText: string,
		startIndex: number,
		maxLines: number,
	): { lines: string[]; nextIndex: number } {
		const lines: string[] = []
		let currentIndex = startIndex
		let inQuotes = false
		let lineStart = startIndex
		let lineCount = 0

		while (currentIndex < csvText.length && lineCount < maxLines) {
			const char = csvText[currentIndex]
			const nextChar = currentIndex + 1 < csvText.length ? csvText[currentIndex + 1] : ""

			if (char === '"') {
				// 处理转义的引号 ""
				if (nextChar === '"') {
					currentIndex += 2
					continue
				}
				// 切换引号状态
				inQuotes = !inQuotes
			} else if (char === "\n" && !inQuotes) {
				// 找到行尾（不在引号内）
				const line = csvText.substring(lineStart, currentIndex)
				lines.push(line)
				lineCount++
				lineStart = currentIndex + 1
			} else if (char === "\r" && nextChar === "\n" && !inQuotes) {
				// 处理 Windows 换行符 \r\n
				const line = csvText.substring(lineStart, currentIndex)
				lines.push(line)
				lineCount++
				currentIndex++ // 跳过 \r
				lineStart = currentIndex + 1
			}

			currentIndex++
		}

		// 处理文件末尾：如果还有未处理的内容，且不在引号内，添加最后一行
		if (lineStart < csvText.length && currentIndex >= csvText.length && !inQuotes) {
			const lastLine = csvText.substring(lineStart)
			if (lastLine.trim().length > 0) {
				lines.push(lastLine)
			}
			lineStart = csvText.length
		}

		return { lines, nextIndex: lineStart }
	}

	/**
	 * 使用 SheetJS 库将 CSV 转换为 XLSX 格式（分块处理）
	 * 这是解决 x2t 不支持直接转换 CSV 的变通方法
	 */
	private async convertCsvToXlsx(csvData: Uint8Array, fileName: string): Promise<File> {
		try {
			// 加载 xlsx 库
			const XLSX = await this.loadXlsxLibrary()

			const fileSizeMB = csvData.length / 1024 / 1024
			console.log(
				"onlyoffice: Converting CSV to XLSX, file size:",
				fileSizeMB.toFixed(2),
				"MB",
			)

			// 移除 UTF-8 BOM（如果存在）
			let csvText: string
			if (
				csvData.length >= 3 &&
				csvData[0] === 0xef &&
				csvData[1] === 0xbb &&
				csvData[2] === 0xbf
			) {
				csvText = new TextDecoder("utf-8").decode(csvData.slice(3))
			} else {
				// 先尝试 UTF-8，如果失败则回退到其他编码
				try {
					csvText = new TextDecoder("utf-8").decode(csvData)
				} catch {
					csvText = new TextDecoder("latin1").decode(csvData)
				}
			}

			const totalLength = csvText.length
			console.log("onlyoffice: CSV text length:", totalLength, "characters")

			// 检查是否需要分块处理
			const estimatedLines = (csvText.match(/\n/g) || []).length + 1
			const CHUNK_SIZE = 100000 // 每次处理 10 万行
			const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024 // 50MB

			// 检查是否有超长行（可能包含超长单元格）
			const lines = csvText.split(/\r?\n/)
			const hasLongLines = lines.some((line) => line.length > this.MAX_CELL_LENGTH)

			const needsChunking =
				csvData.length > LARGE_FILE_THRESHOLD || estimatedLines > CHUNK_SIZE || hasLongLines

			if (hasLongLines) {
				console.log(
					"onlyoffice: CSV contains lines exceeding cell length limit, using chunk processing",
				)
			}

			let workbook: any

			if (needsChunking) {
				console.log(
					"onlyoffice: Large CSV detected, using chunk processing. Estimated lines:",
					estimatedLines,
				)

				// 分块处理
				workbook = XLSX.utils.book_new()
				const worksheet = XLSX.utils.aoa_to_sheet([]) // 创建空工作表

				let currentIndex = 0
				let isFirstChunk = true
				let headers: string[] = []

				while (currentIndex < csvText.length) {
					// 解析一块数据
					const { lines, nextIndex } = this.parseCsvLines(
						csvText,
						currentIndex,
						CHUNK_SIZE,
					)

					// 如果没有解析到行，且已经到达文件末尾，退出循环
					if (lines.length === 0 && nextIndex >= csvText.length) {
						break
					}

					// 解析 CSV 行（处理引号和逗号）
					const rows: any[][] = []
					for (const line of lines) {
						if (line.trim() === "") continue // 跳过空行

						const row = this.parseCsvRow(line)
						if (row.length > 0) {
							// 确保所有单元格文本都符合 Excel 限制
							const sanitizedRow = row.map((cell) => {
								if (
									typeof cell === "string" &&
									cell.length > this.MAX_CELL_LENGTH
								) {
									return this.truncateCellText(cell)
								}
								return cell
							})
							rows.push(sanitizedRow)
						}
					}

					// 如果有数据行，添加到工作表
					if (rows.length > 0) {
						// 第一块：提取表头
						if (isFirstChunk) {
							headers = rows[0]
							XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" })
							isFirstChunk = false

							// 如果有数据行，继续处理
							if (rows.length > 1) {
								const dataRows = rows.slice(1)
								const lastRow =
									XLSX.utils.decode_range(worksheet["!ref"] || "A1").e.r + 1
								XLSX.utils.sheet_add_aoa(worksheet, dataRows, {
									origin: `A${lastRow + 1}`,
								})
							}
						} else {
							// 后续块：直接添加数据
							const lastRow =
								XLSX.utils.decode_range(worksheet["!ref"] || "A1").e.r + 1
							XLSX.utils.sheet_add_aoa(worksheet, rows, { origin: `A${lastRow + 1}` })
						}
					}

					// 如果已经到达文件末尾，退出循环
					if (nextIndex >= csvText.length) {
						break
					}

					currentIndex = nextIndex

					// 更新进度
					const progress = ((currentIndex / totalLength) * 100).toFixed(1)
					console.log(`onlyoffice: Processed ${progress}% of CSV file`)
				}

				XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
				console.log("onlyoffice: CSV chunk processing complete")
			} else {
				// 小文件：直接处理
				console.log("onlyoffice: Small CSV file, processing directly")
				try {
					workbook = XLSX.read(csvText, {
						type: "string",
						raw: false,
						dense: false,
					})

					// 检查并修复超长单元格
					const sheetNames = workbook.SheetNames
					for (const sheetName of sheetNames) {
						const worksheet = workbook.Sheets[sheetName]
						const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")

						for (let row = range.s.r; row <= range.e.r; row++) {
							for (let col = range.s.c; col <= range.e.c; col++) {
								const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
								const cell = worksheet[cellAddress]

								if (
									cell &&
									cell.v &&
									typeof cell.v === "string" &&
									cell.v.length > this.MAX_CELL_LENGTH
								) {
									console.warn(
										`onlyoffice: Truncating cell ${cellAddress}, length: ${cell.v.length}`,
									)
									cell.v = this.truncateCellText(cell.v)
									// 更新 t 类型为字符串
									cell.t = "s"
								}
							}
						}
					}
				} catch (directError: any) {
					// 如果直接处理失败（可能是超长单元格问题），记录错误
					const errorMsg = directError.message || String(directError)
					if (errorMsg.includes("32767") || errorMsg.includes("Text length")) {
						console.warn(
							"onlyoffice: Direct processing failed due to cell length limit:",
							errorMsg,
						)
						throw new Error(
							`CSV 文件包含超过 32767 字符的单元格。` +
								`Excel 单元格最大文本长度为 32767 字符。` +
								`请使用分块处理模式或检查 CSV 文件中的数据。`,
						)
					}
					throw directError
				}
			}

			// 转换为 XLSX 二进制格式
			console.log("onlyoffice: Writing XLSX file...")
			const xlsxBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
			console.log("onlyoffice: XLSX conversion complete, size:", xlsxBuffer.length, "bytes")

			// 创建 File 对象
			const xlsxFileName = fileName.replace(/\.csv$/i, ".xlsx")
			return new File([xlsxBuffer], xlsxFileName, {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			console.error("onlyoffice: CSV to XLSX conversion failed:", errorMessage)

			// 检查是否是 "Invalid array length" 错误
			if (
				errorMessage.includes("Invalid array length") ||
				errorMessage.includes("array length")
			) {
				throw new Error(`CSV 文件过大，无法转换为 XLSX 格式。`)
			}

			throw new Error(
				`Failed to convert CSV to XLSX: ${errorMessage}. ` +
					"Please ensure your CSV file is properly formatted and not too large, " +
					"or convert it to XLSX format manually and try again.",
			)
		}
	}

	/**
	 * Excel 单元格最大文本长度限制
	 */
	private readonly MAX_CELL_LENGTH = 32767

	/**
	 * 截断文本以符合 Excel 单元格长度限制
	 */
	private truncateCellText(text: string): string {
		if (text.length <= this.MAX_CELL_LENGTH) {
			return text
		}
		// 截断并添加提示信息
		const truncated = text.substring(0, this.MAX_CELL_LENGTH - 50)
		return truncated + "\n...[文本已截断，原始长度: " + text.length + " 字符]"
	}

	/**
	 * 解析 CSV 行（处理引号和逗号）
	 */
	private parseCsvRow(line: string): string[] {
		const result: string[] = []
		let current = ""
		let inQuotes = false

		for (let i = 0; i < line.length; i++) {
			const char = line[i]
			const nextChar = i + 1 < line.length ? line[i + 1] : ""

			if (char === '"') {
				if (inQuotes && nextChar === '"') {
					// 转义的引号
					current += '"'
					i++ // 跳过下一个引号
				} else {
					// 切换引号状态
					inQuotes = !inQuotes
				}
			} else if (char === "," && !inQuotes) {
				// 字段分隔符（不在引号内）
				// 检查并截断超长文本
				result.push(this.truncateCellText(current))
				current = ""
			} else {
				current += char
			}
		}

		// 添加最后一个字段（检查并截断）
		result.push(this.truncateCellText(current))
		return result
	}

	/**
	 * 将文档转换为 bin 格式
	 */
	async convertDocument(file: File): Promise<ConversionResult> {
		await this.initialize()

		const fileName = file.name
		const fileExt = getExtensions(file?.type)[0] || fileName.split(".").pop() || ""
		const documentType = this.getDocumentType(fileExt)

		try {
			// 读取文件内容
			const arrayBuffer = await file.arrayBuffer()
			const data = new Uint8Array(arrayBuffer)

			// 处理 CSV 文件 - x2t 可能不支持直接转换 CSV，所以先转换为 XLSX
			if (fileExt.toLowerCase() === "csv") {
				if (data.length === 0) {
					throw new Error("CSV file is empty")
				}

				// 检测文件实际格式：XLSX 文件是 ZIP 格式，文件头是 PK (0x50 0x4B)
				// 如果文件实际上是 XLSX/ZIP 格式，直接按 XLSX 处理
				const isZipFormat = data.length >= 2 && data[0] === 0x50 && data[1] === 0x4b

				if (isZipFormat) {
					console.log(
						"onlyoffice: File has .csv extension but is actually XLSX/ZIP format, treating as XLSX",
					)
					// 按 XLSX 文件处理
					const sanitizedName = this.sanitizeFileName(
						fileName.replace(/\.csv$/i, ".xlsx"),
					)
					const inputPath = `/working/${sanitizedName}`
					const outputPath = `${inputPath}.bin`

					// 将 XLSX 文件写入虚拟文件系统
					this.x2tModule!.FS.writeFile(inputPath, data)

					// 创建转换参数
					const params = this.createConversionParams(inputPath, outputPath, "")
					this.x2tModule!.FS.writeFile("/working/params.xml", params)

					// 执行转换
					this.executeConversion("/working/params.xml")

					// 读取转换结果
					const result = this.x2tModule!.FS.readFile(outputPath)
					const media = this.readMediaFiles()

					return {
						fileName: this.sanitizeFileName(fileName),
						type: documentType,
						bin: result,
						media,
					}
				}

				console.log("onlyoffice: CSV file detected. Converting to XLSX format...")
				console.log("onlyoffice: CSV file size:", data.length, "bytes")

				// 先将 CSV 转换为 XLSX
				try {
					const xlsxFile = await this.convertCsvToXlsx(data, fileName)
					console.log("CSV converted to XLSX, now converting with x2t...")

					// 现在使用 x2t 转换 XLSX 文件
					const xlsxArrayBuffer = await xlsxFile.arrayBuffer()
					const xlsxData = new Uint8Array(xlsxArrayBuffer)

					// 使用 XLSX 文件进行转换
					const sanitizedName = this.sanitizeFileName(xlsxFile.name)
					const inputPath = `/working/${sanitizedName}`
					const outputPath = `${inputPath}.bin`

					// 将 XLSX 文件写入虚拟文件系统
					this.x2tModule!.FS.writeFile(inputPath, xlsxData)

					// 创建转换参数 - XLSX 不需要特殊参数
					const params = this.createConversionParams(inputPath, outputPath, "")
					this.x2tModule!.FS.writeFile("/working/params.xml", params)

					// 执行转换
					this.executeConversion("/working/params.xml")

					// 读取转换结果
					const result = this.x2tModule!.FS.readFile(outputPath)
					const media = this.readMediaFiles()

					// 返回原始 CSV 文件名，而不是 XLSX 文件名
					return {
						fileName: this.sanitizeFileName(fileName), // 保持原始 CSV 文件名
						type: documentType,
						bin: result,
						media,
					}
				} catch (conversionError: any) {
					// 如果转换失败，提供有用的错误信息
					throw new Error(
						`Failed to convert CSV file: ${
							conversionError?.message || "Unknown error"
						}. ` + "Please ensure your CSV file is properly formatted and try again.",
					)
				}
			}

			// 对于所有其他文件类型，使用标准转换
			const sanitizedName = this.sanitizeFileName(fileName)
			const inputPath = `/working/${sanitizedName}`
			const outputPath = `${inputPath}.bin`

			// 写入文件到虚拟文件系统
			this.x2tModule!.FS.writeFile(inputPath, data)

			// 创建转换参数 - 非 CSV 文件不需要特殊参数
			const params = this.createConversionParams(inputPath, outputPath, "")
			this.x2tModule!.FS.writeFile("/working/params.xml", params)

			// 执行转换
			this.executeConversion("/working/params.xml")

			// 读取转换结果
			const result = this.x2tModule!.FS.readFile(outputPath)
			const media = this.readMediaFiles()

			return {
				fileName: sanitizedName,
				type: documentType,
				bin: result,
				media,
			}
		} catch (error) {
			throw new Error(
				`Document conversion failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			)
		}
	}

	/**
	 * 将 bin 格式转换为指定格式（仅转换，不下载）
	 */
	async convertBinToDocument(
		bin: Uint8Array,
		originalFileName: string,
		targetExt = "DOCX",
		media?: Record<string, string>,
	): Promise<BinConversionResult> {
		await this.initialize()

		const sanitizedBase = this.sanitizeFileName(originalFileName).replace(/\.[^/.]+$/, "")
		const binFileName = `${sanitizedBase}.bin`
		const outputFileName = `${sanitizedBase}.${targetExt.toLowerCase()}`

		try {
			// 如果有媒体文件，先将它们写入虚拟文件系统
			if (media && Object.keys(media).length > 0) {
				console.log(
					"📷 [X2T] Writing media files to virtual file system:",
					Object.keys(media).length,
				)

				for (const [key, url] of Object.entries(media)) {
					try {
						// 从 blob URL 获取文件数据
						const response = await fetch(url)
						const arrayBuffer = await response.arrayBuffer()
						const data = new Uint8Array(arrayBuffer)

						// 写入到虚拟文件系统 /working/media/
						const fileName = key.replace("media/", "")
						this.x2tModule!.FS.writeFile(`/working/media/${fileName}`, data)
						console.log(
							`✅ [X2T] Wrote media file: ${fileName}, size: ${data.byteLength} bytes`,
						)
					} catch (error) {
						console.error(`❌ [X2T] Failed to write media file ${key}:`, error)
					}
				}
			} else {
				console.log("⚠️ [X2T] No media files to write")
			}

			// 写入 bin 文件
			this.x2tModule!.FS.writeFile(`/working/${binFileName}`, bin)

			// 创建转换参数
			let additionalParams = "<m_sMediaDir>/working/media/</m_sMediaDir>"
			if (targetExt === "PDF") {
				additionalParams += "<m_sFontDir>/working/fonts/</m_sFontDir>"
			}

			const params = this.createConversionParams(
				`/working/${binFileName}`,
				`/working/${outputFileName}`,
				additionalParams,
			)

			this.x2tModule!.FS.writeFile("/working/params.xml", params)

			// 执行转换
			this.executeConversion("/working/params.xml")

			// 读取生成的文档
			const result = this.x2tModule!.FS.readFile(`/working/${outputFileName}`)

			// 确保 result 是 Uint8Array 类型
			const resultArray =
				result instanceof Uint8Array ? result : new Uint8Array(result as ArrayBuffer)

			return {
				fileName: outputFileName,
				data: resultArray,
			}
		} catch (error) {
			throw new Error(
				`Bin to document conversion failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			)
		}
	}

	/**
	 * 将 bin 格式转换为指定格式并下载
	 */
	async convertBinToDocumentAndDownload(
		bin: Uint8Array,
		fileName: string,
		targetExt = "DOCX",
		media?: Record<string, string>,
	): Promise<BinConversionResult> {
		// 先执行转换
		const result = await this.convertBinToDocument(bin, fileName, targetExt, media)

		// 确保 data 是 Uint8Array 类型
		const dataArray =
			result.data instanceof Uint8Array
				? result.data
				: new Uint8Array(result.data as ArrayBuffer)

		// 然后下载文件
		// TODO: 完善打印功能
		await this.saveWithFileSystemAPI(dataArray, result.fileName)

		return result
	}

	/**
	 * 下载文件
	 */
	private downloadFile(data: Uint8Array, fileName: string): void {
		const blob = new Blob([data as BlobPart])
		const url = window.URL.createObjectURL(blob)
		const link = document.createElement("a")

		link.href = url
		link.download = fileName
		link.style.display = "none"

		document.body.appendChild(link)
		link.click()

		// 清理资源
		setTimeout(() => {
			document.body.removeChild(link)
			window.URL.revokeObjectURL(url)
		}, 100)
	}

	/**
	 * 根据文件扩展名获取 MIME 类型
	 */
	private getMimeTypeFromExtension(extension: string): string {
		const mimeMap: Record<string, string> = {
			// 文档类型
			docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			doc: "application/msword",
			odt: "application/vnd.oasis.opendocument.text",
			rtf: "application/rtf",
			txt: "text/plain",
			pdf: "application/pdf",

			// 表格类型
			xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			xls: "application/vnd.ms-excel",
			ods: "application/vnd.oasis.opendocument.spreadsheet",
			csv: "text/csv",

			// 演示文稿类型
			pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
			ppt: "application/vnd.ms-powerpoint",
			odp: "application/vnd.oasis.opendocument.presentation",

			// 图片类型
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			bmp: "image/bmp",
			webp: "image/webp",
			svg: "image/svg+xml",
		}

		return mimeMap[extension.toLowerCase()] || "application/octet-stream"
	}

	/**
	 * 获取文件类型描述
	 */
	private getFileDescription(extension: string): string {
		const descriptionMap: Record<string, string> = {
			docx: "Word Document",
			doc: "Word 97-2003 Document",
			odt: "OpenDocument Text",
			pdf: "PDF Document",
			xlsx: "Excel Workbook",
			xls: "Excel 97-2003 Workbook",
			ods: "OpenDocument Spreadsheet",
			pptx: "PowerPoint Presentation",
			ppt: "PowerPoint 97-2003 Presentation",
			odp: "OpenDocument Presentation",
			txt: "Text Document",
			rtf: "Rich Text Format",
			csv: "CSV File",
		}

		return descriptionMap[extension.toLowerCase()] || "Document"
	}

	/**
	 * 使用现代文件系统 API 保存文件
	 */
	private async saveWithFileSystemAPI(
		data: Uint8Array,
		fileName: string,
		mimeType?: string,
	): Promise<void> {
		if (!(window as any).showSaveFilePicker) {
			this.downloadFile(data, fileName)
			return
		}
		try {
			// 获取文件扩展名并确定 MIME 类型
			const extension = fileName.split(".").pop()?.toLowerCase() || ""
			const detectedMimeType = mimeType || this.getMimeTypeFromExtension(extension)

			// 显示文件保存对话框
			const fileHandle = await (window as any).showSaveFilePicker({
				suggestedName: fileName,
				types: [
					{
						description: this.getFileDescription(extension),
						accept: {
							[detectedMimeType]: [`.${extension}`],
						},
					},
				],
			})

			// 创建可写流并写入数据
			const writable = await fileHandle.createWritable()
			await writable.write(data)
			await writable.close()
			console.log("File saved successfully:", fileName)
		} catch (error) {
			if ((error as Error).name === "AbortError") {
				console.log("User cancelled the save operation")
				return
			}
			throw error
		}
	}

	/**
	 * 销毁实例，清理资源
	 */
	destroy(): void {
		this.x2tModule = null
		this.isReady = false
		this.initPromise = null
		console.log("X2T converter destroyed")
	}
}

// 单例实例
const x2tConverter = new X2TConverter()
// 只在客户端环境中设置 window.x2tConverter
if (typeof window !== "undefined") {
	window.x2tConverter = x2tConverter
}
export const loadScript = (): Promise<void> => x2tConverter.loadScript()
export const initX2T = (): Promise<EmscriptenModule> => x2tConverter.initialize()
export const convertDocument = (file: File): Promise<ConversionResult> =>
	x2tConverter.convertDocument(file)
export const convertBinToDocument = (
	bin: Uint8Array,
	fileName: string,
	targetExt?: string,
	media?: Record<string, string>,
): Promise<BinConversionResult> =>
	x2tConverter.convertBinToDocument(bin, fileName, targetExt, media)
export const convertBinToDocumentAndDownload = (
	bin: Uint8Array,
	fileName: string,
	targetExt?: string,
	media?: Record<string, string>,
): Promise<BinConversionResult> =>
	x2tConverter.convertBinToDocumentAndDownload(bin, fileName, targetExt, media)

// 重新导出 loadEditorApi
export { loadEditorApi }

// 文件类型常量
export const oAscFileType = {
	UNKNOWN: 0,
	PDF: 513,
	PDFA: 521,
	DJVU: 515,
	XPS: 516,
	DOCX: 65,
	DOC: 66,
	ODT: 67,
	RTF: 68,
	TXT: 69,
	HTML: 70,
	MHT: 71,
	EPUB: 72,
	FB2: 73,
	MOBI: 74,
	DOCM: 75,
	DOTX: 76,
	DOTM: 77,
	FODT: 78,
	OTT: 79,
	DOC_FLAT: 80,
	DOCX_FLAT: 81,
	HTML_IN_CONTAINER: 82,
	DOCX_PACKAGE: 84,
	OFORM: 85,
	DOCXF: 86,
	DOCY: 4097,
	CANVAS_WORD: 8193,
	JSON: 2056,
	XLSX: 257,
	XLS: 258,
	ODS: 259,
	CSV: 260,
	XLSM: 261,
	XLTX: 262,
	XLTM: 263,
	XLSB: 264,
	FODS: 265,
	OTS: 266,
	XLSX_FLAT: 267,
	XLSX_PACKAGE: 268,
	XLSY: 4098,
	PPTX: 129,
	PPT: 130,
	ODP: 131,
	PPSX: 132,
	PPTM: 133,
	PPSM: 134,
	POTX: 135,
	POTM: 136,
	FODP: 137,
	OTP: 138,
	PPTX_PACKAGE: 139,
	IMG: 1024,
	JPG: 1025,
	TIFF: 1026,
	TGA: 1027,
	GIF: 1028,
	PNG: 1029,
	EMF: 1030,
	WMF: 1031,
	BMP: 1032,
	CR2: 1033,
	PCX: 1034,
	RAS: 1035,
	PSD: 1036,
	ICO: 1037,
} as const

export const c_oAscFileType2 = Object.fromEntries(
	Object.entries(oAscFileType).map(([key, value]) => [value, key]),
) as Record<number, keyof typeof oAscFileType>

const getMimeTypeFromExtension = (extension: string): string => {
	const mimeMap: Record<string, string> = {
		// 文档类型
		docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		doc: "application/msword",
		odt: "application/vnd.oasis.opendocument.text",
		rtf: "application/rtf",
		txt: "text/plain",
		pdf: "application/pdf",

		// 表格类型
		xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		xls: "application/vnd.ms-excel",
		ods: "application/vnd.oasis.opendocument.spreadsheet",
		csv: "text/csv",

		// 演示文稿类型
		pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		ppt: "application/vnd.ms-powerpoint",
		odp: "application/vnd.oasis.opendocument.presentation",

		// 图片类型
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		bmp: "image/bmp",
		webp: "image/webp",
		svg: "image/svg+xml",
	}

	return mimeMap[extension.toLowerCase()] || "application/octet-stream"
}
interface SaveEvent {
	data: {
		data: {
			data: Uint8Array
		}
		option: {
			outputformat: number
		}
	}
}

// 获取文档类型
export function getDocumentType(fileType: string): string | null {
	const type = fileType.toLowerCase()
	if (type === "docx" || type === "doc") {
		return "word"
	} else if (type === "xlsx" || type === "xls") {
		return "cell"
	} else if (type === "pptx" || type === "ppt") {
		return "slide"
	}
	return null
}

// 全局 media 映射对象（已废弃，每个实例使用自己的media）
const media: Record<string, string> = {}

/**
 * 创建实例特定的保存处理函数
 * @param manager - 编辑器管理器实例
 * @returns onSave 事件处理函数
 */
function createOnSaveHandler(manager: EditorManager) {
	return async function onSaveInEditor(event: SaveEvent): Promise<any> {
		if (event && event.data && event.data.data) {
			const { data, option } = event.data
			// 使用管理器实例的配置，而不是全局的 getDocmentObj()
			const fileName = manager.getFileName()

			// 确保 data.data 是 Uint8Array
			let binData: Uint8Array
			const rawData = data.data as any

			if (typeof rawData === "string") {
				// 如果是字符串，可能是 base64 编码的数据或 OnlyOffice 内部格式
				// OnlyOffice 的 downloadAs 方法返回的数据可能是字符串格式
				try {
					// 首先尝试直接使用字符串作为二进制数据
					// 将字符串转换为 Uint8Array
					const encoder = new TextEncoder()
					const bytes = encoder.encode(rawData)
					binData = bytes

					// 如果字符串看起来像 base64（以常见 base64 字符开头），尝试解码
					if (rawData.match(/^[A-Za-z0-9+/=]+$/)) {
						try {
							const binaryString = atob(rawData)
							const decodedBytes = new Uint8Array(binaryString.length)
							for (let i = 0; i < binaryString.length; i++) {
								decodedBytes[i] = binaryString.charCodeAt(i)
							}
							// 如果解码后的数据看起来更合理（非空且长度合理），使用解码后的数据
							if (decodedBytes.length > 0 && decodedBytes.length < bytes.length * 2) {
								binData = decodedBytes
							}
						} catch (e) {
							// base64 解码失败，使用原始字符串编码
							console.log("Base64 decode failed, using raw string encoding")
						}
					}
				} catch (error) {
					console.error("Failed to process string data:", error)
					binData = new Uint8Array(0)
				}
			} else if (rawData instanceof Uint8Array) {
				binData = rawData
			} else if (rawData instanceof ArrayBuffer) {
				binData = new Uint8Array(rawData)
			} else if (rawData && typeof rawData === "object" && "buffer" in rawData) {
				// 可能是 TypedArray 或其他类似结构
				binData = new Uint8Array(rawData.buffer || rawData)
			} else {
				console.error("Invalid data type in save event:", typeof rawData, rawData)
				binData = new Uint8Array(0)
			}

			const result = {
				fileName: fileName,
				fileType: c_oAscFileType2[option.outputformat],
				binData: binData,
				instanceId: manager.getInstanceId(), // 添加实例ID
			}

			// 通过 eventbus 通知，包含实例ID
			onlyofficeEventbus.emit(ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT, result)

			return result
		}

		return null
	}
}

/**
 * 为指定的管理器实例创建 writeFile 处理函数
 * @param manager - 编辑器管理器实例
 * @returns writeFile 事件处理函数
 */
function createWriteFileHandler(manager: EditorManager) {
	return function handleWriteFile(event: any) {
		try {
			const containerId = manager.getContainerId()
			const instanceId = manager.getInstanceId()
			console.log(
				`[WriteFile ${instanceId}] Write file event for containerId: ${containerId}`,
				event,
			)

			const { data: eventData } = event
			if (!eventData) {
				console.warn(`[WriteFile ${instanceId}] No data provided in writeFile event`)
				return
			}

			const {
				data: imageData, // Uint8Array 图片数据
				file: fileName, // 文件名，如 "display8image-174799443357-0.png"
				_target, // 目标对象，包含 frameOrigin 等信息
			} = eventData

			console.log(
				`[WriteFile ${instanceId}] Processing file: ${fileName}, containerId: ${containerId}, _target:`,
				_target,
			)

			// 验证数据
			if (!imageData || !(imageData instanceof Uint8Array)) {
				throw new Error("Invalid image data: expected Uint8Array")
			}

			if (!fileName || typeof fileName !== "string") {
				throw new Error("Invalid file name")
			}

			// 从文件名中提取扩展名
			const fileExtension = fileName.split(".").pop()?.toLowerCase() || "png"
			const mimeType = getMimeTypeFromExtension(fileExtension)

			// 创建 Blob 对象
			const blob = new Blob([imageData as unknown as BlobPart], { type: mimeType })

			// 创建对象 URL
			const objectUrl = window.URL.createObjectURL(blob)
			const mediaKey = `media/${fileName}`

			// 更新管理器中的媒体信息
			manager.updateMedia(mediaKey, objectUrl)

			// 获取管理器中的媒体映射
			const managerMedia = manager.getMedia()

			// 发送命令到对应的编辑器
			const editor = manager.get()
			if (!editor) {
				throw new Error("Editor instance not available")
			}

			editor.sendCommand({
				command: "asc_setImageUrls",
				data: {
					urls: managerMedia,
				},
			})

			editor.sendCommand({
				command: "asc_writeFileCallback",
				data: {
					path: objectUrl,
					imgName: fileName,
				},
			})

			console.log(
				`✅ [WriteFile ${manager.getInstanceId()}] Processed image: ${fileName}, total media: ${
					Object.keys(managerMedia).length
				}`,
			)
		} catch (error: any) {
			console.error(`[WriteFile ${manager.getInstanceId()}] Error handling writeFile:`, error)

			// 通知编辑器文件处理失败
			const editor = manager.get()
			if (editor) {
				editor.sendCommand({
					command: "asc_writeFileCallback",
					data: {
						success: false,
						error: error.message,
					},
				})
			}

			if (event.callback && typeof event.callback === "function") {
				event.callback({
					success: false,
					error: error.message,
				})
			}
		}
	}
}
// 公共编辑器创建方法
export function createEditorInstance(config: {
	fileName: string
	fileType: string
	binData: ArrayBuffer | string
	media?: any
	readOnly?: boolean // 是否只读模式，默认为 false
	lang?: string // 语言代码，默认为 'en'
	containerId?: string // 容器ID，如果不提供则使用默认容器
	editorManager?: EditorManager // 编辑器管理器实例，如果不提供则创建新实例
}) {
	const {
		fileName,
		fileType,
		binData,
		media: initialMedia,
		readOnly = false,
		lang = ONLYOFFICE_LANG_KEY.EN,
		containerId,
		editorManager: providedManager,
	} = config

	// 获取或创建编辑器管理器实例
	let manager: EditorManager
	const actualContainerId =
		containerId || (providedManager ? providedManager.getContainerId() : undefined)

	if (providedManager) {
		// 如果提供了管理器实例，使用它
		manager = providedManager
		// 如果该管理器已有编辑器，先销毁它
		if (manager.exists()) {
			manager.destroy()
		}
	} else if (containerId) {
		// 如果提供了容器ID，检查是否已存在实例
		const existingManager = editorManagerFactory.get(containerId)
		if (existingManager) {
			// 如果已存在，先销毁它
			existingManager.destroy()
			editorManagerFactory.destroy(containerId)
		}
		// 创建新实例
		manager = editorManagerFactory.create(containerId)
	} else {
		// 创建新实例
		manager = editorManagerFactory.create()
	}

	const finalContainerId = actualContainerId || manager.getContainerId()
	console.log(
		`[CreateEditor] finalContainerId: ${finalContainerId}, actualContainerId: ${actualContainerId}, manager.containerId: ${manager.getContainerId()}, manager.instanceId: ${manager.getInstanceId()}`,
	)

	// 将初始媒体文件同步到全局 media 对象
	if (initialMedia) {
		Object.keys(initialMedia).forEach((key) => {
			media[key] = initialMedia[key]
		})
		console.log(
			`📷 [CreateEditor ${manager.getInstanceId()}] Initialized with ${
				Object.keys(initialMedia).length
			} media files`,
		)
	}

	// 确保 API 已加载
	if (!window.DocsAPI) {
		throw new Error("OnlyOffice API 未加载，请先调用 loadEditorApi()")
	}

	// 确保容器元素存在
	let container = document.getElementById(finalContainerId)

	// 如果容器不存在，尝试创建它
	if (!container) {
		// 优先查找带有 data-onlyoffice-container-id 属性的父元素（用于多实例场景）
		let parent = document.querySelector(`[data-onlyoffice-container-id="${finalContainerId}"]`)

		// 如果没有找到，尝试查找带有 data-onlyoffice-container 属性的父元素
		if (!parent) {
			parent = document.querySelector(
				`[data-onlyoffice-container="${manager.getInstanceId()}"]`,
			)
		}

		// 如果还是没有找到，使用通用的父元素选择器（单实例场景）
		if (!parent) {
			parent = document.querySelector(ONLYOFFICE_CONTAINER_CONFIG.PARENT_SELECTOR)
		}

		if (parent) {
			container = document.createElement("div")
			container.id = finalContainerId
			Object.assign(container.style, ONLYOFFICE_CONTAINER_CONFIG.STYLE)
			parent.appendChild(container)
			console.log(
				`[CreateEditor ${manager.getInstanceId()}] Container element created in parent for containerId: ${finalContainerId}`,
			)
		} else {
			// 降级方案：直接使用 body
			container = document.createElement("div")
			container.id = finalContainerId
			Object.assign(container.style, ONLYOFFICE_CONTAINER_CONFIG.STYLE)
			document.body.appendChild(container)
			console.warn(
				`[CreateEditor ${manager.getInstanceId()}] Container element created in body as fallback for containerId: ${finalContainerId}`,
			)
		}
	} else {
		// 如果容器已存在，清空它以确保干净的状态
		container.innerHTML = ""
		console.log(
			`[CreateEditor ${manager.getInstanceId()}] Using existing container: ${finalContainerId}`,
		)
	}

	// 创建编辑器实例，使用容器ID作为编辑器ID
	const editor = new window.DocsAPI.DocEditor(finalContainerId, {
		document: {
			title: fileName,
			url: fileName, // 使用文件名作为标识
			fileType: fileType,
			permissions: {
				// edit: !readOnly, // 根据 readOnly 参数设置编辑权限
				chat: false,
				protect: false,
				print: false,
			},
		},
		editorConfig: {
			// mode: readOnly ? 'view' : 'edit', // 根据 readOnly 参数设置模式
			lang: lang,
			customization: {
				leftMenu: false, // must be deprecated. use layout.leftMenu instead
				rightMenu: false, //
				help: false,
				about: false,
				hideRightMenu: true,
				features: {
					spellcheck: {
						change: false,
					},
				},
				// 取消远程 modal 弹窗
				anonymous: {
					request: false,
					label: "Guest",
				},
				layout: {
					header: {
						users: false, // users list button
						save: false, // save button
						editMode: false, // change mode button
						user: false, // icon of current user
					},
				},
			},
		},
		events: {
			writeFile: createWriteFileHandler(manager), // 为每个实例创建独立的处理函数
			onAppReady: () => {
				// 直接使用 editor 实例，因为此时编辑器还未注册到管理器
				// 设置媒体资源 - 使用实例特定的媒体对象
				const instanceMedia = initialMedia || {}
				if (Object.keys(instanceMedia).length > 0) {
					console.log(
						`📷 [OnAppReady ${manager.getInstanceId()}] Setting ${
							Object.keys(instanceMedia).length
						} media files`,
					)
					editor.sendCommand({
						command: "asc_setImageUrls",
						data: { urls: instanceMedia },
					})
				}
				// 加载文档内容
				editor.sendCommand({
					command: "asc_openDocument",
					data: { buf: binData as any },
				})
			},
			onDocumentReady: () => {
				console.log("文档加载完成：", fileName)
				// 触发 documentReady 事件
				onlyofficeEventbus.emit(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, {
					fileName,
					fileType,
				})
			},

			// core: 下载 - 使用实例特定的保存处理函数
			onSave: createOnSaveHandler(manager),
		},
	})

	// 使用管理器注册编辑器实例，保存配置以便后续切换只读模式
	manager.create(editor, {
		fileName,
		fileType,
		binData,
		media: initialMedia || {}, // 使用初始媒体文件，如果没有则使用空对象
		readOnly,
		events: {
			onSave: createOnSaveHandler(manager), // 使用实例特定的保存处理函数
		},
	})

	return manager
}

// 合并后的文件操作方法
export async function createEditorView(options: {
	isNew: boolean
	fileName: string
	file?: File
	readOnly?: boolean
	lang?: string // 语言代码，默认为 'en'
	containerId?: string // 容器ID，如果不提供则使用默认容器
	editorManager?: EditorManager // 编辑器管理器实例，如果不提供则创建新实例
}): Promise<EditorManager> {
	try {
		const {
			isNew,
			fileName,
			file,
			readOnly,
			lang = ONLYOFFICE_LANG_KEY.EN,
			containerId,
			editorManager: providedManager,
		} = options
		const fileType = getExtensions(file?.type || "")[0] || fileName.split(".").pop() || ""

		// 获取文档内容
		let documentData: {
			bin: ArrayBuffer | string
			media?: any
		}

		if (isNew) {
			// 新建文档使用空模板
			const emptyBin = g_sEmpty_bin[`.${fileType}`]
			if (!emptyBin) {
				throw new Error(`不支持的文件类型：${fileType}`)
			}
			documentData = { bin: emptyBin }
		} else {
			// 打开现有文档需要转换
			if (!file) throw new Error("无效的文件对象")
			// @ts-expect-error convertDocument handles the file type conversion
			documentData = await convertDocument(file)
		}

		// 创建编辑器实例
		const manager = createEditorInstance({
			fileName,
			fileType,
			binData: documentData.bin,
			media: documentData.media,
			readOnly,
			lang,
			containerId,
			editorManager: providedManager,
		})

		// 如果需要在文档就绪后设置只读模式
		if (readOnly) {
			let hasUsed = false
			onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, () => {
				if (!hasUsed) {
					manager.setReadOnly(readOnly)
					hasUsed = true
				}
			})
		}

		return manager
	} catch (error: any) {
		console.error("文档操作失败：", error)
		alert(`文档操作失败：${error.message}`)
		throw error
	}
}
