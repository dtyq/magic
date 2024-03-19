import { createContext, useContext } from "react"
import { makeAutoObservable } from "mobx"
import type { SceneItem } from "../../types"
import { localeTextToDisplayString } from "@/opensource/pages/superMagic/components/MainInputContainer/panels/utils"
import {
	SkillPanelType,
	type DemoPanelConfig,
	type FieldItem,
	type FieldPanelConfig,
	type GuideItem,
	type GuidePanelConfig,
	type LocaleText,
	type OptionGroup,
	type OptionItem,
	type OptionViewType,
} from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"

function genKey() {
	return Math.random().toString(36).slice(2)
}

export const DEFAULT_INSPIRATION_GROUP_KEY = "__default__"

function getBaseInspirationConfig(inspiration: DemoPanelConfig | undefined): DemoPanelConfig {
	return (
		inspiration ??
		({
			type: "demo" as DemoPanelConfig["type"],
			demo: { groups: [] },
		} satisfies DemoPanelConfig)
	)
}

function createDefaultInspirationGroup(
	groupName: LocaleText,
	children: OptionItem[] = [],
): OptionGroup {
	return {
		group_key: DEFAULT_INSPIRATION_GROUP_KEY,
		group_name: groupName,
		children,
	}
}

function getFallbackGroupKey(inspiration: DemoPanelConfig | undefined): string {
	return (
		inspiration?.demo?.default_selected_group_key ??
		inspiration?.demo?.groups?.[0]?.group_key ??
		""
	)
}

function patchGroups(
	inspiration: DemoPanelConfig | undefined,
	mapFn: (groups: OptionGroup[]) => OptionGroup[],
): DemoPanelConfig {
	const base = getBaseInspirationConfig(inspiration)
	return {
		...base,
		demo: {
			...base.demo,
			groups: mapFn(base.demo?.groups ?? []),
		},
	}
}

export class SceneEditStore {
	scene: SceneItem

	private _onSave: ((scene: SceneItem) => Promise<void>) | null = null

	constructor(initialScene: SceneItem, onSave?: (scene: SceneItem) => Promise<void>) {
		this.scene = initialScene
		this._onSave = onSave ?? null
		makeAutoObservable(
			this,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ _onSave: false } as any,
			{ autoBind: true },
		)
	}

	/** Explicitly persist the current scene state to the backend. */
	save(): Promise<void> {
		return this._onSave?.(this.scene) ?? Promise.resolve()
	}

	// ─── Derived ─────────────────────────────────────────────────────────────

	get inspiration(): DemoPanelConfig | undefined {
		return this.scene.configs?.inspiration
	}

	get presets(): FieldPanelConfig | undefined {
		return this.scene.configs?.presets
	}

	get quickStart(): GuidePanelConfig | undefined {
		return this.scene.configs?.quick_start
	}

	// ─── Basic info ───────────────────────────────────────────────────────────

	updateBasicInfo(
		data: Partial<Pick<SceneItem, "name" | "description" | "icon" | "theme_color" | "enabled">>,
	) {
		Object.assign(this.scene, data)
	}

	// ─── Inspiration config ───────────────────────────────────────────────────

	updateInspirationConfig(data: { title?: LocaleText; view_type?: string }) {
		const inspiration = this.scene.configs?.inspiration
		if (!inspiration) return
		// `title` lives at the DemoPanelConfig top level
		if (data.title !== undefined) inspiration.title = data.title
		// `view_type` lives inside `demo`, not at the top level
		if (data.view_type !== undefined) {
			this.scene.configs = {
				...this.scene.configs,
				inspiration: {
					...inspiration,
					demo: {
						...inspiration.demo,
						view_type: data.view_type as OptionViewType,
					},
				},
			}
		}
	}

	// ─── Inspiration groups ───────────────────────────────────────────────────

	createInspirationGroup(
		data: { group_name: LocaleText; group_icon?: string },
		defaultGroupName?: LocaleText,
	): string {
		const newGroup: OptionGroup = { group_key: genKey(), ...data, children: [] }
		const base = getBaseInspirationConfig(this.scene.configs?.inspiration)
		const groups = base.demo.groups ?? []
		const shouldCreateDefaultGroup = groups.length === 0 && !!defaultGroupName
		const nextGroups =
			shouldCreateDefaultGroup && defaultGroupName
				? [createDefaultInspirationGroup(defaultGroupName), newGroup]
				: [...groups, newGroup]

		this.scene.configs = {
			...this.scene.configs,
			inspiration: {
				...base,
				demo: {
					...base.demo,
					groups: nextGroups,
					default_selected_group_key:
						base.demo.default_selected_group_key ??
						(shouldCreateDefaultGroup ? DEFAULT_INSPIRATION_GROUP_KEY : undefined),
				},
			},
		}
		return newGroup.group_key
	}

	editInspirationGroup(groupKey: string, data: { group_name: LocaleText; group_icon?: string }) {
		this.scene.configs = {
			...this.scene.configs,
			inspiration: patchGroups(this.scene.configs?.inspiration, (gs) =>
				gs.map((g) => (g.group_key === groupKey ? { ...g, ...data } : g)),
			),
		}
	}

	deleteInspirationGroup(groupKey: string) {
		const base = getBaseInspirationConfig(this.scene.configs?.inspiration)
		const groups = (base.demo.groups ?? []).filter((group) => group.group_key !== groupKey)
		const defaultSelectedGroupKey =
			base.demo.default_selected_group_key === groupKey
				? groups[0]?.group_key
				: base.demo.default_selected_group_key

		this.scene.configs = {
			...this.scene.configs,
			inspiration: {
				...base,
				demo: {
					...base.demo,
					groups,
					default_selected_group_key: defaultSelectedGroupKey,
				},
			},
		}
	}

	// ─── Inspiration items ────────────────────────────────────────────────────

	createInspirationItem(
		data: Partial<OptionItem>,
		groupKey: string,
		defaultGroupName?: LocaleText,
	) {
		const newItem: OptionItem = { ...data, value: data.value ?? genKey() }
		const base = getBaseInspirationConfig(this.scene.configs?.inspiration)
		const groups = base.demo.groups ?? []
		const fallbackGroupKey = groupKey || getFallbackGroupKey(base)
		const hasTargetGroup = groups.some((group) => group.group_key === fallbackGroupKey)

		if (!hasTargetGroup && groups.length === 0 && defaultGroupName) {
			this.scene.configs = {
				...this.scene.configs,
				inspiration: {
					...base,
					demo: {
						...base.demo,
						groups: [createDefaultInspirationGroup(defaultGroupName, [newItem])],
						default_selected_group_key:
							base.demo.default_selected_group_key ?? DEFAULT_INSPIRATION_GROUP_KEY,
					},
				},
			}
			return
		}

		this.scene.configs = {
			...this.scene.configs,
			inspiration: patchGroups(base, (gs) =>
				gs.map((g) =>
					g.group_key === fallbackGroupKey
						? { ...g, children: [...(g.children ?? []), newItem] }
						: g,
				),
			),
		}
	}

	editInspirationItem(value: string, data: Partial<OptionItem>, groupKey: string) {
		this.scene.configs = {
			...this.scene.configs,
			inspiration: patchGroups(this.scene.configs?.inspiration, (gs) => {
				// Find which group currently holds the item
				const sourceGroup = gs.find((g) =>
					(g.children ?? []).some((item) => item.value === value),
				)
				const sourceGroupKey = sourceGroup?.group_key

				// Same group (or source not found): update in place
				if (!sourceGroupKey || sourceGroupKey === groupKey) {
					return gs.map((g) =>
						g.group_key === groupKey
							? {
									...g,
									children: (g.children ?? []).map((item) =>
										item.value === value ? { ...item, ...data } : item,
									),
								}
							: g,
					)
				}

				// Group changed: move item from source to target
				const originalItem = (sourceGroup.children ?? []).find(
					(item) => item.value === value,
				)
				const updatedItem: OptionItem = { value, ...originalItem, ...data }

				return gs.map((g) => {
					if (g.group_key === sourceGroupKey)
						return {
							...g,
							children: (g.children ?? []).filter((item) => item.value !== value),
						}
					if (g.group_key === groupKey)
						return { ...g, children: [...(g.children ?? []), updatedItem] }
					return g
				})
			}),
		}
	}

	deleteInspirationItem(value: string) {
		this.scene.configs = {
			...this.scene.configs,
			inspiration: patchGroups(this.scene.configs?.inspiration, (gs) =>
				gs.map((g) => ({
					...g,
					children: (g.children ?? []).filter((item) => item.value !== value),
				})),
			),
		}
	}

	deleteInspirationItems(values: string[]) {
		const valueSet = new Set(values)
		this.scene.configs = {
			...this.scene.configs,
			inspiration: patchGroups(this.scene.configs?.inspiration, (gs) =>
				gs.map((g) => ({
					...g,
					children: (g.children ?? []).filter(
						(item) => !valueSet.has(localeTextToDisplayString(item.value)),
					),
				})),
			),
		}
	}

	// ─── Presets ──────────────────────────────────────────────────────────────

	updatePresets(config: FieldPanelConfig) {
		this.scene.configs = { ...this.scene.configs, presets: config }
	}

	private patchPresetItems(mapFn: (items: FieldItem[]) => FieldItem[]) {
		const base: FieldPanelConfig = this.scene.configs?.presets ?? {
			type: SkillPanelType.FIELD,
			field: { items: [] },
		}
		this.scene.configs = {
			...this.scene.configs,
			presets: {
				...base,
				field: {
					...base.field,
					items: mapFn(base.field?.items ?? []),
				},
			},
		}
	}

	createPresetItem(data: Partial<FieldItem>) {
		const newItem: FieldItem = {
			data_key: genKey(),
			label: { default: "", zh_CN: "", en_US: "" },
			options: [],
			enabled: true,
			updated_at: new Date().toISOString(),
			...data,
		}
		this.patchPresetItems((items) => [...items, newItem])
	}

	editPresetItem(dataKey: string, data: Partial<FieldItem>) {
		this.patchPresetItems((items) =>
			items.map((item) =>
				item.data_key === dataKey
					? { ...item, ...data, updated_at: new Date().toISOString() }
					: item,
			),
		)
	}

	deletePresetItem(dataKey: string) {
		this.patchPresetItems((items) => items.filter((item) => item.data_key !== dataKey))
	}

	deletePresetItems(dataKeys: string[]) {
		const keySet = new Set(dataKeys)
		this.patchPresetItems((items) => items.filter((item) => !keySet.has(item.data_key)))
	}

	reorderPresetItems(orderedKeys: string[]) {
		this.patchPresetItems((items) => {
			const itemMap = new Map(items.map((item) => [item.data_key, item]))
			const reordered = orderedKeys
				.map((k) => itemMap.get(k))
				.filter((item): item is FieldItem => item !== undefined)
			const keySet = new Set(orderedKeys)
			const remaining = items.filter((item) => !keySet.has(item.data_key))
			return [...reordered, ...remaining]
		})
	}

	updatePresetsConfig(data: { view_type?: OptionViewType }) {
		const base: FieldPanelConfig = this.scene.configs?.presets ?? {
			type: SkillPanelType.FIELD,
			field: { items: [] },
		}
		let items = base.field?.items ?? []

		// Ensure gallery item with option_view_type "grid" is at position 0
		const hasGallery =
			items.length > 0 && items.find((item) => item.option_view_type === "grid")

		if (data.view_type === "grid") {
			if (!hasGallery) {
				const galleryItem: FieldItem = {
					data_key: `gallery_${genKey()}`,
					label: { default: "", zh_CN: "", en_US: "" },
					options: [],
					option_view_type: "grid" as OptionViewType,
					enabled: true,
					updated_at: new Date().toISOString(),
				}
				// Remove any stale gallery item from other positions
				items = items.filter((item) => item.option_view_type !== "grid")
				items = [galleryItem, ...items]
			}
		} else {
			// 需要清理历史遗留的 gallery item
			if (hasGallery) {
				const galleryItem = items.find((item) => item.option_view_type === "grid")
				delete galleryItem?.option_view_type
			}
		}

		this.scene.configs = {
			...this.scene.configs,
			presets: {
				...base,
				field: {
					...base.field,
					items,
					...data,
				},
			},
		}
	}

	get galleryPresetItem(): FieldItem | undefined {
		const items = this.scene.configs?.presets?.field?.items ?? []
		return items.find((item) => item.option_view_type === "grid")
	}

	updateGalleryPresetItem(data: {
		label?: LocaleText
		options?: OptionItem[]
		default_value?: string
		preset_content?: LocaleText
	}) {
		this.patchPresetItems((items) =>
			items.map((item) =>
				item.option_view_type === "grid"
					? { ...item, ...data, updated_at: new Date().toISOString() }
					: item,
			),
		)
	}

	// ─── QuickStart helpers ───────────────────────────────────────────────────

	private patchQuickStartItems(mapFn: (items: GuideItem[]) => GuideItem[]) {
		const base: GuidePanelConfig = this.scene.configs?.quick_start ?? {
			type: SkillPanelType.GUIDE,
			guide: { items: [] },
		}
		this.scene.configs = {
			...this.scene.configs,
			quick_start: {
				...base,
				guide: { ...base.guide, items: mapFn(base.guide?.items ?? []) },
			},
		}
	}

	// ─── QuickStart CRUD + reorder ────────────────────────────────────────────

	createQuickStartItem(data: Partial<GuideItem>) {
		const newItem: GuideItem = {
			key: genKey(),
			title: { default: "", zh_CN: "", en_US: "" },
			description: { default: "", zh_CN: "", en_US: "" },
			icon: "",
			enabled: true,
			...data,
		}
		this.patchQuickStartItems((items) => [...items, newItem])
	}

	editQuickStartItem(key: string, data: Partial<GuideItem>) {
		this.patchQuickStartItems((items) =>
			items.map((item) => (item.key === key ? { ...item, ...data } : item)),
		)
	}

	deleteQuickStartItem(key: string) {
		this.patchQuickStartItems((items) => items.filter((item) => item.key !== key))
	}

	deleteQuickStartItems(keys: string[]) {
		const keySet = new Set(keys)
		this.patchQuickStartItems((items) => items.filter((item) => !keySet.has(item.key)))
	}

	reorderQuickStartItems(orderedKeys: string[]) {
		this.patchQuickStartItems((items) => {
			const itemMap = new Map(items.map((item) => [item.key, item]))
			const reordered = orderedKeys
				.map((k) => itemMap.get(k))
				.filter((item): item is GuideItem => item !== undefined)
			// Keep any items not in orderedKeys at the end (safety guard)
			const keySet = new Set(orderedKeys)
			const remaining = items.filter((item) => !keySet.has(item.key))
			return [...reordered, ...remaining]
		})
	}

	updateQuickStart(config: GuidePanelConfig) {
		this.scene.configs = { ...this.scene.configs, quick_start: config }
	}

	updateQuickStartConfig(data: { title?: LocaleText }) {
		const base: GuidePanelConfig = this.scene.configs?.quick_start ?? {
			type: SkillPanelType.GUIDE,
			guide: { items: [] },
		}
		this.scene.configs = {
			...this.scene.configs,
			quick_start: {
				...base,
				...data,
			},
		}
	}
}

export const SceneEditStoreContext = createContext<SceneEditStore | null>(null)

export function useSceneEditStore(): SceneEditStore {
	const store = useContext(SceneEditStoreContext)
	if (!store) throw new Error("useSceneEditStore must be used within SceneEditPanel")
	return store
}
