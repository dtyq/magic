import { makeAutoObservable, observable } from "mobx"
import { MentionItemType, type MentionItem, type MentionSceneCatalog } from "../../../../types"
import { MentionPanelBuiltinItemId } from "../../catalog-ids"
import { MentionPanelItemType } from "../../panel-item-types"
import { includesSearchQuery } from "../../store-helpers/matching"

/** Marks items that came from a scene catalog so renderers can show the scene's own subtitle. */
export const SCENE_CATALOG_ITEM_TAG = "scene-catalog"
const SCENE_CATALOG_NAME_KEY = "sceneCatalogName"

export function isSceneCatalogItem(item: Pick<MentionItem, "tags">): boolean {
	return Boolean(item.tags?.includes(SCENE_CATALOG_ITEM_TAG))
}

/** Name of the catalog an item came from, used as the search subtitle when it has none. */
export function getSceneCatalogName(item: Pick<MentionItem, "metadata">): string | undefined {
	const name = item.metadata?.[SCENE_CATALOG_NAME_KEY]
	return typeof name === "string" ? name : undefined
}

/**
 * Holds the entry a page pins at the top of its own @ panel, e.g. "This study" on the research
 * page. The page pushes the data into its store instance; other panels never see it.
 *
 * | Panel state | Shows                                                              |
 * | default     | one pinned root row (hidden when every group is empty)             |
 * | catalog     | a title row per non-empty group, then that group's items           |
 * | search      | matching items, ahead of builtin results with the same identity    |
 */
export class MentionPanelSceneCatalogStore {
	/** Kept by reference: items carry React icons, which must not become observables. */
	catalog: MentionSceneCatalog | null = null

	constructor() {
		makeAutoObservable(this, { catalog: observable.ref }, { autoBind: true })
	}

	setCatalog(catalog: MentionSceneCatalog | null) {
		if (!catalog) {
			this.catalog = null
			return
		}
		const groups = catalog.groups
			.filter((group) => group.items.length > 0)
			.map((group) => ({
				...group,
				items: group.items.map((item) => ({
					...item,
					tags: [...(item.tags ?? []), SCENE_CATALOG_ITEM_TAG],
					metadata: { ...item.metadata, [SCENE_CATALOG_NAME_KEY]: catalog.name },
				})),
			}))
		this.catalog = groups.length > 0 ? { ...catalog, groups } : null
	}

	getRootItem(): MentionItem | null {
		if (!this.catalog) return null
		return {
			id: MentionPanelBuiltinItemId.SCENE_CATALOG,
			type: MentionPanelItemType.SCENE_CATALOG,
			name: this.catalog.name,
			icon: this.catalog.icon,
			hasChildren: true,
			isFolder: false,
		}
	}

	getItems(): MentionItem[] {
		if (!this.catalog) return []
		// The panel breadcrumb already names the catalog, so a lone group would repeat it.
		if (this.catalog.groups.length === 1) return this.catalog.groups[0].items
		return this.catalog.groups.flatMap((group) => [
			{
				id: `${MentionPanelBuiltinItemId.SCENE_CATALOG}-title-${group.id}`,
				type: MentionItemType.TITLE,
				name: group.title,
				unSelectable: true,
			},
			...group.items,
		])
	}

	searchItems(query: string, matchesQuery: (target: string, query: string) => boolean) {
		if (!this.catalog) return []
		return this.catalog.groups
			.flatMap((group) => group.items)
			.filter(
				(item) =>
					matchesQuery(item.name, query) ||
					// Plain substring on subtitles: fuzzy matching long taglines would match almost anything.
					Boolean(item.description && includesSearchQuery(item.description, query)),
			)
	}
}
