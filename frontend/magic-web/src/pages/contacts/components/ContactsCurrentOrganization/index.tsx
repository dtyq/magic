import MagicIcon from "@/components/base/MagicIcon"
import { MagicList } from "@/components/MagicList"
import { MagicListItemData } from "@/components/MagicList/types"
import AutoTooltipText from "@/components/other/AutoTooltipText"
import { useCurrentMagicOrganization } from "@/models/user/hooks"
import { IconChevronRight } from "@tabler/icons-react"
import { MagicAvatar, MagicSpin } from "@dtyq/magic-admin/components"
import { Flex } from "antd"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Line } from "../ContactsSubSider/Line"
import { useStyles } from "../ContactsSubSider/styles"
import { useCurrentOrganizationData } from "./hooks"
import { RouteName } from "@/routes/constants"

export interface CurrentOrganizationProps {
	onItemClick: (data: MagicListItemData) => void
}

const CurrentOrganization = observer(({ onItemClick }: CurrentOrganizationProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const organization = useCurrentMagicOrganization()

	// Use custom hook for data logic
	const { isLoading, pathNodesState } = useCurrentOrganizationData()

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
						route: RouteName.ContactsOrganization,
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
							route: RouteName.ContactsOrganization,
							pathNodes: pathNodesState.map((n) => ({
								id: n.id,
								name: n.name,
							})),
							title: (
								<MagicSpin spinning={isLoading}>
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

export default CurrentOrganization
