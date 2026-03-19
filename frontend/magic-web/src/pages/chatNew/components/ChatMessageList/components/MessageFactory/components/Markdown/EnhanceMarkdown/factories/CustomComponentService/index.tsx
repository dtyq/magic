import { MarkdownToJSX } from "markdown-to-jsx"

class CustomComponentService {
	components: MarkdownToJSX.Overrides = {}

	/**
	 * 注册组件
	 * @param name
	 * @param componentConfig
	 */
	registerComponent(name: string, componentConfig: MarkdownToJSX.Override) {
		this.components[name] = componentConfig
	}

	/**
	 * 获取所有组件
	 * @returns
	 */
	getAllComponents() {
		return this.components
	}

	/**
	 * 注销组件
	 * @param name
	 */
	unregisterComponent(name: string) {
		delete this.components[name]
	}
}

export default new CustomComponentService()
