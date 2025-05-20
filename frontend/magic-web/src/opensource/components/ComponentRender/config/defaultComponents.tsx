import { ComponentProps, lazy, LazyExoticComponent } from "react"

export const enum DefaultComponents {
	OrganizationList = "OrganizationList",
	Fallback = "Fallback",
}

const OrganizationList = lazy(
	() =>
		import(
			"@/opensource/layouts/BaseLayout/components/Sider/components/OrganizationSwitch/OrganizationList"
		),
)

const Fallback: React.ComponentType<any> = () => <div>Component UnRegistered</div>

export interface DefaultComponentsProps {
	OrganizationList: ComponentProps<typeof OrganizationList>
	Fallback: ComponentProps<typeof Fallback>
}

const defaultComponents: Record<
	DefaultComponents,
	| LazyExoticComponent<React.ComponentType<DefaultComponentsProps[keyof DefaultComponentsProps]>>
	| React.ComponentType<DefaultComponentsProps[keyof DefaultComponentsProps]>
> = {
	[DefaultComponents.OrganizationList]: OrganizationList,
	[DefaultComponents.Fallback]: Fallback,
}

export default defaultComponents
