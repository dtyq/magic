import { memo, Suspense } from "react"
import ComponentFactory from "./ComponentFactory"
import { DefaultComponentProps, DefaultComponents } from "./config/defaultComponents"

/**
 * 组件渲染
 * @param componentName 组件名称
 * @returns 组件
 */
type ComponentRenderProps<N extends DefaultComponents> = {
	componentName: N
	loadingFallback?: React.ReactNode
} & DefaultComponentProps<N>

/**
 * 组件工厂 - 组件渲染
 * @param componentName 组件名称
 * @returns 组件
 */
const ComponentRender = memo(
	<N extends DefaultComponents>({
		componentName,
		loadingFallback = null,
		children,
		...props
	}: ComponentRenderProps<N>) => {
		const Component = ComponentFactory.getComponent(componentName)

		return (
			<Suspense fallback={loadingFallback}>
				<Component {...props}>{children}</Component>
			</Suspense>
		)
	},
)

export default ComponentRender
