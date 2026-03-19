import { userStore } from "@/models/user"
import { User } from "@/types/user"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

interface OrganizationRenderProps {
	organizationCode?: string
	renderKey?: keyof User.MagicOrganization
}

/**
 * 组织渲染
 * @param organizationCode 组织编码
 * @param renderKey 渲染的key
 * @returns
 */
const OrganizationRender = observer(
	({ organizationCode, renderKey = "organization_name" }: OrganizationRenderProps) => {
		const { t } = useTranslation("interface")

		const organization = organizationCode
			? userStore.user.magicOrganizationMap[organizationCode]
			: null

		const isPersonalOrganization = userStore.user.isPersonalOrganization

		if (!organization) return null

		if (isPersonalOrganization) {
			return t("personalVersion")
		}

		if (renderKey === "organization_name" && !organization[renderKey]) {
			const thirdPartyOrganizationCode = organization.third_platform_organization_code

			const organizationName = userStore.user.organizations.find(
				(org) => org.organization_code === thirdPartyOrganizationCode,
			)?.organization_name

			if (organizationName) {
				return organizationName
			}
		}

		return organization[renderKey]
	},
)

export default OrganizationRender
