import { makeAutoObservable, runInAction } from "mobx"
import { DemoPanelConfig, OptionItem, OptionGroup } from "../panels"

/**
 * TemplatePanel 状态管理 Store
 */
class DemoPanelStore {
	/** 面板配置 */
	config: DemoPanelConfig | null = null

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
	initialize(config: DemoPanelConfig) {
		runInAction(() => {
			this.config = config

			// 设置默认分组键
			this.currentGroupKey =
				config.demo.default_selected_group_key || config.demo.groups?.[0]?.group_key || ""

			this.templates = config.demo.groups?.flatMap((g) => g.children || []) || []

			// 设置默认选中的模板
			if (config.demo.default_selected_template_key) {
				this.selectedTemplate =
					this.templates.find(
						(t) => t.value === config.demo.default_selected_template_key,
					) || null
			}
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
	 * 根据当前过滤器和选中分组获取过滤后的模板列表
	 */
	get filteredTemplates(): OptionItem[] {
		if (!this.config?.demo.groups) return []

		const currentGroup = this.config.demo.groups.find(
			(g) => g.group_key === this.currentGroupKey,
		)
		const result = currentGroup?.children || []

		return result
	}

	/**
	 * 获取当前模板分组
	 */
	get currentGroup(): OptionGroup | undefined {
		return this.config?.demo.groups?.find((g) => g.group_key === this.currentGroupKey)
	}

	/**
	 * 检查是否有多个模板分组
	 */
	get hasMultipleGroups(): boolean {
		return (this.config?.demo.groups?.length || 0) > 1
	}

	/**
	 * 重置 Store 到初始状态
	 */
	reset() {
		runInAction(() => {
			this.config = null
			this.currentGroupKey = ""
			this.isExpanded = true
			this.selectedTemplate = null
		})
	}
}

export { DemoPanelStore }
