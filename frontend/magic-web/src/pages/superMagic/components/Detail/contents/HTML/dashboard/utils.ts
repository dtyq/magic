import { getTemporaryDownloadUrl, downloadFileContent } from "@/pages/superMagic/utils/api"
import {
	flattenAttachments,
	findMatchingFile,
	isRelativePath,
	getContentTypeFromExtension,
} from "../utils"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { SuperMagicApi } from "@/apis"

/**
 * Dashboard卡片布局信息
 */
export interface DashboardCardLayout {
	x: number
	y: number
	w: number
	h: number
}

/**
 * Dashboard卡片信息
 */
export interface DashboardCard {
	id: string
	layout: DashboardCardLayout
	title?: string
	titleAlign?: "left" | "center" | "right"

	[key: string]: unknown
}

/**
 * 查找data.js文件的结果
 */
export interface DataJsFileInfo {
	fileId: string
	content: string
}

/**
 * 查找同目录下的data.js文件
 */
export async function findDataJsFile(params: {
	attachments: FileItem[]
	attachmentList: FileItem[]
	currentFileId: string
	currentFileName: string
}): Promise<DataJsFileInfo | null> {
	const { attachments, attachmentList, currentFileId, currentFileName } = params

	if (!attachments || !attachmentList || !currentFileId || !currentFileName) {
		return null
	}

	try {
		// 获取当前HTML文件的目录路径
		const currentFile = attachmentList.find((item: FileItem) => item.file_id === currentFileId)
		if (!currentFile?.relative_file_path) {
			return null
		}

		// 计算HTML文件所在的目录
		const htmlRelativeFolderPath = currentFile.relative_file_path.replace(
			currentFile.file_name,
			"",
		)

		// 查找同目录下的data.js文件
		const allFiles = flattenAttachments(attachments)

		// 尝试多种方式查找data.js文件
		let dataJsFile = null

		// 方式1: 直接查找 ./data.js
		dataJsFile = findMatchingFile({
			path: "./data.js",
			allFiles: allFiles,
			htmlRelativeFolderPath: htmlRelativeFolderPath,
		})

		// 方式2: 如果方式1失败，尝试查找 data.js
		if (!dataJsFile) {
			dataJsFile = findMatchingFile({
				path: "data.js",
				allFiles: allFiles,
				htmlRelativeFolderPath: htmlRelativeFolderPath,
			})
		}

		// 方式3: 直接在同目录下查找名为data.js的文件
		if (!dataJsFile) {
			const targetPath = htmlRelativeFolderPath + "data.js"
			dataJsFile = allFiles.find((file: FileItem) => file.relative_file_path === targetPath)
		}

		// 方式4: 查找所有.js文件，看是否有data.js
		if (!dataJsFile) {
			const jsFiles = allFiles.filter(
				(file: FileItem) =>
					file.file_name === "data.js" || file.file_name.endsWith("/data.js"),
			)
			if (jsFiles.length > 0) {
				dataJsFile = jsFiles[0] // 取第一个匹配的
			}
		}

		if (!dataJsFile) {
			return null
		}

		// 获取data.js文件的内容
		const downloadUrls = await getTemporaryDownloadUrl({ file_ids: [dataJsFile.file_id] })
		if (downloadUrls && downloadUrls[0]?.url) {
			const content = await downloadFileContent(downloadUrls[0].url)

			return {
				fileId: dataJsFile.file_id,
				content: content as string,
			}
		}

		return null
	} catch (error) {
		console.error("Failed to load data.js file:", error)
		return null
	}
}

/**
 * DASHBOARD_CARDS数组位置信息
 */
interface DashboardCardsArrayInfo {
	arrayContent: string
	startIndex: number
	endIndex: number
	isFullArray: boolean
}

const JS_STRING_LITERAL_PATTERN =
	"(?:\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`)"

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createJsStringLiteral(value: string): string {
	return JSON.stringify(value)
}

function getLineIndent(content: string, index: number): string {
	const lineStart = content.lastIndexOf("\n", index - 1) + 1
	const indentMatch = content.slice(lineStart, index).match(/^\s*/)
	return indentMatch?.[0] ?? ""
}

function findTopLevelPropertyRange(
	objectContent: string,
	propertyName: string,
): { start: number; end: number; indent: string } | null {
	let quote: '"' | "'" | "`" | null = null
	let isLineComment = false
	let isBlockComment = false
	let braceDepth = 0
	let bracketDepth = 0
	let parenDepth = 0

	for (let i = 0; i < objectContent.length; i++) {
		const char = objectContent[i]
		const nextChar = objectContent[i + 1]

		if (isLineComment) {
			if (char === "\n" || char === "\r") {
				isLineComment = false
			}
			continue
		}

		if (isBlockComment) {
			if (char === "*" && nextChar === "/") {
				isBlockComment = false
				i++
			}
			continue
		}

		if (quote) {
			if (char === "\\") {
				i++
				continue
			}
			if (char === quote) {
				quote = null
			}
			continue
		}

		if (char === "/" && nextChar === "/") {
			isLineComment = true
			i++
			continue
		}

		if (char === "/" && nextChar === "*") {
			isBlockComment = true
			i++
			continue
		}

		if (char === '"' || char === "'" || char === "`") {
			quote = char
			continue
		}

		if (char === "{") {
			braceDepth++
			continue
		}

		if (char === "}") {
			braceDepth--
			continue
		}

		if (char === "[") {
			bracketDepth++
			continue
		}

		if (char === "]") {
			bracketDepth--
			continue
		}

		if (char === "(") {
			parenDepth++
			continue
		}

		if (char === ")") {
			parenDepth--
			continue
		}

		if (braceDepth !== 1 || bracketDepth !== 0 || parenDepth !== 0) {
			continue
		}

		if (!/[A-Za-z_$]/.test(char)) {
			continue
		}

		let identifierEnd = i + 1
		while (identifierEnd < objectContent.length && /[\w$]/.test(objectContent[identifierEnd])) {
			identifierEnd++
		}

		const identifier = objectContent.slice(i, identifierEnd)
		if (identifier !== propertyName) {
			i = identifierEnd - 1
			continue
		}

		let colonIndex = identifierEnd
		while (colonIndex < objectContent.length && /\s/.test(objectContent[colonIndex])) {
			colonIndex++
		}

		if (objectContent[colonIndex] !== ":") {
			i = identifierEnd - 1
			continue
		}

		let end = colonIndex + 1
		let valueQuote: '"' | "'" | "`" | null = null
		let valueLineComment = false
		let valueBlockComment = false
		let valueBraceDepth = 0
		let valueBracketDepth = 0
		let valueParenDepth = 0

		for (; end < objectContent.length; end++) {
			const valueChar = objectContent[end]
			const valueNextChar = objectContent[end + 1]

			if (valueLineComment) {
				if (valueChar === "\n" || valueChar === "\r") {
					valueLineComment = false
				}
				continue
			}

			if (valueBlockComment) {
				if (valueChar === "*" && valueNextChar === "/") {
					valueBlockComment = false
					end++
				}
				continue
			}

			if (valueQuote) {
				if (valueChar === "\\") {
					end++
					continue
				}
				if (valueChar === valueQuote) {
					valueQuote = null
				}
				continue
			}

			if (valueChar === "/" && valueNextChar === "/") {
				valueLineComment = true
				end++
				continue
			}

			if (valueChar === "/" && valueNextChar === "*") {
				valueBlockComment = true
				end++
				continue
			}

			if (valueChar === '"' || valueChar === "'" || valueChar === "`") {
				valueQuote = valueChar
				continue
			}

			if (valueChar === "{") {
				valueBraceDepth++
				continue
			}

			if (valueChar === "}") {
				if (valueBraceDepth === 0 && valueBracketDepth === 0 && valueParenDepth === 0) {
					break
				}
				valueBraceDepth--
				continue
			}

			if (valueChar === "[") {
				valueBracketDepth++
				continue
			}

			if (valueChar === "]") {
				valueBracketDepth--
				continue
			}

			if (valueChar === "(") {
				valueParenDepth++
				continue
			}

			if (valueChar === ")") {
				valueParenDepth--
				continue
			}

			if (
				valueChar === "," &&
				valueBraceDepth === 0 &&
				valueBracketDepth === 0 &&
				valueParenDepth === 0
			) {
				break
			}
		}

		return {
			start: i,
			end,
			indent: getLineIndent(objectContent, i),
		}
	}

	return null
}

function replaceTopLevelProperty(
	objectContent: string,
	propertyName: string,
	replacement: string,
): string {
	const propertyRange = findTopLevelPropertyRange(objectContent, propertyName)
	if (!propertyRange) {
		return objectContent
	}

	return (
		objectContent.slice(0, propertyRange.start) +
		replacement +
		objectContent.slice(propertyRange.end)
	)
}

function insertTopLevelPropertyAfter(
	objectContent: string,
	anchorPropertyName: string,
	propertyLine: string,
): string {
	const anchorRange = findTopLevelPropertyRange(objectContent, anchorPropertyName)
	if (!anchorRange) {
		return objectContent
	}

	return (
		objectContent.slice(0, anchorRange.end) +
		`,\n${anchorRange.indent}${propertyLine}` +
		objectContent.slice(anchorRange.end)
	)
}

function validateJavaScriptContent(jsContent: string): void {
	try {
		new Function(jsContent)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`保存后的 data.js 语法校验失败: ${message}`)
	}
}

/**
 * 提取DASHBOARD_CARDS数组的内容和位置信息
 * 支持 const/let/var 和 window.DASHBOARD_CARDS 两种声明方式
 */
function extractDashboardCardsArray(
	jsContent: string,
	fallbackCheck?: (content: string) => boolean,
): DashboardCardsArrayInfo | null {
	const startPattern =
		/(?:const|let|var)\s+DASHBOARD_CARDS\s*=\s*\[|window\.DASHBOARD_CARDS\s*=\s*\[/
	const startMatch = jsContent.match(startPattern)

	if (startMatch) {
		// 找到了完整的数组声明
		const startIndex = (startMatch.index ?? 0) + startMatch[0].length - 1 // 包含 [

		// 找到对应的结束 ]
		const endIndex = findMatchingBracket(jsContent, startIndex, "[", "]")
		if (endIndex === -1) {
			return null
		}

		// 提取数组内容
		const arrayContent = jsContent.substring(startIndex + 1, endIndex)

		return {
			arrayContent,
			startIndex,
			endIndex,
			isFullArray: false,
		}
	}

	// 没有找到数组声明，可能整个文件就是数组内容
	if (fallbackCheck && fallbackCheck(jsContent)) {
		return {
			arrayContent: jsContent,
			startIndex: 0,
			endIndex: jsContent.length,
			isFullArray: true,
		}
	}

	return null
}

/**
 * 查找匹配的括号位置
 */
function findMatchingBracket(
	content: string,
	startIndex: number,
	openBracket: string,
	closeBracket: string,
): number {
	let bracketCount = 0
	let endIndex = -1
	let quote: '"' | "'" | "`" | null = null
	let isLineComment = false
	let isBlockComment = false

	for (let i = startIndex; i < content.length; i++) {
		const char = content[i]
		const nextChar = content[i + 1]

		if (isLineComment) {
			if (char === "\n" || char === "\r") isLineComment = false
			continue
		}

		if (isBlockComment) {
			if (char === "*" && nextChar === "/") {
				isBlockComment = false
				i++
			}
			continue
		}

		if (quote) {
			if (char === "\\") {
				i++
				continue
			}
			if (char === quote) quote = null
			continue
		}

		if (char === "/" && nextChar === "/") {
			isLineComment = true
			i++
			continue
		}

		if (char === "/" && nextChar === "*") {
			isBlockComment = true
			i++
			continue
		}

		if (char === '"' || char === "'" || char === "`") {
			quote = char
			continue
		}

		if (char === openBracket) {
			bracketCount++
		} else if (char === closeBracket) {
			bracketCount--
			if (bracketCount === 0) {
				endIndex = i
				break
			}
		}
	}

	return endIndex
}

/**
 * 查找卡片对象的边界位置
 */
function findCardObjectBounds(
	arrayContent: string,
	cardId: string,
): { start: number; end: number } | null {
	const idPattern = new RegExp("id:\\s*[\"']" + escapeRegExp(cardId) + "[\"']")
	let quote: '"' | "'" | "`" | null = null
	let isLineComment = false
	let isBlockComment = false
	let braceDepth = 0
	let objectStart = -1

	for (let i = 0; i < arrayContent.length; i++) {
		const char = arrayContent[i]
		const nextChar = arrayContent[i + 1]

		if (isLineComment) {
			if (char === "\n" || char === "\r") {
				isLineComment = false
			}
			continue
		}

		if (isBlockComment) {
			if (char === "*" && nextChar === "/") {
				isBlockComment = false
				i++
			}
			continue
		}

		if (quote) {
			if (char === "\\") {
				i++
				continue
			}
			if (char === quote) {
				quote = null
			}
			continue
		}

		if (char === "/" && nextChar === "/") {
			isLineComment = true
			i++
			continue
		}

		if (char === "/" && nextChar === "*") {
			isBlockComment = true
			i++
			continue
		}

		if (char === '"' || char === "'" || char === "`") {
			quote = char
			continue
		}

		if (char === "{") {
			if (braceDepth === 0) {
				objectStart = i
			}
			braceDepth++
			continue
		}

		if (char === "}") {
			braceDepth--
			if (braceDepth === 0 && objectStart !== -1) {
				const objectContent = arrayContent.substring(objectStart, i + 1)
				if (idPattern.test(objectContent)) {
					return { start: objectStart, end: i }
				}
				objectStart = -1
			}
		}
	}

	return null
}

function extractTopLevelCardObjects(arrayContent: string): string[] {
	const cardObjects: string[] = []
	let quote: '"' | "'" | "`" | null = null
	let isLineComment = false
	let isBlockComment = false
	let braceDepth = 0
	let objectStart = -1

	for (let i = 0; i < arrayContent.length; i++) {
		const char = arrayContent[i]
		const nextChar = arrayContent[i + 1]

		if (isLineComment) {
			if (char === "\n" || char === "\r") {
				isLineComment = false
			}
			continue
		}

		if (isBlockComment) {
			if (char === "*" && nextChar === "/") {
				isBlockComment = false
				i++
			}
			continue
		}

		if (quote) {
			if (char === "\\") {
				i++
				continue
			}
			if (char === quote) {
				quote = null
			}
			continue
		}

		if (char === "/" && nextChar === "/") {
			isLineComment = true
			i++
			continue
		}

		if (char === "/" && nextChar === "*") {
			isBlockComment = true
			i++
			continue
		}

		if (char === '"' || char === "'" || char === "`") {
			quote = char
			continue
		}

		if (char === "{") {
			if (braceDepth === 0) {
				objectStart = i
			}
			braceDepth++
			continue
		}

		if (char === "}") {
			braceDepth--
			if (braceDepth === 0 && objectStart !== -1) {
				cardObjects.push(arrayContent.substring(objectStart, i + 1))
				objectStart = -1
			}
		}
	}

	return cardObjects
		.map((cardObject) => cardObject.trim())
		.filter((cardObject) => cardObject.length > 0)
}
/**
 * 清理数组内容中的多余逗号和格式问题
 */
function cleanArrayContent(arrayContent: string): string {
	return arrayContent
		.replace(/,\s*,/g, ",")
		.replace(/,\s*]/g, "]")
		.replace(/\[\s*,/g, "[")
}

/**
 * 重新组装JavaScript内容
 */
function reassembleJsContent(
	jsContent: string,
	arrayInfo: DashboardCardsArrayInfo,
	arrayContent: string,
): string {
	if (arrayInfo.isFullArray) {
		return arrayContent
	}

	return (
		jsContent.substring(0, arrayInfo.startIndex + 1) +
		arrayContent +
		jsContent.substring(arrayInfo.endIndex)
	)
}

/**
 * 从JavaScript文件中删除指定的DASHBOARD_CARDS
 */
export function removeDashboardCardsFromJS(jsContent: string, cardIdsToDelete: string[]): string {
	if (cardIdsToDelete.length === 0) {
		return jsContent
	}

	try {
		// 提取数组信息
		const arrayInfo = extractDashboardCardsArray(jsContent, (content) => {
			// 检查是否包含要删除的卡片对象
			return cardIdsToDelete.some((cardId) => {
				const idPattern = new RegExp(`id:\\s*['"]${cardId}['"]`)
				return idPattern.test(content)
			})
		})

		if (!arrayInfo) {
			return jsContent
		}

		const idsToDelete = new Set(cardIdsToDelete)
		const cardObjects = extractTopLevelCardObjects(arrayInfo.arrayContent)
		if (cardObjects.length === 0) {
			return jsContent
		}

		let arrayContent = cardObjects
			.filter((cardObject) => {
				return !Array.from(idsToDelete).some((cardId) => {
					const idPattern = new RegExp(`id:\\s*["']${escapeRegExp(cardId)}["']`)
					return idPattern.test(cardObject)
				})
			})
			.join("\n,\n")

		// 清理可能的多余逗号和格式问题
		arrayContent = cleanArrayContent(arrayContent)

		// 重新组装完整的JavaScript内容
		return reassembleJsContent(jsContent, arrayInfo, arrayContent)
	} catch (error) {
		console.error("Error removing DASHBOARD_CARDS from JS:", error)
		return jsContent
	}
}

/**
 * 更新卡片对象的字段内容
 */
function updateCardObjectContent(
	cardObjectContent: string,
	update: {
		layout?: DashboardCardLayout
		title?: string
		titleAlign?: "left" | "center" | "right"
	},
): string {
	let updatedContent = cardObjectContent

	// 更新 layout 字段
	if (update.layout) {
		const layoutString = `layout: { x: ${update.layout.x}, y: ${update.layout.y}, w: ${update.layout.w}, h: ${update.layout.h} }`
		const layoutRange = findTopLevelPropertyRange(updatedContent, "layout")

		if (layoutRange) {
			updatedContent = replaceTopLevelProperty(updatedContent, "layout", layoutString)
		}
	}

	// 更新 title 字段
	if (update.title !== undefined) {
		const titleString = `title: ${createJsStringLiteral(update.title)}`
		const titleRange = findTopLevelPropertyRange(updatedContent, "title")

		if (titleRange) {
			updatedContent = replaceTopLevelProperty(updatedContent, "title", titleString)
		} else {
			updatedContent = insertTopLevelPropertyAfter(updatedContent, "id", titleString)
		}
	}

	// 更新 titleAlign 字段
	if (update.titleAlign !== undefined) {
		const titleAlignString = `titleAlign: ${createJsStringLiteral(update.titleAlign)}`
		const titleAlignRange = findTopLevelPropertyRange(updatedContent, "titleAlign")

		if (titleAlignRange) {
			updatedContent = replaceTopLevelProperty(updatedContent, "titleAlign", titleAlignString)
		} else {
			if (findTopLevelPropertyRange(updatedContent, "title")) {
				updatedContent = insertTopLevelPropertyAfter(
					updatedContent,
					"title",
					titleAlignString,
				)
			} else {
				updatedContent = insertTopLevelPropertyAfter(updatedContent, "id", titleAlignString)
			}
		}
	}

	return updatedContent
}

/**
 * 更新JavaScript文件中的DASHBOARD_CARDS数组
 */
export function updateDashboardCardsInJS(
	jsContent: string,
	cardUpdates: Array<{
		id: string
		layout?: DashboardCardLayout
		title?: string
		titleAlign?: "left" | "center" | "right"
	}>,
): string {
	try {
		// 提取数组信息
		const arrayInfo = extractDashboardCardsArray(jsContent)
		if (!arrayInfo) {
			return jsContent
		}

		let arrayContent = arrayInfo.arrayContent

		// 更新每个卡片对象的字段
		const cardUpdateOperations: Array<{
			start: number
			end: number
			newContent: string
			cardId: string
		}> = []

		cardUpdates.forEach((update) => {
			const bounds = findCardObjectBounds(arrayContent, update.id)
			if (!bounds) {
				return
			}

			// 提取完整的卡片对象内容
			const cardObjectContent = arrayContent.substring(bounds.start, bounds.end + 1)
			const updatedContent = updateCardObjectContent(cardObjectContent, update)

			cardUpdateOperations.push({
				start: bounds.start,
				end: bounds.end + 1,
				newContent: updatedContent,
				cardId: update.id,
			})
		})

		// 按照位置从后往前排序，这样更新时不会影响前面的索引
		cardUpdateOperations.sort((a, b) => b.start - a.start)

		// 统一应用所有更新
		cardUpdateOperations.forEach((update) => {
			arrayContent =
				arrayContent.substring(0, update.start) +
				update.newContent +
				arrayContent.substring(update.end)
		})

		// 重新组装完整的JavaScript内容
		return reassembleJsContent(jsContent, arrayInfo, arrayContent)
	} catch (error) {
		console.error("Error updating DASHBOARD_CARDS in JS:", error)
		return jsContent
	}
}

/**
 * 从对象内容中提取卡片信息
 */
function parseCardFromObjectContent(objContent: string): Partial<DashboardCard> | null {
	const card: Partial<DashboardCard> = {}

	// 提取 id
	const idMatch = objContent.match(/id:\s*['"]([^'"]+)['"]/)
	if (!idMatch) {
		return null
	}
	card.id = idMatch[1]

	// 提取 title
	const titleMatch = objContent.match(/title:\s*['"]([^'"]*?)['"]/)
	if (titleMatch) {
		card.title = titleMatch[1]
	}

	// 提取 titleAlign
	const titleAlignMatch = objContent.match(/titleAlign:\s*['"]([^'"]*?)['"]/)
	if (titleAlignMatch) {
		card.titleAlign = titleAlignMatch[1] as "left" | "center" | "right"
	}

	// 提取 layout
	const layoutMatch = objContent.match(/layout:\s*\{([^}]*)\}/)
	if (layoutMatch) {
		const layoutContent = layoutMatch[1]
		const layout: Partial<DashboardCardLayout> = {}

		const xMatch = layoutContent.match(/x:\s*(\d+)/)
		const yMatch = layoutContent.match(/y:\s*(\d+)/)
		const wMatch = layoutContent.match(/w:\s*(\d+)/)
		const hMatch = layoutContent.match(/h:\s*(\d+)/)

		if (xMatch) layout.x = parseInt(xMatch[1])
		if (yMatch) layout.y = parseInt(yMatch[1])
		if (wMatch) layout.w = parseInt(wMatch[1])
		if (hMatch) layout.h = parseInt(hMatch[1])

		if (
			layout.x !== undefined &&
			layout.y !== undefined &&
			layout.w !== undefined &&
			layout.h !== undefined
		) {
			card.layout = layout as DashboardCardLayout
		}
	}

	return card
}

/**
 * 从数组内容中提取所有卡片对象
 */
function extractAllCardObjects(arrayContent: string): Partial<DashboardCard>[] {
	const cards: Partial<DashboardCard>[] = []
	let objStart = 0

	while (objStart < arrayContent.length) {
		// 查找下一个对象开始
		const nextObjStart = arrayContent.indexOf("{", objStart)
		if (nextObjStart === -1) break

		// 找到对应的对象结束
		const objEnd = findMatchingBracket(arrayContent, nextObjStart, "{", "}")
		if (objEnd === -1) break

		// 提取对象内容
		const objContent = arrayContent.substring(nextObjStart, objEnd + 1)
		const card = parseCardFromObjectContent(objContent)

		if (card && card.id) {
			cards.push(card)
		}

		objStart = objEnd + 1
	}

	return cards
}

/**
 * 从data.js文件内容中提取所有卡片的完整信息
 */
export function extractCardsFromDataJs(jsContent: string): Partial<DashboardCard>[] {
	const cards: Partial<DashboardCard>[] = []

	try {
		// 提取数组信息
		const arrayInfo = extractDashboardCardsArray(jsContent)
		if (!arrayInfo) {
			return cards
		}

		// 提取所有卡片对象
		return extractAllCardObjects(arrayInfo.arrayContent)
	} catch (error) {
		console.error("Error extracting cards from data.js:", error)
		return cards
	}
}

/**
 * 从data.js文件内容中提取所有卡片的id
 */
export function extractCardIdsFromDataJs(jsContent: string): string[] {
	const cards = extractCardsFromDataJs(jsContent)
	return cards.map((card) => card.id).filter(Boolean) as string[]
}

/**
 * 保存dashboard配置和data.js文件
 * 支持卡片删除、更新场景
 */
export async function saveDashboardAndDataJs(params: {
	dashboardCards: DashboardCard[]
	dataJsFileInfo: DataJsFileInfo | null
}): Promise<void> {
	const { dashboardCards, dataJsFileInfo } = params

	try {
		const filesToSave = []

		// 处理data.js文件的保存
		if (dataJsFileInfo && dashboardCards && Array.isArray(dashboardCards)) {
			// 从dataJsFileInfo中提取所有卡片的id，存储到existingCardIds
			const existingCardIds = extractCardIdsFromDataJs(dataJsFileInfo.content)

			const cardDeletes: string[] = []
			const cardUpdates: Array<{
				id: string
				layout?: DashboardCardLayout
				title?: string
				titleAlign?: "left" | "center" | "right"
			}> = []

			// 收集卡片更新信息
			dashboardCards.forEach((card) => {
				if (card.id) {
					const updateData: {
						id: string
						layout?: DashboardCardLayout
						title?: string
						titleAlign?: "left" | "center" | "right"
					} = { id: card.id }

					if (card.layout) {
						updateData.layout = card.layout
					}
					if (card.title !== undefined) {
						updateData.title = card.title
					}
					if (card.titleAlign !== undefined) {
						updateData.titleAlign = card.titleAlign
					}

					cardUpdates.push(updateData)
				}
			})

			// 找出在existingCardIds中存在但在dashboardCards中不存在的id，这些需要删除
			existingCardIds.forEach((id) => {
				const existsInDashboardCards = dashboardCards.some((card) => card.id === id)
				if (!existsInDashboardCards) {
					cardDeletes.push(id)
				}
			})

			// 更新DASHBOARD_CARDS数组中的字段
			let updatedDataJsContent = updateDashboardCardsInJS(dataJsFileInfo.content, cardUpdates)

			// 如果有需要删除的卡片，则移除对应的卡片
			if (cardDeletes.length > 0) {
				updatedDataJsContent = removeDashboardCardsFromJS(updatedDataJsContent, cardDeletes)
			}

			validateJavaScriptContent(updatedDataJsContent)

			filesToSave.push({
				file_id: dataJsFileInfo.fileId,
				content: updatedDataJsContent,
				enable_shadow: true,
			})
		}

		// 批量保存文件
		if (filesToSave.length > 0) {
			await SuperMagicApi.saveFileContent(filesToSave)
		}
	} catch (error) {
		console.error("Failed to save files:", error)
		throw error
	}
}

/**
 * 创建卡片更新数组
 */
export function createCardUpdatesArray(dashboardCards: DashboardCard[]): Array<{
	id: string
	layout?: DashboardCardLayout
	title?: string
	titleAlign?: "left" | "center" | "right"
}> {
	const cardUpdates: Array<{
		id: string
		layout?: DashboardCardLayout
		title?: string
		titleAlign?: "left" | "center" | "right"
	}> = []

	if (Array.isArray(dashboardCards)) {
		dashboardCards.forEach((card) => {
			if (card.id) {
				const updateData: {
					id: string
					layout?: DashboardCardLayout
					title?: string
					titleAlign?: "left" | "center" | "right"
				} = { id: card.id }

				if (card.layout) {
					updateData.layout = card.layout
				}
				if (card.title !== undefined) {
					updateData.title = card.title
				}
				if (card.titleAlign !== undefined) {
					updateData.titleAlign = card.titleAlign
				}

				cardUpdates.push(updateData)
			}
		})
	}

	return cardUpdates
}

/**
 * 创建layout更新数组（向后兼容）
 */
export function createLayoutUpdatesArray(
	dashboardCards: DashboardCard[],
): Array<{ id: string; layout: DashboardCardLayout }> {
	const layoutUpdates: Array<{ id: string; layout: DashboardCardLayout }> = []

	if (Array.isArray(dashboardCards)) {
		dashboardCards.forEach((card) => {
			if (card.id && card.layout) {
				layoutUpdates.push({ id: card.id, layout: card.layout })
			}
		})
	}

	return layoutUpdates
}

/**
 * 验证dashboard cards数据结构
 */
export function validateDashboardCards(cards: unknown): cards is DashboardCard[] {
	if (!Array.isArray(cards)) {
		return false
	}

	for (const card of cards) {
		if (!card.id || typeof card.id !== "string") {
			return false
		}

		if (!card.layout || typeof card.layout !== "object") {
			return false
		}

		const { x, y, w, h } = card.layout
		if (
			typeof x !== "number" ||
			typeof y !== "number" ||
			typeof w !== "number" ||
			typeof h !== "number"
		) {
			return false
		}

		// 验证 title 字段（可选）
		if (card.title !== undefined && typeof card.title !== "string") {
			return false
		}

		// 验证 titleAlign 字段（可选）
		if (card.titleAlign !== undefined) {
			if (
				typeof card.titleAlign !== "string" ||
				!["left", "center", "right"].includes(card.titleAlign)
			) {
				return false
			}
		}
	}

	return true
}

/**
 * 向HTML注入Dashboard脚本
 * 用于支持Dashboard卡片变化事件和编辑模式切换
 */
export function injectDashboardHTMLScript(html: string): string {
	return `
		${html}
		<script data-injected="true">
			var configManager = null;
			var lastDashboardRenderMode = null;
			function applyDashboardRenderMode(mode) {
				if (mode !== "mobile" && mode !== "desktop" && mode !== "auto") return;
				lastDashboardRenderMode = mode;
				if (configManager && typeof configManager.setRenderMode === "function") {
					configManager.setRenderMode(mode);
				}
			}
      document.addEventListener("ConfigManagerReady", (event) => {
				configManager = event.detail;
				if (lastDashboardRenderMode != null) {
					applyDashboardRenderMode(lastDashboardRenderMode);
				}
      });
			document.addEventListener("DashboardCardsChange", (event) => {
				window.parent.postMessage({
					type: "DashboardCardsChange",
					detail: event.detail.cards.map((item) => {
						return {
						  id: item.id,
							type: item.type,
							source: item.source,
							layout: item.layout,
							title: item.title,
							titleAlign: item.titleAlign,
						}
					}),
				}, "*");
			});
			window.addEventListener("message", (event) => {
				if (!event.data || typeof event.data !== "object") return;
				if (event.data.type === "renderModeChange") {
					applyDashboardRenderMode(event.data.renderMode);
					return;
				}
				if (event.data.type === "editModeChange" && configManager) {
					var isEditMode = event.data.isEditMode;
					configManager.setEditorConfig(oldState => {
						return {
							...oldState,
							DRAGGABLE: isEditMode,
							RESIZABLE: isEditMode,
							DELETABLE: isEditMode,
							EDITABLE: isEditMode,
						}
					});
				}
			});
		</script>
	`
}

/**
 * 创建配置数组的正则表达式
 * 支持 const/let/var 和 window. 两种声明方式
 */
function createConfigArrayRegex(configName: string): RegExp {
	return new RegExp(`(?:(?:const|let|var)\\s+|window\\.|)${configName}\\s*=\\s*\\[`, "g")
}

/**
 * 从数组内容中提取所有 URL
 */
function extractUrlsFromArrayContent(arrayContent: string): string[] {
	const urls: string[] = []
	// 提取 URL，支持所有引号类型
	const urlRegex = /url\s*:\s*(['"`])((?:(?!\1)[^\\]|\\.)*)(\1)/g
	let urlMatch

	while ((urlMatch = urlRegex.exec(arrayContent)) !== null) {
		urls.push(urlMatch[2])
	}

	return urls
}

/**
 * 从脚本内容中提取指定配置数组中的 URL
 * @param scriptContent - 脚本内容
 * @param configName - 配置名称（如 ECHARTS_GEO_CONFIG、DATA_SOURCE_CONFIG）
 * @param errorContext - 错误上下文（用于错误日志）
 * @returns 提取到的 URL 数组
 */
function extractUrlsFromConfigArray(
	scriptContent: string,
	configName: string,
	errorContext: string,
): string[] {
	const urls: string[] = []
	try {
		const configRegex = createConfigArrayRegex(configName)
		let configMatch

		while ((configMatch = configRegex.exec(scriptContent)) !== null) {
			const startIndex = configMatch.index + configMatch[0].length - 1 // 从 [ 开始

			// 找到匹配的 ] 位置，考虑嵌套
			const endIndex = findMatchingBracket(scriptContent, startIndex, "[", "]")

			if (endIndex > startIndex) {
				const arrayContent = scriptContent.substring(startIndex + 1, endIndex)
				const extractedUrls = extractUrlsFromArrayContent(arrayContent)
				urls.push(...extractedUrls)
			}
		}
	} catch (error) {
		console.error(`Error extracting URLs from ${errorContext}:`, error)
	}
	return urls
}

/**
 * 从脚本内容中提取 ECHARTS_GEO_CONFIG 配置中的 URL
 */
export function extractEchartsGeoUrls(scriptContent: string): string[] {
	return extractUrlsFromConfigArray(scriptContent, "ECHARTS_GEO_CONFIG", "ECHARTS_GEO_CONFIG")
}

/**
 * 从脚本内容中提取 DATA_SOURCE_CONFIG 配置中的 URL
 * @param scriptContent - 脚本内容
 * @returns 提取到的 URL 数组
 */
export function extractDataSourceUrls(scriptContent: string): string[] {
	return extractUrlsFromConfigArray(scriptContent, "DATA_SOURCE_CONFIG", "DATA_SOURCE_CONFIG")
}

export function processDashboardArray(data: {
	htmlDoc: Document
	allFiles: FileItem[]
	fileIdsToFetch: string[]
	urlMap: Map<string, unknown>
	htmlRelativeFolderPath: string
}) {
	const { htmlDoc, allFiles, fileIdsToFetch, urlMap, htmlRelativeFolderPath } = data

	const scriptElements = htmlDoc.getElementsByTagName("script")

	for (let i = 0; i < scriptElements.length; i++) {
		const script = scriptElements[i]
		const scriptContent = script.textContent || script.innerHTML || ""
		if (scriptContent.includes("ECHARTS_GEO_CONFIG")) {
			const geoUrls = extractEchartsGeoUrls(scriptContent)
			geoUrls.forEach((geoPath) => {
				if (isRelativePath(geoPath)) {
					const matchedFile = findMatchingFile({
						path: geoPath,
						allFiles,
						htmlRelativeFolderPath,
					})
					if (matchedFile) {
						fileIdsToFetch.push(matchedFile.file_id)
						urlMap.set(matchedFile.file_id, {
							path: geoPath,
							attr: "data-analyst-dashboard",
							tag: "script",
							contentType: getContentTypeFromExtension(geoPath),
						})
					}
				}
			})
		}

		if (scriptContent.includes("DATA_SOURCE_CONFIG")) {
			const dataSourceUrls = extractDataSourceUrls(scriptContent)
			dataSourceUrls.forEach((dataSourcePath) => {
				if (isRelativePath(dataSourcePath)) {
					const matchedFile = findMatchingFile({
						path: dataSourcePath,
						allFiles,
						htmlRelativeFolderPath,
					})
					if (matchedFile) {
						fileIdsToFetch.push(matchedFile.file_id)
						urlMap.set(matchedFile.file_id, {
							path: dataSourcePath,
							attr: "data-analyst-dashboard",
							tag: "script",
							contentType: getContentTypeFromExtension(dataSourcePath),
						})
					}
				}
			})
		}

		if (scriptContent.includes("magicDashboard")) {
			allFiles.forEach((file) => {
				if (file.relative_file_path?.startsWith(htmlRelativeFolderPath)) {
					const fileRelativePath = file.relative_file_path.replace(
						htmlRelativeFolderPath,
						"",
					)
					const filePathSplit = fileRelativePath.split("/")

					const isMatchedFile =
						filePathSplit.length === 2 &&
						(filePathSplit[0] === "geo" ||
							(filePathSplit[0] === "cleaned_data" &&
								file.file_name.endsWith(".csv"))) &&
						!fileIdsToFetch.includes(file.file_id)

					if (isMatchedFile) {
						fileIdsToFetch.push(file.file_id)
						urlMap.set(file.file_id, {
							path: file.relative_file_path,
							attr: `data-analyst-project`,
							fileName: file.file_name,
							type: filePathSplit[0],
							tag: "script",
							contentType: getContentTypeFromExtension(file.relative_file_path),
						})
					}
				}
			})
		}
	}
}
