import { RenderComponent } from "../components/Code/types"
import { LazyExoticComponent, ComponentType, lazy } from "react"

class BaseRenderFactory<Props> {
	/**
	 * 代码组件
	 */
	protected components = new Map<string, RenderComponent<Props>>()

	/**
	 * 组件缓存
	 */
	protected componentCache = new Map<string, LazyExoticComponent<ComponentType<Props>>>()

	constructor(initialComponents?: Record<string, RenderComponent<Props>>) {
		this.components = new Map<string, RenderComponent<Props>>(
			initialComponents ? Object.entries(initialComponents) : [],
		)
	}

	/**
	 * 获取默认组件
	 * @returns 默认组件
	 */
	public getFallbackComponent(): LazyExoticComponent<ComponentType<Props>> {
		return lazy(() => Promise.resolve({ default: () => null }))
	}

	/**
	 * 注册组件
	 * @param lang 语言
	 * @param componentConfig 组件配置
	 */
	registerComponent(lang: string, componentConfig: RenderComponent<Props>) {
		this.components.set(lang, componentConfig)
	}

	/**
	 * 获取组件
	 * @param type 组件类型
	 * @returns 组件
	 */
	getComponent(type: string): LazyExoticComponent<ComponentType<Props>> {
		// 加载并返回组件
		const codeComponent = this.components.get(type)

		// 检查缓存
		if (codeComponent && this.componentCache.has(codeComponent.componentType)) {
			return this.componentCache.get(codeComponent.componentType)!
		}

		// 没有加载器
		if (!codeComponent?.loader) {
			return this.getFallbackComponent()
		}

		// 创建 lazy 组件
		const LazyComponent = lazy(() =>
			codeComponent.loader().then((module) => ({
				default: module.default as ComponentType<Props>,
			})),
		)
		this.componentCache.set(codeComponent.componentType, LazyComponent)
		return LazyComponent
	}

	/**
	 * 清除缓存
	 * @param usedTypes 使用过的类型
	 */
	cleanCache(usedTypes: string[]) {
		Array.from(this.componentCache.keys()).forEach((type) => {
			if (!usedTypes.includes(type)) {
				this.componentCache.delete(type)
			}
		})
	}
}

export default BaseRenderFactory
