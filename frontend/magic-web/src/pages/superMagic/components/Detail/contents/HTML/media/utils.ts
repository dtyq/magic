import {
	getTemporaryDownloadUrl,
	downloadFileContent,
} from "@/pages/superMagic/utils/api"
import { flattenAttachments, findMatchingFile } from "../utils"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { SuperMagicApi } from "@/apis"

/**
 * magic.project.js文件信息
 */
export interface MagicProjectJsFileInfo {
	fileId: string
	content: string
}

/**
 * 媒体说话人信息
 */
export interface MediaSpeaker {
	id: string
	name: string
	avatar?: string

	[key: string]: unknown
}

/**
 * 说话人映射对象 (Speaker ID -> Speaker Name)
 */
export type MediaSpeakersMap = Record<string, string>

/**
 * Media场景消息类型常量
 */
export const MEDIA_MESSAGE_TYPES = {
	SPEAKER_EDITED: "MEDIA_SPEAKER_EDITED",
	IMAGE_URL_REQUEST: "MAGIC_MEDIA_IMAGE_URL_REQUEST",
	IMAGE_URL_RESPONSE: "MAGIC_MEDIA_IMAGE_URL_RESPONSE",
} as const

/**
 * 查找同目录下的magic.project.js文件
 */
export async function findMagicProjectJsFile(params: {
	attachments: FileItem[]
	attachmentList: FileItem[]
	currentFileId: string
	currentFileName: string
}): Promise<MagicProjectJsFileInfo | null> {
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

		// 查找同目录下的magic.project.js文件
		const allFiles = flattenAttachments(attachments)

		// 尝试多种方式查找magic.project.js文件
		let magicProjectJsFile = null

		// 方式1: 直接查找 ./magic.project.js
		magicProjectJsFile = findMatchingFile({
			path: "./magic.project.js",
			allFiles: allFiles,
			htmlRelativeFolderPath: htmlRelativeFolderPath,
		})

		// 方式2: 如果方式1失败，尝试查找 magic.project.js
		if (!magicProjectJsFile) {
			magicProjectJsFile = findMatchingFile({
				path: "magic.project.js",
				allFiles: allFiles,
				htmlRelativeFolderPath: htmlRelativeFolderPath,
			})
		}

		// 方式3: 直接在同目录下查找名为magic.project.js的文件
		if (!magicProjectJsFile) {
			const targetPath = htmlRelativeFolderPath + "magic.project.js"
			magicProjectJsFile = allFiles.find(
				(file: FileItem) => file.relative_file_path === targetPath,
			)
		}

		// 方式4: 查找所有.js文件，看是否有magic.project.js
		if (!magicProjectJsFile) {
			const jsFiles = allFiles.filter(
				(file: FileItem) =>
					file.file_name === "magic.project.js" ||
					file.file_name.endsWith("/magic.project.js"),
			)
			if (jsFiles.length > 0) {
				magicProjectJsFile = jsFiles[0] // 取第一个匹配的
			}
		}

		if (!magicProjectJsFile) {
			return null
		}

		// 获取magic.project.js文件的内容
		const downloadUrls = await getTemporaryDownloadUrl({
			file_ids: [magicProjectJsFile.file_id],
		})
		if (downloadUrls && downloadUrls[0]?.url) {
			const content = await downloadFileContent(downloadUrls[0].url)

			return {
				fileId: magicProjectJsFile.file_id,
				content: content as string,
			}
		}

		return null
	} catch (error) {
		console.error("Failed to load magic.project.js file:", error)
		return null
	}
}

/**
 * 更新JavaScript文件中的AUDIO_SPEAKERS数组
 */
export function updateMediaSpeakersInJS(
	jsContent: string,
	speakerUpdates: Array<{
		id: string
		name?: string
		avatar?: string
		[key: string]: unknown
	}>,
): string {
	try {
		// 找到AUDIO_SPEAKERS数组的开始和结束位置
		const startPattern = /const\s+AUDIO_SPEAKERS\s*=\s*\[/
		const startMatch = jsContent.match(startPattern)

		if (!startMatch) {
			return jsContent
		}

		const startIndex = (startMatch.index ?? 0) + startMatch[0].length - 1 // 包含 [

		// 找到对应的结束 ]
		let bracketCount = 0
		let endIndex = -1

		for (let i = startIndex; i < jsContent.length; i++) {
			const char = jsContent[i]
			if (char === "[") {
				bracketCount++
			} else if (char === "]") {
				bracketCount--
				if (bracketCount === 0) {
					endIndex = i
					break
				}
			}
		}

		if (endIndex === -1) {
			return jsContent
		}

		// 提取数组内容
		let arrayContent = jsContent.substring(startIndex + 1, endIndex)

		// 更新每个说话人对象的字段
		const speakerUpdateOperations: Array<{
			start: number
			end: number
			newContent: string
			speakerId: string
		}> = []

		speakerUpdates.forEach((update) => {
			const { id: speakerId, name: newName, avatar: newAvatar, ...otherFields } = update

			// 匹配包含指定id的整个说话人对象
			const idPattern = new RegExp("id:\\s*[\"']" + speakerId + "[\"']", "g")
			idPattern.lastIndex = 0 // 重置正则表达式状态
			const idMatch = idPattern.exec(arrayContent)

			if (!idMatch) {
				return
			}

			// 从id位置向前查找对象的开始 {
			const objStart = arrayContent.lastIndexOf("{", idMatch.index)
			if (objStart === -1) {
				return
			}

			// 从objStart位置向后查找对象的结束 }
			let braceCount = 0
			let objEnd = -1
			for (let i = objStart; i < arrayContent.length; i++) {
				const char = arrayContent[i]
				if (char === "{") {
					braceCount++
				} else if (char === "}") {
					braceCount--
					if (braceCount === 0) {
						objEnd = i
						break
					}
				}
			}

			if (objEnd === -1) {
				return
			}

			// 提取完整的说话人对象内容
			let speakerObjectContent = arrayContent.substring(objStart, objEnd + 1)

			// 更新 name 字段
			if (newName !== undefined) {
				const namePattern = /name:\s*['"][^'"]*['"]/
				const nameString = `name: "${newName}"`

				if (namePattern.test(speakerObjectContent)) {
					speakerObjectContent = speakerObjectContent.replace(namePattern, nameString)
				} else {
					// 如果没有 name 字段，在 id 字段后添加
					const idFieldPattern = /(id:\s*['"][^'"]*['"])/
					if (idFieldPattern.test(speakerObjectContent)) {
						speakerObjectContent = speakerObjectContent.replace(
							idFieldPattern,
							`$1,\n  ${nameString}`,
						)
					}
				}
			}

			// 更新 avatar 字段
			if (newAvatar !== undefined) {
				const avatarPattern = /avatar:\s*['"][^'"]*['"]/
				const avatarString = `avatar: "${newAvatar}"`

				if (avatarPattern.test(speakerObjectContent)) {
					speakerObjectContent = speakerObjectContent.replace(avatarPattern, avatarString)
				} else {
					// 如果没有 avatar 字段，在 name 字段后添加，或者在 id 字段后添加
					const nameFieldPattern = /(name:\s*['"][^'"]*['"])/
					const idFieldPattern = /(id:\s*['"][^'"]*['"])/

					if (nameFieldPattern.test(speakerObjectContent)) {
						speakerObjectContent = speakerObjectContent.replace(
							nameFieldPattern,
							`$1,\n  ${avatarString}`,
						)
					} else if (idFieldPattern.test(speakerObjectContent)) {
						speakerObjectContent = speakerObjectContent.replace(
							idFieldPattern,
							`$1,\n  ${avatarString}`,
						)
					}
				}
			}

			// 更新其他字段
			Object.entries(otherFields).forEach(([key, value]) => {
				if (value !== undefined) {
					const fieldPattern = new RegExp(`${key}:\\s*['"][^'"]*['"]`)
					const fieldString = `${key}: "${value}"`

					if (fieldPattern.test(speakerObjectContent)) {
						speakerObjectContent = speakerObjectContent.replace(
							fieldPattern,
							fieldString,
						)
					} else {
						// 在对象末尾添加新字段
						const closingBracePattern = /(\s*})$/
						if (closingBracePattern.test(speakerObjectContent)) {
							speakerObjectContent = speakerObjectContent.replace(
								closingBracePattern,
								`,\n  ${fieldString}$1`,
							)
						}
					}
				}
			})

			// 收集更新信息，稍后统一处理
			speakerUpdateOperations.push({
				start: objStart,
				end: objEnd + 1,
				newContent: speakerObjectContent,
				speakerId: speakerId,
			})
		})

		// 按照位置从后往前排序，这样更新时不会影响前面的索引
		speakerUpdateOperations.sort((a, b) => b.start - a.start)

		// 统一应用所有更新
		speakerUpdateOperations.forEach((update) => {
			arrayContent =
				arrayContent.substring(0, update.start) +
				update.newContent +
				arrayContent.substring(update.end)
		})

		// 重新组装完整的JavaScript内容
		const updatedJsContent =
			jsContent.substring(0, startIndex + 1) + arrayContent + jsContent.substring(endIndex)

		return updatedJsContent
	} catch (error) {
		console.error("Error updating AUDIO_SPEAKERS in JS:", error)
		return jsContent
	}
}

/**
 * 从magic.project.js文件内容中提取所有说话人的完整信息
 */
export function extractSpeakersFromMagicProjectJs(jsContent: string): Partial<MediaSpeaker>[] {
	const speakers: Partial<MediaSpeaker>[] = []

	try {
		// 找到AUDIO_SPEAKERS数组的开始和结束位置
		const startPattern = /const\s+AUDIO_SPEAKERS\s*=\s*\[/
		const startMatch = jsContent.match(startPattern)

		if (!startMatch) {
			return speakers
		}

		const startIndex = (startMatch.index ?? 0) + startMatch[0].length - 1 // 包含 [

		// 找到对应的结束 ]
		let bracketCount = 0
		let endIndex = -1

		for (let i = startIndex; i < jsContent.length; i++) {
			const char = jsContent[i]
			if (char === "[") {
				bracketCount++
			} else if (char === "]") {
				bracketCount--
				if (bracketCount === 0) {
					endIndex = i
					break
				}
			}
		}

		if (endIndex === -1) {
			return speakers
		}

		// 提取数组内容
		const arrayContent = jsContent.substring(startIndex + 1, endIndex)

		// 查找所有说话人对象
		let objStart = 0
		while (objStart < arrayContent.length) {
			// 查找下一个对象开始
			const nextObjStart = arrayContent.indexOf("{", objStart)
			if (nextObjStart === -1) break

			// 找到对应的对象结束
			let braceCount = 0
			let objEnd = -1
			for (let i = nextObjStart; i < arrayContent.length; i++) {
				const char = arrayContent[i]
				if (char === "{") {
					braceCount++
				} else if (char === "}") {
					braceCount--
					if (braceCount === 0) {
						objEnd = i
						break
					}
				}
			}

			if (objEnd === -1) break

			// 提取对象内容
			const objContent = arrayContent.substring(nextObjStart, objEnd + 1)

			// 提取各个字段
			const speaker: Partial<MediaSpeaker> = {}

			// 提取 id
			const idMatch = objContent.match(/id:\s*['"]([^'"]+)['"]/)
			if (idMatch) {
				speaker.id = idMatch[1]
			}

			// 提取 name
			const nameMatch = objContent.match(/name:\s*['"]([^'"]*?)['"]/)
			if (nameMatch) {
				speaker.name = nameMatch[1]
			}

			// 提取 avatar
			const avatarMatch = objContent.match(/avatar:\s*['"]([^'"]*?)['"]/)
			if (avatarMatch) {
				speaker.avatar = avatarMatch[1]
			}

			if (speaker.id) {
				speakers.push(speaker)
			}

			objStart = objEnd + 1
		}
	} catch (error) {
		console.error("Error extracting speakers from magic.project.js:", error)
	}

	return speakers
}

/**
 * 更新magic.project.js文件中的metadata.speakers对象
 * 支持处理各种复杂情况：单引号、双引号、换行、嵌套等
 */
function updateSpeakersInMagicProjectJS(content: string, speakers: MediaSpeakersMap): string {
	try {
		// 使用更精确的方式查找speakers对象
		const result = findAndReplaceSpeakersObject(content, speakers)

		if (!result.found) {
			console.warn("未找到speakers对象，无法更新")
			return content
		}

		return result.content
	} catch (error) {
		console.error("更新speakers对象失败:", error)
		return content
	}
}

/**
 * 查找并替换speakers对象的核心逻辑
 * 处理各种边界情况：单引号、双引号、换行、注释、嵌套等
 */
function findAndReplaceSpeakersObject(
	content: string,
	speakers: MediaSpeakersMap,
): {
	found: boolean
	content: string
} {
	// 查找speakers属性的多种模式
	const speakersPatterns = [
		// 双引号key
		/("speakers"\s*:\s*\{)/,
		// 单引号key
		/('speakers'\s*:\s*\{)/,
		// 无引号key
		/(speakers\s*:\s*\{)/,
	]

	let speakersMatch: RegExpMatchArray | null = null
	let matchedPattern: RegExp | null = null

	// 尝试匹配各种模式
	for (const pattern of speakersPatterns) {
		speakersMatch = content.match(pattern)
		if (speakersMatch) {
			matchedPattern = pattern
			break
		}
	}

	if (!speakersMatch || !matchedPattern) {
		return { found: false, content }
	}

	const startIndex = speakersMatch.index ?? 0
	const keyAndColonLength = speakersMatch[0].length

	// 从开始大括号位置开始查找匹配的结束大括号
	const openBraceIndex = startIndex + keyAndColonLength - 1 // 减1因为包含了{
	const closeBraceIndex = findMatchingBrace(content, openBraceIndex)

	if (closeBraceIndex === -1) {
		return { found: false, content }
	}

	// 提取当前的缩进级别
	const lineStart = content.lastIndexOf("\n", startIndex) + 1
	const currentIndent = content.substring(lineStart, startIndex).match(/^\s*/)?.[0] || ""

	// 生成新的speakers对象内容
	const newSpeakersContent = generateSpeakersObjectContent(speakers, currentIndent)

	// 构建新的内容
	const beforeSpeakers = content.substring(0, openBraceIndex)
	const afterSpeakers = content.substring(closeBraceIndex + 1)

	return {
		found: true,
		content: beforeSpeakers + newSpeakersContent + afterSpeakers,
	}
}

/**
 * 查找匹配的右大括号位置
 * 正确处理字符串、注释、嵌套大括号等情况
 */
function findMatchingBrace(content: string, startIndex: number): number {
	let braceCount = 0
	let i = startIndex
	let inString = false
	let stringChar = ""
	let inSingleLineComment = false
	let inMultiLineComment = false

	while (i < content.length) {
		const char = content[i]
		const nextChar = content[i + 1]
		const prevChar = content[i - 1]

		// 处理注释
		if (!inString) {
			// 单行注释
			if (char === "/" && nextChar === "/" && !inMultiLineComment) {
				inSingleLineComment = true
				i += 2
				continue
			}
			// 多行注释开始
			if (char === "/" && nextChar === "*" && !inSingleLineComment) {
				inMultiLineComment = true
				i += 2
				continue
			}
			// 多行注释结束
			if (char === "*" && nextChar === "/" && inMultiLineComment) {
				inMultiLineComment = false
				i += 2
				continue
			}
			// 单行注释在换行时结束
			if (char === "\n" && inSingleLineComment) {
				inSingleLineComment = false
			}
		}

		// 如果在注释中，跳过
		if (inSingleLineComment || inMultiLineComment) {
			i++
			continue
		}

		// 处理字符串
		if (!inString && (char === '"' || char === "'")) {
			// 检查是否是转义的引号
			if (prevChar !== "\\") {
				inString = true
				stringChar = char
			}
		} else if (inString && char === stringChar) {
			// 检查是否是转义的引号
			if (prevChar !== "\\") {
				inString = false
				stringChar = ""
			}
		}

		// 如果在字符串中，跳过大括号计数
		if (inString) {
			i++
			continue
		}

		// 计数大括号
		if (char === "{") {
			braceCount++
		} else if (char === "}") {
			braceCount--
			if (braceCount === 0) {
				return i
			}
		}

		i++
	}

	return -1 // 未找到匹配的右大括号
}

/**
 * 生成speakers对象的内容字符串
 * 保持适当的缩进和格式
 */
function generateSpeakersObjectContent(speakers: MediaSpeakersMap, baseIndent: string): string {
	const entries = Object.entries(speakers)

	if (entries.length === 0) {
		return "{}"
	}

	// 内部缩进比基础缩进多一个tab
	const innerIndent = baseIndent + "\t"

	const speakersEntries = entries
		.map(([id, name]) => {
			// 转义特殊字符
			const escapedId = escapeStringForJS(id)
			const escapedName = escapeStringForJS(name)
			return `${innerIndent}"${escapedId}": "${escapedName}"`
		})
		.join(",\n")

	return `{\n${speakersEntries}\n${baseIndent}}`
}

/**
 * 为JavaScript字符串转义特殊字符
 */
function escapeStringForJS(str: string): string {
	return str
		.replace(/\\/g, "\\\\") // 反斜杠
		.replace(/"/g, '\\"') // 双引号
		.replace(/'/g, "\\'") // 单引号
		.replace(/\n/g, "\\n") // 换行符
		.replace(/\r/g, "\\r") // 回车符
		.replace(/\t/g, "\\t") // 制表符
}

/**
 * 保存媒体说话人配置和magic.project.js文件
 */
export async function saveMediaSpeakersAndMagicProjectJs(params: {
	mediaSpeakers: MediaSpeakersMap
	magicProjectJsFileInfo: MagicProjectJsFileInfo | null
}): Promise<void> {
	const { mediaSpeakers, magicProjectJsFileInfo } = params

	try {
		const filesToSave = []

		// 处理magic.project.js文件的保存
		if (magicProjectJsFileInfo && mediaSpeakers) {
			// 直接替换metadata.speakers对象
			const updatedContent = updateSpeakersInMagicProjectJS(
				magicProjectJsFileInfo.content,
				mediaSpeakers,
			)

			filesToSave.push({
				file_id: magicProjectJsFileInfo.fileId,
				content: updatedContent,
				enable_shadow: true,
			})
		}

		// 批量保存文件
		if (filesToSave.length > 0) {
			await SuperMagicApi.saveFileContent(filesToSave)
		}
	} catch (error) {
		console.error("保存媒体说话人配置失败:", error)
		throw error
	}
}

/**
 * 验证媒体说话人数据结构
 */
export function validateMediaSpeakers(speakers: unknown): speakers is MediaSpeakersMap {
	if (!speakers || typeof speakers !== "object") {
		return false
	}

	return Object.entries(speakers as Record<string, unknown>).every(([id, name]) => {
		return typeof id === "string" && id.length > 0 && typeof name === "string"
	})
}

/**
 * 生成marked.js图片路径代理脚本（Media场景专用）
 * 拦截marked的renderer.image方法，将相对路径转换为OSS URL
 *
 * @param fileId 文件ID，用于验证请求来源
 * @returns 图片路径代理脚本字符串
 */
export function generateMarkedImageProxyScript(fileId = ""): string {
	return `
(function() {
	// URL缓存，存储已解析的URL
	var imageUrlCache = new Map();
	// 正在进行的请求缓存，避免同时发起多个相同的请求
	var pendingImageRequests = new Map();
	
	// 检查是否为相对路径
	function isRelativePath(url) {
		return !/^(https?:\\/\\/|\\/\\/|data:|blob:)/.test(url);
	}
	
	// 生成唯一的请求ID
	function generateRequestId() {
		return 'image_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
	}
	
	// 通过postMessage请求父容器解析图片URL
	function requestImageUrlFromParent(relativePath) {
		return new Promise(function(resolve, reject) {
			var requestId = generateRequestId();
			
			// 设置超时
			var timeout = setTimeout(function() {
				window.removeEventListener('message', messageHandler);
				// 清理pending状态
				pendingImageRequests.delete(relativePath);
				reject(new Error('图片URL解析超时'));
			}, 10000); // 10秒超时
			
			// 监听父容器的响应
			function messageHandler(event) {
				if (
					event.data &&
					event.data.type === '${MEDIA_MESSAGE_TYPES.IMAGE_URL_RESPONSE}' &&
					event.data.requestId === requestId
				) {
					clearTimeout(timeout);
					window.removeEventListener('message', messageHandler);
					
					if (event.data.success) {
						// 缓存结果到imageUrlCache
						imageUrlCache.set(relativePath, event.data.url);
						// 清理pending状态
						pendingImageRequests.delete(relativePath);
						resolve(event.data.url);
					} else {
						// 清理pending状态
						pendingImageRequests.delete(relativePath);
						reject(new Error(event.data.error || '图片URL解析失败'));
					}
				}
			}
			
			window.addEventListener('message', messageHandler);
			
			// 向父容器发送请求
			window.parent.postMessage({
				type: '${MEDIA_MESSAGE_TYPES.IMAGE_URL_REQUEST}',
				requestId: requestId,
				relativePath: relativePath,
				fileId: window.__MAGIC_FILE_ID__ || '${fileId}'
			}, '*');
		});
	}
	
	// 解析图片URL（同步返回缓存值或原始路径，异步更新）
	async function resolveImageUrl(src) {
		// 如果不是相对路径，直接返回
		if (!isRelativePath(src)) {
			return src;
		}
		
		// 1. 检查已完成的缓存
		if (imageUrlCache.has(src)) {
			return imageUrlCache.get(src);
		}
		
		// 2. 检查是否有正在进行的请求
		if (pendingImageRequests.has(src)) {
			try {
				// 等待正在进行的请求完成
				var resolvedUrl = await pendingImageRequests.get(src);
				return resolvedUrl;
			} catch (error) {
				// 如果pending请求失败，返回原始路径
				return src;
			}
		}
		
		// 3. 发起新的请求
		try {
			// 创建Promise并缓存到pending中
			var requestPromise = requestImageUrlFromParent(src);
			pendingImageRequests.set(src, requestPromise);
			
			var resolvedUrl = await requestPromise;
			return resolvedUrl;
		} catch (error) {
			// 请求失败，返回原始路径
			return src;
		}
	}
	
	// 等待 marked 库加载完成后，重写 renderer.image 方法
	function setupMarkedImageProxy() {
		if (typeof marked !== 'undefined' && marked.Renderer) {
			var originalImageRenderer = marked.Renderer.prototype.image;
			
			// 重写 image renderer
			marked.Renderer.prototype.image = function(href, title, text) {
				// 如果是相对路径，尝试解析
				if (isRelativePath(href)) {
					// 检查缓存
					if (imageUrlCache.has(href)) {
						href = imageUrlCache.get(href);
					} else {
						// 异步解析URL并更新DOM
						resolveImageUrl(href).then(function(resolvedUrl) {
							if (resolvedUrl !== href) {
								// 查找所有使用该相对路径的img标签并更新
								var images = document.querySelectorAll('img[data-original-src="' + href + '"]');
								images.forEach(function(img) {
									img.src = resolvedUrl;
								});
							}
						}).catch(function(error) {
							console.error('解析图片URL失败:', error);
						});
					}
				}
				
				// 调用原始的 renderer，生成 img 标签
				var imgHtml = originalImageRenderer.call(this, href, title, text);
				
				// 为img标签添加 data-original-src 属性，用于后续更新
				if (isRelativePath(href)) {
					imgHtml = imgHtml.replace('<img', '<img data-original-src="' + href + '"');
				}
				
				return imgHtml;
			};
			
			console.log('Marked.js 图片路径代理已启用');
		} else {
			// 如果 marked 还未加载，等待一段时间后重试
			setTimeout(setupMarkedImageProxy, 100);
		}
	}
	
	// 页面加载完成后设置代理
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', setupMarkedImageProxy);
	} else {
		setupMarkedImageProxy();
	}
})();
`
}

/**
 * 创建图片URL请求的消息处理器（Media场景专用）
 * 用于父容器处理iframe中marked.js的图片路径解析请求
 *
 * @param allFiles 所有文件列表
 * @param htmlRelativeFolderPath HTML文件的相对文件夹路径
 * @param fileId 文件ID，用于验证请求来源
 * @returns 消息处理函数
 */
export function createImageUrlMessageHandler(
	allFiles: FileItem[],
	htmlRelativeFolderPath: string,
	fileId: string,
) {
	return async (event: MessageEvent) => {
		// 验证消息来源和类型
		if (!event.data || event.data.type !== MEDIA_MESSAGE_TYPES.IMAGE_URL_REQUEST) {
			return
		}

		const { requestId, relativePath, fileId: messageFileId } = event.data

		// 验证文件ID，忽略旧文件的请求
		if (messageFileId && messageFileId !== fileId) {
			return
		}

		try {
			// 查找匹配的文件
			const matchedFile = findMatchingFile({
				path: relativePath,
				allFiles,
				htmlRelativeFolderPath,
			})

			if (matchedFile) {
				// 使用 getTemporaryDownloadUrl 获取OSS URL
				const response = await getTemporaryDownloadUrl({ file_ids: [matchedFile.file_id] })

				if (response && response.length > 0 && response[0].url) {
					const ossUrl = response[0].url

					// 发送成功响应
					;(event.source as Window)?.postMessage(
						{
							type: MEDIA_MESSAGE_TYPES.IMAGE_URL_RESPONSE,
							requestId,
							success: true,
							url: ossUrl,
						},
						"*",
					)
					return
				}
			}

			// 发送失败响应
			;(event.source as Window)?.postMessage(
				{
					type: MEDIA_MESSAGE_TYPES.IMAGE_URL_RESPONSE,
					requestId,
					success: false,
					error: "未找到匹配的图片文件",
				},
				"*",
			)
		} catch (error) {
			// 发送错误响应
			;(event.source as Window)?.postMessage(
				{
					type: MEDIA_MESSAGE_TYPES.IMAGE_URL_RESPONSE,
					requestId,
					success: false,
					error: error instanceof Error ? error.message : "未知错误",
				},
				"*",
			)
		}
	}
}

/**
 * 处理Media场景的图片URL请求消息
 * 用于IsolatedHTMLRenderer中处理MEDIA_MESSAGE_TYPES.IMAGE_URL_REQUEST消息
 *
 * @param event 消息事件
 * @param attachmentList 附件列表
 * @param fileId 当前文件ID
 */
export async function handleMediaImageUrlRequest(
	event: MessageEvent,
	attachmentList: any[],
	fileId: string,
) {
	// 获取当前HTML文件的目录路径
	const currentFile = attachmentList?.find((item: any) => item.file_id === fileId)
	if (!currentFile?.relative_file_path) {
		return
	}

	// 计算HTML文件所在的目录
	const htmlRelativeFolderPath = currentFile.relative_file_path.replace(currentFile.file_name, "")

	// 查找匹配的文件
	const allFiles = flattenAttachments(attachmentList || [])

	// 使用公共的消息处理器
	const imageUrlHandler = createImageUrlMessageHandler(allFiles, htmlRelativeFolderPath, fileId)
	await imageUrlHandler(event)
}

/**
 * 向HTML注入Media脚本
 * 用于支持媒体说话人编辑事件和marked.js图片路径代理
 *
 * @param html 原始HTML内容
 * @param fileId 文件ID，用于图片路径解析验证
 * @returns 注入脚本后的HTML内容
 */
export function injectMediaHTMLScript(html: string, fileId = ""): string {
	// 生成marked.js图片路径代理脚本
	const markedImageProxyScript = generateMarkedImageProxyScript(fileId)

	return `
		${html}
		<script data-injected="true">
			var mediaManager = null;
			document.addEventListener("AudioManagerReady", (event) => {
				mediaManager = event.detail;
			});
			
			// 等待 addSpeakerEditListener 函数可用后再注册监听器
			function setupSpeakerEditListener() {
				if (typeof window.addSpeakerEditListener === "function") {
					window.addSpeakerEditListener((eventData) => {
						window.parent.postMessage({
							type: "${MEDIA_MESSAGE_TYPES.SPEAKER_EDITED}",
							detail: eventData,
						}, "*");
					});
				} else {
					// 如果函数还未定义，等待一段时间后重试
					setTimeout(setupSpeakerEditListener, 100);
				}
			}
			
			// 页面加载完成后尝试设置监听器
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", setupSpeakerEditListener);
			} else {
				setupSpeakerEditListener();
			}
			
			window.addEventListener("message", (event) => {
				if (event.data && event.data.type === "editModeChange" && mediaManager) {
					var isEditMode = event.data.isEditMode;
					mediaManager.setEditorConfig(oldState => {
						return {
							...oldState,
							EDITABLE: isEditMode,
						}
					});
				}
				// 监听 tab 切换消息，暂停媒体播放
				if (event.data && event.data.type === "tabDeactivated") {
					if (window.mediaControls) {
						if (window.mediaControls.isPlaying && window.mediaControls.isPlaying()) {
							window.mediaControls.pause();
						}
					} else {
						// 当 window.mediaControls 不存在时，从 document 中查找 audio/video 元素并暂停
						var audioElements = document.querySelectorAll("audio");
						audioElements.forEach(function(audio) {
							if (!audio.paused) {
								audio.pause();
							}
						});
						var videoElements = document.querySelectorAll("video");
						videoElements.forEach(function(video) {
							if (!video.paused) {
								video.pause();
							}
						});
					}
				}
			});
			${markedImageProxyScript}
		</script>
	`
}

// ============== 兼容旧API的别名导出 ==============
// 为了向后兼容，保留旧的命名导出

/** @deprecated 使用 MediaSpeaker 代替 */
export type AudioSpeaker = MediaSpeaker

/** @deprecated 使用 MediaSpeakersMap 代替 */
export type AudioSpeakersMap = MediaSpeakersMap

/** @deprecated 使用 MEDIA_MESSAGE_TYPES 代替 */
export const AUDIO_MESSAGE_TYPES = MEDIA_MESSAGE_TYPES

/** @deprecated 使用 updateMediaSpeakersInJS 代替 */
export const updateAudioSpeakersInJS = updateMediaSpeakersInJS

/** @deprecated 使用 saveMediaSpeakersAndMagicProjectJs 代替 */
export async function saveAudioSpeakersAndMagicProjectJs(params: {
	audioSpeakers: MediaSpeakersMap
	magicProjectJsFileInfo: MagicProjectJsFileInfo | null
}): Promise<void> {
	return saveMediaSpeakersAndMagicProjectJs({
		mediaSpeakers: params.audioSpeakers,
		magicProjectJsFileInfo: params.magicProjectJsFileInfo,
	})
}

/** @deprecated 使用 validateMediaSpeakers 代替 */
export const validateAudioSpeakers = validateMediaSpeakers

/** @deprecated 使用 handleMediaImageUrlRequest 代替 */
export const handleAudioImageUrlRequest = handleMediaImageUrlRequest

/** @deprecated 使用 injectMediaHTMLScript 代替 */
export const injectAudioHTMLScript = injectMediaHTMLScript
