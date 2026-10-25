import type { EditionMenuCatalog } from "@magic-admin-v2/routes/menu-catalog"

/** 开源构建没有企业菜单目录。企业 Overlay 会替换本文件。 */
export const editionMenuCatalog: EditionMenuCatalog = {
	sectionCatalog: {},
	groupCatalog: {},
	routeIcons: {},
	sectionOrder: [],
	groupOrderBeforeAgents: [],
	groupOrderAfterModels: [],
	routeOrderAfterAppMenu: [],
	routeOrderAfterProviders: [],
}
