/**
 * 附件数据处理服务
 * 统一处理附件数据，包括 display_config 的特殊逻辑
 * 解决 index.html 文件使用父目录 display_config 的问题
 */

import {
	getCustomIndexPath,
	resolveFileByRelativePath,
} from "../components/MessageList/components/MessageAttachment/utils"
import { AttachmentItem } from "../components/TopicFilesButton/hooks"

export interface ProcessedAttachmentData {
	tree: any[]
	list: any[]
}

export class AttachmentDataProcessor {
	/**
	 * 统一处理附件数据，包括 display_config 的特殊逻辑
	 * 内部自闭环处理验证和返回逻辑，减少调用层的代码复杂度
	 * @param rawData API返回的原始数据
	 * @returns 处理后的附件数据，如果处理失败则返回原始数据
	 */
	static processAttachmentData(rawData: {
		tree: AttachmentItem[]
		list: AttachmentItem[]
	}): ProcessedAttachmentData {
		if (!rawData) {
			return { tree: [], list: [] }
		}

		const { tree = [] } = rawData

		// 从 tree 生成 list（扁平化）
		const list = this.flattenAttachments(tree)

		try {
			// 扁平化所有项目以便查找父目录
			const flatItems = this.flattenAttachments([...tree, ...list])

			// 处理树形结构
			const processedTree = this.processDisplayConfigForItems(tree, flatItems)

			// 处理扁平列表
			const processedList = this.processDisplayConfigForItems(list, flatItems)

			const processedData = {
				tree: processedTree,
				list: processedList,
			}

			// 内部验证处理后的数据
			if (this.validateProcessedData(processedData)) {
				return processedData
			} else {
				console.warn("🔶 AttachmentDataProcessor: 处理后的数据验证失败，返回原始数据")
				return { tree, list }
			}
		} catch (error) {
			console.error("🔴 AttachmentDataProcessor: 处理数据时发生错误，返回原始数据:", error)
			return { tree, list }
		}
	}

	/**
	 * 处理项目列表中的 display_config
	 * @param items 要处理的项目列表
	 * @param allItems 所有项目的扁平列表（用于查找父目录）
	 * @returns 处理后的项目列表
	 */
	private static processDisplayConfigForItems(
		items: AttachmentItem[],
		allItems: AttachmentItem[],
	): AttachmentItem[] {
		return items.map((item) => {
			// custom 入口文件：使用祖先文件夹 metadata（与 index.html 类似）
			const customAncestorResult = this.findCustomAncestorDisplayConfig(item, allItems)
			if (customAncestorResult) {
				return {
					...item,
					display_config: {
						...customAncestorResult.display_config,
						_customFolderId: customAncestorResult.customFolderId,
					},
					_originalDisplayConfig: item.display_config,
				}
			}

			// index.html 特殊处理逻辑
			if (this.isIndexHtmlFile(item) && item.parent_id) {
				const parentDisplayConfig = this.findParentDisplayConfig(item.parent_id, allItems)
				if (parentDisplayConfig) {
					console.log(
						"🎯 数据源头处理：检测到index.html文件，使用父目录display_config:",
						parentDisplayConfig,
					)
					return {
						...item,
						display_config: parentDisplayConfig,
						_originalDisplayConfig: item.display_config, // 保留原始 display_config 以备后用
					}
				}
			}

			// 递归处理子项
			if (item.children && Array.isArray(item.children)) {
				const result = {
					...item,
					children: this.processDisplayConfigForItems(item.children, allItems),
				}

				// 如果 item.display_config 的 type 是 slide，按照 slices 排序
				if (
					item.display_config?.type === "slide" &&
					Array.isArray(item.display_config?.slides)
				) {
					// slides 中部分是相对路径，部分是名称，统一截取成名称
					const slidesOrder = (item.display_config.slides as string[]).map((slide) =>
						slide.split("/").pop(),
					)

					result.children = result.children.sort((a, b) => {
						const aName = a.file_name || a.filename || ""
						const bName = b.file_name || b.filename || ""
						const aIndex = slidesOrder.indexOf(aName)
						const bIndex = slidesOrder.indexOf(bName)

						// 如果都在 slides 中，按照 slides 的顺序排序
						if (aIndex !== -1 && bIndex !== -1) {
							return aIndex - bIndex
						}
						// 如果只有 a 在 slides 中，a 排在前面
						if (aIndex !== -1) {
							return -1
						}
						// 如果只有 b 在 slides 中，b 排在前面
						if (bIndex !== -1) {
							return 1
						}
						// 如果都不在 slides 中，保持原顺序
						return 0
					})
				}

				return result
			}

			return item
		})
	}

	/**
	 * 自底向上查找：若当前文件是某 custom 文件夹 index 解析出的入口文件，则返回该文件夹 display_config
	 */
	private static findCustomAncestorDisplayConfig(
		item: AttachmentItem,
		allItems: AttachmentItem[],
	): { display_config: Record<string, unknown>; customFolderId: string } | null {
		if (!item.file_id || item.is_directory) return null

		let parentId: string | number | null | undefined = item.parent_id
		while (parentId !== undefined && parentId !== null) {
			const ancestor = allItems.find((x) => String(x.file_id) === String(parentId))
			if (!ancestor) break

			const meta = ancestor.display_config as Record<string, unknown> | undefined
			const indexPath = getCustomIndexPath(meta)
			if (ancestor.is_directory && meta?.type === "custom" && indexPath) {
				const resolved = resolveFileByRelativePath(
					ancestor.children as unknown[] | undefined,
					indexPath,
				) as { file_id?: string } | null
				if (resolved?.file_id && resolved.file_id === item.file_id) {
					return {
						display_config: meta as Record<string, unknown>,
						customFolderId: String(ancestor.file_id),
					}
				}
			}
			parentId = ancestor.parent_id
		}
		return null
	}

	/**
	 * 判断是否为 index.html 文件
	 * @param item 文件项
	 * @returns 是否为 index.html 文件
	 */
	private static isIndexHtmlFile(item: any): boolean {
		const fileName = item.file_name || item.filename || item.display_filename || ""
		return fileName.toLowerCase() === "index.html"
	}

	/**
	 * 查找父目录的 display_config
	 * @param parentId 父目录ID
	 * @param allItems 所有项目列表
	 * @returns 父目录的 display_config
	 */
	private static findParentDisplayConfig(parentId: string | number, allItems: any[]): any {
		const parent = allItems.find((item) => item.file_id === String(parentId))
		return parent?.display_config
	}

	/**
	 * 扁平化附件列表的辅助函数
	 * 将嵌套的附件结构展开为一维数组
	 * @param items 嵌套的附件列表
	 * @returns 扁平化的附件列表
	 */
	private static flattenAttachments(items: any[]): any[] {
		let result: any[] = []
		items.forEach((item) => {
			result.push(item)
			if (item.children && Array.isArray(item.children)) {
				result = result.concat(this.flattenAttachments(item.children))
			}
		})
		return result
	}

	/**
	 * 验证处理后的数据结构
	 * @param data 处理后的数据
	 * @returns 验证结果
	 */
	static validateProcessedData(data: ProcessedAttachmentData): boolean {
		try {
			return (
				Array.isArray(data.tree) &&
				Array.isArray(data.list) &&
				data.tree.every((item) => item.file_id) &&
				data.list.every((item) => item.file_id)
			)
		} catch (error) {
			console.error("数据验证失败:", error)
			return false
		}
	}
}
