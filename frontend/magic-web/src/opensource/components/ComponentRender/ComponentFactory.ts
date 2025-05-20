import defaultComponents, {
	DefaultComponents,
	DefaultComponentsProps,
} from "./config/defaultComponents"

/**
 * 组件工厂
 */
class ComponentFactory {
	private components: Map<string, React.ComponentType<any>> = new Map()

	constructor() {
		this.registerComponents(defaultComponents)
	}

	/**
	 * 注册组件
	 * @param name 组件名称
	 * @param component 组件
	 */
	registerComponent<N extends keyof DefaultComponentsProps>(
		name: N,
		component: React.ComponentType<DefaultComponentsProps[N]>,
	) {
		this.components.set(name, component)
	}

	/**
	 * 获取未注册组件的默认组件
	 * @param name 组件名称
	 * @returns 默认组件
	 */
	getFallbackComponent(): React.ComponentType<
		DefaultComponentsProps[keyof DefaultComponentsProps]
	> {
		return this.getComponent(DefaultComponents.Fallback)
	}

	/**
	 * 获取已注册组件
	 * @param name 组件名称
	 * @returns 组件
	 */
	getComponent<N extends keyof DefaultComponentsProps>(
		name: N,
	): React.ComponentType<DefaultComponentsProps[N]> {
		const component = this.components.get(name)
		if (!component) {
			return this.getFallbackComponent()
		}
		return component as React.ComponentType<DefaultComponentsProps[N]>
	}

	/**
	 * 注册组件
	 * @param components 组件列表
	 */
	registerComponents<N extends keyof DefaultComponentsProps>(
		components: Record<N, React.ComponentType<DefaultComponentsProps[N]>>,
	) {
		for (const [name, component] of Object.entries(components)) {
			this.registerComponent(
				name as N,
				component as React.ComponentType<DefaultComponentsProps[N]>,
			)
		}
	}

	/**
	 * 注销组件
	 * @param name 组件名称
	 */
	unregisterComponent(name: string) {
		this.components.delete(name)
	}

	/**
	 * 注销组件列表
	 * @param names 组件名称列表
	 */
	unregisterComponents(names: string[]) {
		names.forEach((name) => this.unregisterComponent(name))
	}
}

export default new ComponentFactory()
