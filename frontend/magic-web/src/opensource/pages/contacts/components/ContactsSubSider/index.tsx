import { IconChevronRight, IconUsers } from "@tabler/icons-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MagicList } from "@/opensource/components/MagicList"
import { useLocation } from "react-router"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import SubSiderContainer from "@/opensource/layouts/BaseLayout/components/SubSider"
import { Flex } from "antd"
import { IconMagicBots } from "@/opensource/enhance/tabler/icons-react"
import type { MagicListItemData } from "@/opensource/components/MagicList/types"
import { useMemoizedFn } from "ahooks"
import { useStyles } from "./styles"
import { useContactPageDataContext } from "../ContactDataProvider/hooks"
import { useTheme } from "antd-style"
import ComponentRender from "@/opensource/components/ComponentRender"
import { DefaultComponents } from "@/opensource/components/ComponentRender/config/defaultComponents"
import { RouteName } from "@/opensource/routes/constants"

function ContactsSubSider() {
	const { t } = useTranslation("interface")
	const { pathname } = useLocation()
	const { styles } = useStyles()
	const navigate = useNavigate()
	const { magicColorScales } = useTheme()

	const [collapseKey, setCollapseKey] = useState<string>(pathname)

	const { setCurrentDepartmentPath } = useContactPageDataContext()
	const handleOrganizationItemClick = useMemoizedFn(({ id, pathNodes }: MagicListItemData) => {
		setCollapseKey(id)
		setCurrentDepartmentPath(pathNodes)
		navigate({ name: RouteName.ContactsOrganization })
	})

	const handleItemClick = useMemoizedFn(({ route }: MagicListItemData) => {
		navigate({ name: route })
	})

	return (
		<SubSiderContainer className={styles.container}>
			<Flex vertical gap={12} align="left" className={styles.innerContainer}>
				<Flex vertical gap={10} className="px-2">
					<div className={styles.title}>{t("contacts.subSider.enterpriseInternal")}</div>
					<ComponentRender
						componentName={DefaultComponents.ContactsCurrentOrganization}
						onItemClick={handleOrganizationItemClick}
					/>
				</Flex>
				<div className={styles.divider} />
				<MagicList
					active={collapseKey}
					onItemClick={handleItemClick}
					items={[
						{
							id: "aiAssistant",
							route: RouteName.ContactsAiAssistant,
							title: t("contacts.subSider.aiAssistant"),
							avatar: {
								src: <MagicIcon color="currentColor" component={IconMagicBots} />,
								style: {
									background: magicColorScales.brand[5],
									padding: 8,
									color: "white",
								},
							},
							extra: (
								<MagicIcon
									color="currentColor"
									size={18}
									component={IconChevronRight}
								/>
							),
						},
						// {
						// 	id: "myFriends",
						// 	route: RouteName.ContactsMyFriends,
						// 	title: t("contacts.subSider.followee"),
						// 	avatar: {
						// 		icon: <MagicIcon color="currentColor" component={IconUserStar} />,
						// 		style: {
						// 			background: colorScales.pink[5],
						// 			padding: 8,
						// 			color: "white",
						// 		},
						// 	},
						// 	extra: (
						// 		<MagicIcon
						// 			color="currentColor"
						// 			size={18}
						// 			component={IconChevronRight}
						// 		/>
						// 	),
						// },
						{
							id: "myGroups",
							route: RouteName.ContactsMyGroups,
							title: t("contacts.subSider.myGroups"),
							avatar: {
								src: <MagicIcon color="currentColor" component={IconUsers} />,
								style: {
									background: magicColorScales.lightGreen[5],
									padding: 8,
									color: "white",
								},
							},
							extra: (
								<MagicIcon
									color="currentColor"
									size={18}
									component={IconChevronRight}
								/>
							),
						},
					]}
				/>
			</Flex>
		</SubSiderContainer>
	)
}

export default ContactsSubSider
