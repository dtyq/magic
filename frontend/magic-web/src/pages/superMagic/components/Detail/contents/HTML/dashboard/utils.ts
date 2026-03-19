import {
	getTemporaryDownloadUrl,
	downloadFileContent,
} from "@/pages/superMagic/utils/api"
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

	for (let i = startIndex; i < content.length; i++) {
		const char = content[i]
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
	// 匹配包含指定id的整个卡片对象
	const idPattern = new RegExp("id:\\s*[\"']" + cardId + "[\"']", "g")
	idPattern.lastIndex = 0
	const idMatch = idPattern.exec(arrayContent)

	if (!idMatch) {
		return null
	}

	// 从id位置向前查找对象的开始 {
	const objStart = arrayContent.lastIndexOf("{", idMatch.index)
	if (objStart === -1) {
		return null
	}

	// 从objStart位置向后查找对象的结束 }
	const objEnd = findMatchingBracket(arrayContent, objStart, "{", "}")
	if (objEnd === -1) {
		return null
	}

	return { start: objStart, end: objEnd }
}

/**
 * 查找对象前后的逗号位置
 */
function findCommaPositions(
	arrayContent: string,
	objStart: number,
	objEnd: number,
): { hasPreComma: boolean; hasPostComma: boolean; postCommaEnd: number } {
	let hasPreComma = false
	let hasPostComma = false
	let postCommaEnd = objEnd + 1

	// 向前查找逗号
	for (let i = objStart - 1; i >= 0; i--) {
		const char = arrayContent[i]
		if (char === ",") {
			hasPreComma = true
			break
		} else if (char === "[") {
			break
		} else if (!/\s/.test(char)) {
			break
		}
	}

	// 向后查找逗号
	for (let i = objEnd + 1; i < arrayContent.length; i++) {
		const char = arrayContent[i]
		if (char === ",") {
			hasPostComma = true
			postCommaEnd = i + 1
			break
		} else if (char === "]") {
			break
		} else if (!/\s/.test(char)) {
			break
		}
	}

	return { hasPreComma, hasPostComma, postCommaEnd }
}

/**
 * 计算删除范围，考虑注释和逗号
 */
function calculateDeleteRange(
	arrayContent: string,
	objStart: number,
	objEnd: number,
): { start: number; end: number } {
	let deleteStart = objStart
	let deleteEnd = objEnd + 1

	// 向前查找注释
	for (let i = objStart - 1; i >= 0; i--) {
		const char = arrayContent[i]

		if (char === "/" && i > 0 && arrayContent[i - 1] === "*") {
			// 找到多行注释结束 */，向前查找注释开始
			for (let j = i - 2; j >= 0; j--) {
				if (
					arrayContent[j] === "/" &&
					j < arrayContent.length - 1 &&
					arrayContent[j + 1] === "*"
				) {
					// 找到注释开始 /*
					deleteStart = j
					break
				}
			}
			break
		} else if (char === "\n" || char === "\r") {
			// 检查单行注释
			const lineStart = i + 1
			const lineContent = arrayContent.substring(lineStart, objStart).trim()

			if (lineContent.startsWith("//")) {
				deleteStart = lineStart
				break
			} else if (lineContent === "") {
				continue
			} else {
				break
			}
		}
	}

	// 查找逗号位置
	const { hasPreComma, hasPostComma, postCommaEnd } = findCommaPositions(
		arrayContent,
		deleteStart,
		objEnd,
	)

	deleteEnd = postCommaEnd

	// 根据逗号情况调整删除范围
	if (hasPreComma && hasPostComma) {
		// 前后都有逗号，删除前面的逗号，保留后面的
		for (let i = deleteStart - 1; i >= 0; i--) {
			const char = arrayContent[i]
			if (char === ",") {
				deleteStart = i
				break
			} else if (!/\s/.test(char)) {
				break
			}
		}
	} else if (hasPreComma && !hasPostComma) {
		// 只有前面有逗号，删除前面的逗号
		for (let i = deleteStart - 1; i >= 0; i--) {
			const char = arrayContent[i]
			if (char === ",") {
				deleteStart = i
				break
			} else if (!/\s/.test(char)) {
				break
			}
		}
	}

	return { start: deleteStart, end: deleteEnd }
}

/**
 * 清理数组内容中的多余逗号和格式问题
 */
function cleanArrayContent(arrayContent: string): string {
	return arrayContent
		.replace(/,\s*,/g, ",")
		.replace(/,\s*]/g, "]")
		.replace(/\[\s*,/g, "[")
		.replace(/}\s*\n\s*\/\//g, "},\n  //")
		.replace(/}\s*\n\s*\{/g, "},\n  {")
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

		let arrayContent = arrayInfo.arrayContent

		// 收集需要删除的卡片对象信息
		const cardsToRemove: Array<{
			start: number
			end: number
			cardId: string
		}> = []

		cardIdsToDelete.forEach((cardId) => {
			const bounds = findCardObjectBounds(arrayContent, cardId)
			if (!bounds) {
				return
			}

			const { start, end } = calculateDeleteRange(arrayContent, bounds.start, bounds.end)
			cardsToRemove.push({
				start,
				end,
				cardId,
			})
		})

		// 按照位置从后往前排序，这样删除时不会影响前面的索引
		cardsToRemove.sort((a, b) => b.start - a.start)

		// 统一应用所有删除操作
		cardsToRemove.forEach((removal) => {
			arrayContent =
				arrayContent.substring(0, removal.start) + arrayContent.substring(removal.end)
		})

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
		const layoutPattern = /layout:\s*\{[\s\S]*?\}/
		const layoutString = `layout: { x: ${update.layout.x}, y: ${update.layout.y}, w: ${update.layout.w}, h: ${update.layout.h} }`

		if (layoutPattern.test(updatedContent)) {
			updatedContent = updatedContent.replace(layoutPattern, layoutString)
		}
	}

	// 更新 title 字段
	if (update.title !== undefined) {
		const titlePattern = /title:\s*['"][^'"]*['"]/
		const titleString = `title: "${update.title}"`

		if (titlePattern.test(updatedContent)) {
			updatedContent = updatedContent.replace(titlePattern, titleString)
		} else {
			// 如果没有 title 字段，在 id 字段后添加
			const idFieldPattern = /(id:\s*['"][^'"]*['"])/
			if (idFieldPattern.test(updatedContent)) {
				updatedContent = updatedContent.replace(idFieldPattern, `$1,\n  ${titleString}`)
			}
		}
	}

	// 更新 titleAlign 字段
	if (update.titleAlign !== undefined) {
		const titleAlignPattern = /titleAlign:\s*['"][^'"]*['"]/
		const titleAlignString = `titleAlign: "${update.titleAlign}"`

		if (titleAlignPattern.test(updatedContent)) {
			updatedContent = updatedContent.replace(titleAlignPattern, titleAlignString)
		} else {
			// 如果没有 titleAlign 字段，在 title 字段后添加，或者在 id 字段后添加
			const titleFieldPattern = /(title:\s*['"][^'"]*['"])/
			const idFieldPattern = /(id:\s*['"][^'"]*['"])/

			if (titleFieldPattern.test(updatedContent)) {
				updatedContent = updatedContent.replace(
					titleFieldPattern,
					`$1,\n  ${titleAlignString}`,
				)
			} else if (idFieldPattern.test(updatedContent)) {
				updatedContent = updatedContent.replace(
					idFieldPattern,
					`$1,\n  ${titleAlignString}`,
				)
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
      document.addEventListener("ConfigManagerReady", (event) => {
				configManager = event.detail;
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
				if (event.data && event.data.type === "editModeChange" && configManager) {
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
						(filePathSplit[0] === "geo" || filePathSplit[0] === "cleaned_data") &&
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
