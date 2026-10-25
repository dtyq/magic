import MagicAvatar from "@/components/base/MagicAvatar"
import { useCurrentMagicOrganization, useOrganization } from "@/models/user/hooks"
import { Popover, Flex } from "antd"
import { memo, useMemo } from "react"
import MagicButton from "@/components/base/MagicButton"
import { IconChevronDown } from "@tabler/icons-react"
import { IconBuilding } from "@tabler/icons-react"
import { useStyles } from "./styles"
import PersonalOrganizationAvatar from "@/assets/resources/personal-organization-avatar.svg"
import { userStore } from "@/models/user"
import Department from "@/components/business/OrganizationItem/icons/Department"
import OrganizationList from "@/layouts/BaseLayout/components/Sider/components/OrganizationSwitch/OrganizationList"

interface OrganizationSwitchProps {
	className?: string
	/** Optional class applied to the trigger button rather than the avatar. */
	triggerClassName?: string
	iconOnly?: boolean
}

const OrganizationSwitch = ({ className, triggerClassName, iconOnly = false }: OrganizationSwitchProps) => {
	const { styles, cx } = useStyles()

	const { isPersonalOrganization } = userStore.user
	const currentAccount = useCurrentMagicOrganization()
	const { organizations } = useOrganization()

	const teamshareOrganization = useMemo(() => {
		return organizations.find(
			(org) => org.organization_code === currentAccount?.third_platform_organization_code,
		)
	}, [currentAccount?.third_platform_organization_code, organizations])

	const OrgLogo = useMemo(() => {
		if (isPersonalOrganization) {
			return PersonalOrganizationAvatar
		}
		if (teamshareOrganization?.organization_logo?.[0]?.url) {
			return teamshareOrganization?.organization_logo?.[0]?.url
		}
		return currentAccount?.organization_logo || <Department />
	}, [currentAccount?.organization_logo, isPersonalOrganization, teamshareOrganization])

	return (
		<Popover
			classNames={{
				root: styles.popover,
			}}
			placement="bottom"
			arrow={false}
			trigger={["click"]}
			autoAdjustOverflow
			getPopupContainer={(t) => t.parentNode as HTMLElement}
			content={<OrganizationList />}
		>
			<MagicButton type="text" className={cx(styles.button, triggerClassName)}>
				<Flex gap={4} align="center">
					{!iconOnly && (
						<MagicAvatar src={OrgLogo} size={24} className={cx(className, styles.avatar)}>
							{teamshareOrganization?.organization_name ??
								currentAccount?.magic_organization_code}
						</MagicAvatar>
					)}
					{iconOnly ? <IconBuilding size={18} aria-hidden="true" /> : null}
					{!iconOnly &&
						(teamshareOrganization?.organization_name ??
							currentAccount?.magic_organization_code)}
					{!iconOnly && <IconChevronDown size={15} stroke={1.8} color="currentColor" />}
				</Flex>
			</MagicButton>
		</Popover>
	)
}

export default memo(OrganizationSwitch)
