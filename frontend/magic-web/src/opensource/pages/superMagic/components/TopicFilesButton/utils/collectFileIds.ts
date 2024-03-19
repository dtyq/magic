import type { AttachmentItem } from "../hooks/types"

interface CollectFileIdsOptions {
	items: AttachmentItem[]
	selectedItems?: Set<string>
	getItemId?: (item: AttachmentItem) => string
	includeFolderIds?: boolean
	filterFn?: (item: AttachmentItem) => boolean
}

/**
 * 收集文件ID的工具函数
 * @param options 配置选项
 * @param options.items 文件列表
 * @param options.selectedItems 选中的文件ID集合（可选，如果不提供则收集所有文件）
 * @param options.getItemId 获取文件ID的函数（可选，当需要基于选中状态过滤时必需）
 * @param options.includeFolderIds 是否包含文件夹ID（默认false）
 * @param options.filterFn 自定义过滤函数（可选）
 * @returns 收集到的文件ID数组
 */
export function collectFileIds(options: CollectFileIdsOptions): string[] {
	const { items, selectedItems, getItemId, includeFolderIds = false, filterFn } = options

	const selectedFileIds: string[] = []

	const collect = (fileItems: AttachmentItem[], parentSelected = false) => {
		fileItems.forEach((item) => {
			// 如果提供了选中状态过滤
			if (selectedItems && getItemId) {
				const itemId = getItemId(item)
				const isSelected = parentSelected || selectedItems.has(itemId)

				if (isSelected) {
					// 处理文件夹
					if (
						item.is_directory &&
						"children" in item &&
						(item.children?.length || 0) > 0
					) {
						// 如果包含文件夹ID，添加到结果中
						if (includeFolderIds && item.file_id) {
							selectedFileIds.push(item.file_id)
						}
						// 递归收集子文件
						collect(item.children || [], true)
					} else {
						// 处理文件
						if (item.file_id) {
							// 应用自定义过滤函数
							if (!filterFn || filterFn(item)) {
								selectedFileIds.push(item.file_id)
							}
						}
					}
				} else if (item.is_directory && "children" in item) {
					// 未选中的文件夹，继续递归查找子项
					collect(item.children || [], false)
				}
			} else {
				// 没有选中状态过滤，收集所有文件
				if (item.is_directory && "children" in item && (item.children?.length || 0) > 0) {
					// 如果包含文件夹ID，添加到结果中
					if (includeFolderIds && item.file_id) {
						selectedFileIds.push(item.file_id)
					}
					// 递归收集子文件
					collect(item.children || [])
				} else {
					// 处理文件
					if (item.file_id) {
						// 应用自定义过滤函数
						if (!filterFn || filterFn(item)) {
							selectedFileIds.push(item.file_id)
						}
					}
				}
			}
		})
	}

	collect(items)
	return selectedFileIds
}
