import type { AttachmentItem } from "../hooks/types"

/**
 * 收集直接选中的项目ID（包括文件夹），不递归展开子文件
 * 用于分享场景，只选中用户明确选中的项目
 * @param items 文件列表
 * @param selectedItems 选中的文件ID集合
 * @param getItemId 获取文件ID的函数
 * @returns 收集到的文件ID数组（只包含直接选中的项目）
 */
export function collectSelectedItemIds(
	items: AttachmentItem[],
	selectedItems: Set<string>,
	getItemId: (item: AttachmentItem) => string,
): string[] {
	const selectedFileIds: string[] = []

	const collect = (fileItems: AttachmentItem[]) => {
		fileItems.forEach((item) => {
			const itemId = getItemId(item)
			const isSelected = selectedItems.has(itemId)

			if (isSelected) {
				// 如果项目被选中，直接添加其ID（无论是文件还是文件夹）
				if (item.file_id) {
					selectedFileIds.push(item.file_id)
				}
			}

			// 继续递归查找子项，但不展开选中的文件夹
			if (item.is_directory && "children" in item && item.children) {
				collect(item.children)
			}
		})
	}

	collect(items)
	return selectedFileIds
}
