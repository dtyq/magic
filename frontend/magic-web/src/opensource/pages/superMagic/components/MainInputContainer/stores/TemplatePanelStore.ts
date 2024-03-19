import { makeAutoObservable, runInAction } from "mobx"
import {
	FieldPanelConfig,
	FieldItem,
	OptionItem,
	OptionGroup,
	OptionViewType,
	type LocaleText,
} from "../panels/types"
import {
	isOptionGroup,
	isComplexField,
	findComplexField,
	buildConcatenatedPresetContent,
	localeTextToDisplayString,
} from "../panels/utils"

function getInitialFilterValue(item: FieldItem): string {
	return localeTextToDisplayString(item.default_value)
}

/**
 * TemplatePanel 状态管理 Store
 */
class TemplatePanelStore {
	/** 面板配置 */
	config: FieldPanelConfig | null = null

	/** 当前过滤器状态 */
	field_items: FieldItem[] = []

	/** 当前选中的分组键 */
	currentGroupKey = ""

	/** 面板展开状态 */
	isExpanded = true

	/** 当前选中的模板 */
	selectedTemplate: OptionItem | null = null

	/**
	 * 所有模板(平铺)
	 */
	templates: OptionItem[] = []

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 初始化 Store
	 * @param config 面板配置
	 */
	initialize(config: FieldPanelConfig) {
		runInAction(() => {
			this.config = config
			this.field_items = config.field?.items || []

			// Keep empty selection when no default_value is configured.
			this.field_items.forEach((item) => {
				item.current_value = getInitialFilterValue(item)
			})

			// 查找复杂字段（可能包含 OptionGroup[] 或 OptionItem[]）
			const complexField = findComplexField(this.field_items)

			if (complexField && complexField.options.length > 0) {
				const firstOption = complexField.options[0]

				// 判断是分组数据还是扁平列表
				if (isOptionGroup(firstOption)) {
					// 提取模板组
					const groups = complexField.options as OptionGroup[]

					// 扁平化所有模板
					this.templates = groups.flatMap((g) => g.children || [])

					// 设置默认选中模板
					// 1. 优先匹配 default_value（如果有）
					// 2. 否则尝试用 current_value 匹配模板 value
					// 3. 都没有则为 null
					const targetStr =
						localeTextToDisplayString(complexField.default_value) ||
						complexField.current_value
					let selectedTemplate: OptionItem | null = null
					if (targetStr) {
						selectedTemplate =
							this.templates.find(
								(t) => localeTextToDisplayString(t.value) === targetStr,
							) || null
					}
					this.selectedTemplate = selectedTemplate

					// 设置默认分组键
					// 1. 优先使用 default_group_key
					// 2. 如果有选中的模板，找到该模板所在的组
					// 3. 否则使用第一个组的 key
					if (complexField.default_group_key) {
						this.currentGroupKey = complexField.default_group_key
					} else if (selectedTemplate) {
						// 找到选中模板所在的组
						const templateGroup = groups.find((g) =>
							g.children?.some((item) => item.value === selectedTemplate.value),
						)
						this.currentGroupKey =
							templateGroup?.group_key || groups[0]?.group_key || ""
					} else {
						// 没有默认值，自动设置为第一个组
						this.currentGroupKey = groups[0]?.group_key || ""
					}
				} else {
					// 扁平列表，直接使用 options 作为模板列表
					this.templates = complexField.options as OptionItem[]

					// 设置默认选中模板
					const targetStr =
						localeTextToDisplayString(complexField.default_value) ||
						complexField.current_value
					if (targetStr) {
						this.selectedTemplate =
							this.templates.find(
								(t) => localeTextToDisplayString(t.value) === targetStr,
							) || null
					} else {
						this.selectedTemplate = null
					}

					// 扁平列表无分组概念
					this.currentGroupKey = ""
				}
			} else {
				// 无复杂字段
				this.templates = []
				this.currentGroupKey = ""
				this.selectedTemplate = null
			}
		})
	}

	/**
	 * 更新过滤器值
	 * @param filterId 过滤器 ID
	 * @param value 新的过滤器值 (string or LocaleText from option)
	 */
	setFilterValue(filterId: string, value: string | LocaleText) {
		const filter = this.field_items.find((f) => f.data_key === filterId)
		if (filter) {
			filter.current_value = localeTextToDisplayString(value)
		}
	}

	/**
	 * 重置所有过滤器为默认值
	 */
	resetFilters() {
		this.field_items.forEach((filter) => {
			filter.current_value = getInitialFilterValue(filter)
		})
	}

	/**
	 * 设置当前分组键
	 * @param groupKey 要选择的分组键
	 */
	setCurrentGroupKey(groupKey: string) {
		this.currentGroupKey = groupKey
	}

	/**
	 * 切换面板展开状态
	 */
	toggleExpanded() {
		this.isExpanded = !this.isExpanded
	}

	/**
	 * 设置面板展开状态
	 * @param expanded 展开状态
	 */
	setExpanded(expanded: boolean) {
		this.isExpanded = expanded
	}

	/**
	 * 设置选中的模板
	 * @param template 要选择的模板
	 */
	setSelectedTemplate(template: OptionItem | null) {
		this.selectedTemplate = template
	}

	/**
	 * Get the complex field (template field)
	 */
	get complexField(): FieldItem | undefined {
		return findComplexField(this.field_items)
	}

	/**
	 * Get template groups from complex field
	 */
	get templateGroups(): OptionGroup[] {
		const field = this.complexField
		if (!field || field.options.length === 0) return []

		// 只返回分组类型的 options
		return field.options.filter(isOptionGroup) as OptionGroup[]
	}

	/**
	 * Get view type from config
	 */
	get viewType(): OptionViewType | undefined {
		return this.config?.field?.view_type
	}

	/**
	 * Get simple fields (for FilterBar)
	 */
	get simpleFields(): FieldItem[] {
		return this.field_items.filter((f) => !isComplexField(f))
	}

	/**
	 * Check if panel should be rendered (has complex field)
	 */
	get shouldRenderPanel(): boolean {
		return this.viewType === OptionViewType.GRID
	}

	/**
	 * 根据当前过滤器和选中分组获取过滤后的模板列表
	 */
	get filteredTemplates(): OptionItem[] {
		const groups = this.templateGroups
		// 如果没有分组（扁平列表），返回所有模板
		if (groups.length === 0) return this.templates

		const currentGroup = groups.find((g) => g.group_key === this.currentGroupKey)
		return currentGroup?.children || []
	}

	/**
	 * 获取当前模板分组
	 */
	get currentGroup(): OptionGroup | undefined {
		return this.templateGroups.find((g) => g.group_key === this.currentGroupKey)
	}

	/**
	 * 检查是否有多个模板分组
	 */
	get hasMultipleGroups(): boolean {
		return this.templateGroups.length > 1
	}

	/**
	 * Computed: concatenated preset content with {preset_value} replaced.
	 * Built from field_items that have preset_content; uses current_value per field.
	 */
	get concatenatedPresetContent(): string {
		return buildConcatenatedPresetContent(this.field_items)
	}

	/**
	 * 重置 Store 到初始状态
	 */
	reset() {
		runInAction(() => {
			this.config = null
			this.field_items = []
			this.currentGroupKey = ""
			this.isExpanded = true
			this.selectedTemplate = null
		})
	}
}

export { TemplatePanelStore }
