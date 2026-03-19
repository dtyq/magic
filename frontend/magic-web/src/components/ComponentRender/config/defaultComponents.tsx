import { ComponentProps, lazy, LazyExoticComponent } from "react"

export const enum DefaultComponents {
	OrganizationList = "OrganizationList",
	Fallback = "Fallback",
	// BaseLayout = "BaseLayout",
	// OrganizationSwitch = "OrganizationSwitch",
	ContactsCurrentOrganization = "ContactsCurrentOrganization",
	OrganizationAvatarRender = "OrganizationAvatarRender",
	OrganizationItem = "OrganizationItem",
}

// const BaseLayout = lazy(() => import("@/layouts/BaseLayout"))

const OrganizationItem = lazy(() => import("@/components/business/OrganizationItem"))

const OrganizationList = lazy(
	() =>
		import("@/layouts/BaseLayout/components/Sider/components/OrganizationSwitch/OrganizationList"),
)
// const OrganizationSwitch = lazy(
// 	() => import("@/layouts/BaseLayout/components/Sider/components/OrganizationSwitch"),
// )

const ContactsCurrentOrganization = lazy(
	() => import("@/pages/contacts/components/ContactsCurrentOrganization"),
)

const OrganizationAvatarRender = lazy(
	() => import("@/components/business/OrganizationAvatarRender"),
)

const Fallback: React.ComponentType<any> = () => <div>Component UnRegistered</div>

export interface DefaultComponentsProps {
	OrganizationItem: ComponentProps<typeof OrganizationItem>
	OrganizationList: ComponentProps<typeof OrganizationList>
	Fallback: ComponentProps<typeof Fallback>
	// BaseLayout: ComponentProps<typeof BaseLayout>
	OrganizationAvatarRender: ComponentProps<typeof OrganizationAvatarRender>
	// OrganizationSwitch: ComponentProps<typeof OrganizationSwitch>
	ContactsCurrentOrganization: ComponentProps<typeof ContactsCurrentOrganization>
}

const defaultComponents: Record<
	DefaultComponents,
	| LazyExoticComponent<React.ComponentType<DefaultComponentsProps[keyof DefaultComponentsProps]>>
	| React.ComponentType<DefaultComponentsProps[keyof DefaultComponentsProps]>
> = {
	[DefaultComponents.OrganizationItem]: OrganizationItem,
	[DefaultComponents.OrganizationList]: OrganizationList,
	[DefaultComponents.Fallback]: Fallback,
	[DefaultComponents.ContactsCurrentOrganization]: ContactsCurrentOrganization,
	[DefaultComponents.OrganizationAvatarRender]: OrganizationAvatarRender,
}

export type DefaultComponentProps<N extends keyof DefaultComponentsMap> =
	N extends keyof DefaultComponentsMap ? ComponentProps<(typeof defaultComponents)[N]> : unknown

export type DefaultComponentsMap = Partial<typeof defaultComponents>

export default defaultComponents
