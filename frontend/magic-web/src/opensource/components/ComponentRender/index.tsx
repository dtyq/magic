import { memo, Suspense } from "react"
import ComponentFactory from "./ComponentFactory"
import { DefaultComponentsProps } from "./config/defaultComponents"

/**
 * 组件渲染
 * @param componentName 组件名称
 * @returns 组件
 */
type ComponentRenderProps<N extends keyof DefaultComponentsProps> = {
	componentName: N
} & DefaultComponentsProps[N]

/**
 * 组件工厂 - 组件渲染
 * @param componentName 组件名称
 * @returns 组件
 */
const ComponentRender = memo(
	<N extends keyof DefaultComponentsProps>({
		componentName,
		children,
		...props
	}: ComponentRenderProps<N>) => {
		const Component = ComponentFactory.getComponent(componentName)

		return (
			<Suspense fallback={null}>
				<Component {...props}>{children}</Component>
			</Suspense>
		)
	},
)

export default ComponentRender
