import { IconChevronRight, IconUsers } from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { MagicList } from "@/opensource/components/MagicList"
import { useLocation } from "react-router"
import { useNavigate } from "@/opensource/hooks/useNavigate"
import { RoutePath } from "@/const/routes"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import SubSiderContainer from "@/opensource/layouts/BaseLayout/components/SubSider"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { Flex } from "antd"
import AutoTooltipText from "@/opensource/components/other/AutoTooltipText"
import { IconMagicBots } from "@/enhance/tabler/icons-react"
import type { MagicListItemData } from "@/opensource/components/MagicList/types"
import { useMemoizedFn, useMount } from "ahooks"
import { useCurrentMagicOrganization } from "@/opensource/models/user/hooks"
import { contactStore } from "@/opensource/stores/contact"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useStyles } from "./styles"
import { Line } from "./Line"
import { useContactPageDataContext } from "../ContactDataProvider/hooks"
import { userStore } from "@/opensource/models/user"
import { useTheme } from "antd-style"
import { StructureUserItem } from "@/types/organization"
import userInfoService from "@/opensource/services/userInfo"
import { observer } from "mobx-react-lite"

interface CurrentOrganizationProps {
	onItemClick: (data: MagicListItemData) => void
}

const CurrentOrganization = observer(({ onItemClick }: CurrentOrganizationProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const organization = useCurrentMagicOrganization()

	const [userInfo, setUserInfo] = useState<StructureUserItem | null>(null)
	const [departmentInfos, setDepartmentInfos] = useState<any[]>([])

	const [isLoadingDepartmentInfos, setIsLoadingDepartmentInfos] = useState(false)

	useMount(() => {
		if (!userStore.user.userInfo?.user_id) return
		userInfoService.fetchUserInfos([userStore.user.userInfo?.user_id], 2).then((res) => {
			const userInfo = res[0]
			setUserInfo(userInfo)
			contactStore
				.getDepartmentInfos(userInfo.path_nodes.map((node) => node.department_id))
				.then((result) => {
					setDepartmentInfos(result)
					setIsLoadingDepartmentInfos(false)
				})
		})
	})

	const pathNodesState = useMemo(() => {
		return (
			userInfo?.path_nodes
				// 过滤掉根部门
				.filter((item) => item.department_id !== "-1")
				?.map((node) => ({
					id: node.department_id,
					name: node.department_name,
					departmentPath: node.path,
					departmentPathName: node.path
						.split("/")
						.slice(1)
						.map((p) => departmentInfos?.find((d) => d?.department_id === p)?.name)
						.filter(Boolean)
						.join("-"),
				}))
		)
	}, [userInfo?.path_nodes, departmentInfos])

	if (!organization) return null

	return (
		<Flex vertical gap={4}>
			<Flex gap={8}>
				<MagicAvatar
					size={42}
					src={organization.organization_logo}
					className={styles.avatar}
				>
					{organization.organization_name}
				</MagicAvatar>
				<Flex vertical justify="center">
					<AutoTooltipText className={styles.organizationName}>
						{organization.organization_name}
					</AutoTooltipText>
				</Flex>
			</Flex>
			<MagicList
				onItemClick={onItemClick}
				className={styles.collapse}
				items={[
					{
						id: "root",
						route: RoutePath.ContactsOrganization,
						pathNodes: [],
						title: (
							<Flex gap={8} align="center" style={{ marginLeft: 40 }}>
								{Line}
								{t("contacts.subSider.organization")}
							</Flex>
						),
						extra: <MagicIcon size={18} component={IconChevronRight} />,
					},
					...(pathNodesState?.map((node) => {
						return {
							id: node.id,
							route: RoutePath.ContactsOrganization,
							pathNodes: pathNodesState.map((n) => ({
								id: n.id,
								name: n.name,
							})),
							title: (
								<MagicSpin spinning={isLoadingDepartmentInfos}>
									<Flex gap={8} align="center" style={{ marginLeft: 40 }}>
										{Line}
										<span className={styles.departmentPathName}>
											{node.departmentPathName}
										</span>
									</Flex>
								</MagicSpin>
							),
							extra: <MagicIcon size={18} component={IconChevronRight} />,
						}
					}) ?? []),
				]}
			/>
		</Flex>
	)
})

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
		navigate(RoutePath.ContactsOrganization)
	})

	const handleItemClick = useMemoizedFn(({ route }: MagicListItemData) => {
		navigate(route)
	})

	return (
		<SubSiderContainer className={styles.container}>
			<Flex vertical gap={12} align="left" className={styles.innerContainer}>
				<Flex vertical gap={10}>
					<div className={styles.title}>{t("contacts.subSider.enterpriseInternal")}</div>
					<CurrentOrganization onItemClick={handleOrganizationItemClick} />
				</Flex>
				<div className={styles.divider} />
				<MagicList
					active={collapseKey}
					onItemClick={handleItemClick}
					items={[
						{
							id: "aiAssistant",
							route: RoutePath.ContactsAiAssistant,
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
						// 	route: RoutePath.ContactsMyFriends,
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
							route: RoutePath.ContactsMyGroups,
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
