import { useSize } from "ahooks"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import {
	IconBook2,
	IconBox,
	IconCalendarEvent,
	IconChecklist,
	IconFolderOpen,
	IconFolderStar,
	IconMessage,
	IconRubberStamp,
	IconUserSquareRounded,
} from "@tabler/icons-react"
import { isCommercial } from "@/utils/env"
import MagicLogo from "@/components/MagicLogo"
import { LogoType } from "@/components/MagicLogo/LogoType"
import type { MenuItemType } from "antd/es/menu/interface"
import { useSideMenuStyle } from "./styles"
import IconSuperMagic from "@/enhance/tabler/icons-react/icons/IconSuperMagic"
import { RouteName } from "@/routes/constants"

interface MagicMenuItemType extends MenuItemType {
	hidden: boolean
}

export const useSideMenu = function (isPersonalOrganization: boolean) {
	const { t } = useTranslation("interface")
	const { styles } = useSideMenuStyle()

	return useMemo<Array<Array<MagicMenuItemType>>>(() => {
		const imMenu: Array<MagicMenuItemType> = [
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconMessage}
					/>
				),
				hidden: false,
				label: t("sider.message"),
				key: RouteName.Chat,
			},
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconUserSquareRounded}
					/>
				),
				hidden: isPersonalOrganization,
				label: t("sider.addressBook"),
				key: RouteName.Contacts,
			},
		]
		const aiMenu: Array<MagicMenuItemType> = [
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconSuperMagic}
					/>
				),
				hidden: false,
				label: t("sider.superMagic"),
				key: RouteName.Super,
			},
			{
				icon: (
					<MagicLogo
						className={styles.navIcon}
						type={LogoType.ICON}
						style={{ color: "rgba(0, 0, 0, 0.88)" }}
					/>
				),
				hidden: false,
				label: t("sider.aiAssistants"),
				key: RouteName.Explore,
			},
		]
		const extendMenu: Array<MagicMenuItemType> = [
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconBox}
					/>
				),
				hidden: !isCommercial() || isPersonalOrganization,
				label: t("sider.workspace"),
				key: RouteName.Workspace,
			},
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconCalendarEvent}
					/>
				),
				hidden: !isCommercial() || isPersonalOrganization,
				label: t("sider.calendar"),
				key: RouteName.Calendar,
			},
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconRubberStamp}
					/>
				),
				hidden: !isCommercial() || isPersonalOrganization,
				label: t("sider.approve"),
				key: RouteName.MagicApproval,
			},
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconChecklist}
					/>
				),
				hidden: !isCommercial() || isPersonalOrganization,
				label: t("sider.task"),
				key: RouteName.Tasks,
			},
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconFolderOpen}
					/>
				),
				hidden: !isCommercial(),
				label: t("sider.cloudDisk"),
				key: RouteName.DriveRecent,
			},
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconBook2}
					/>
				),
				hidden: !isCommercial(),
				label: t("sider.wiki"),
				key: RouteName.Knowledge,
			},
			{
				icon: (
					<MagicIcon
						color="currentColor"
						className={styles.navIcon}
						component={IconFolderStar}
					/>
				),
				hidden: !isCommercial(),
				label: t("sider.favorites"),
				key: RouteName.Favorites,
			},
		]
		return [imMenu, aiMenu, extendMenu].reduce<Array<Array<MagicMenuItemType>>>(
			(array, menuGroup) => {
				const menu = menuGroup.filter((i) => !i.hidden)
				if (menu.length > 0) {
					array.push(menu)
				}
				return array
			},
			[],
		)
	}, [isPersonalOrganization, styles.navIcon, t])
}

export function useAutoCollapsed(collapsed: boolean) {
	const size = useSize(document.body)

	return useMemo(() => (size?.width ? size?.width < 768 : collapsed), [collapsed, size?.width])
}
