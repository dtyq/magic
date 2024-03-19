import { InlineCodeRenderProps } from "../components/Code/types"
import { LazyExoticComponent, ComponentType, lazy } from "react"
import CodeComponents from "../components/Code/config/CodeComponents"
import BaseRenderFactory from "./BaseRenderFactory"

const Fallback = lazy(() => import("../components/Code/components/InlineCode"))

class InlineCodeRenderFactory extends BaseRenderFactory<InlineCodeRenderProps> {
	constructor() {
		super(CodeComponents)
	}

	/**
	 * 获取默认组件
	 * @returns 默认组件
	 */
	public getFallbackComponent(): LazyExoticComponent<ComponentType<InlineCodeRenderProps>> {
		return Fallback
	}
}

export default new InlineCodeRenderFactory()
