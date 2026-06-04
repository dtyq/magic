import { LanguageType, ThemeType } from "@admin-components"
import { OrganizationType } from "@admin/apis/config"
import { IconMoon, IconSun } from "@tabler/icons-react"

export const languageOptions = [
	{ label: "中文", value: LanguageType.zh_CN },
	{ label: "English", value: LanguageType.en_US },
]

export const organizationOptions = [
	{ label: "官方组织", value: OrganizationType.Official },
	{ label: "个人组织", value: OrganizationType.Personal },
	{ label: "企业组织1", value: OrganizationType.Enterprise },
	{ label: "企业组织2", value: OrganizationType.Enterprise2 },
	{ label: "企业组织3", value: OrganizationType.Enterprise3 },
	{ label: "企业组织4", value: OrganizationType.Enterprise4 },
]

export const themeOptions = [
	{ label: <IconSun size={20} />, value: ThemeType.LIGHT },
	{ label: <IconMoon size={20} />, value: ThemeType.DARK },
]
