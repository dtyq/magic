import { SharedResourceType } from "../types"

/**
 * 根据当前 tab 获取搜索框的 placeholder
 * @param activeTab 当前激活的 tab
 * @param t 翻译函数
 * @returns placeholder 文本
 */
export function getSearchPlaceholder(
	activeTab: SharedResourceType,
	t: (key: string) => string,
): string {
	switch (activeTab) {
		case SharedResourceType.Project:
			return t("shareManagement.searchProjectName")
		case SharedResourceType.File:
			return t("shareManagement.searchFileOrProject")
		case SharedResourceType.Topic:
			return t("shareManagement.searchTopic")
		default:
			return ""
	}
}
