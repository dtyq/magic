import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { useCurrentMagicOrganization, useOrganization } from "@/opensource/models/user/hooks"
import { Popover, Flex } from "antd"
import { memo, useMemo } from "react"
import MagicButton from "@/opensource/components/base/MagicButton"
import { IconCaretDownFilled } from "@tabler/icons-react"
import { useStyles } from "./styles"
import PersonalOrganizationAvatar from "@/opensource/assets/resources/personal-organization-avatar.svg"
import { userStore } from "@/opensource/models/user"
import Department from "@/opensource/components/business/OrganizationItem/icons/Department"
import OrganizationList from "@/opensource/layouts/BaseLayout/components/Sider/components/OrganizationSwitch/OrganizationList"

interface OrganizationSwitchProps {
	className?: string
}

const OrganizationSwitch = ({ className }: OrganizationSwitchProps) => {
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
			<MagicButton type="text" className={styles.button}>
				<Flex gap={4} align="center">
					<MagicAvatar src={OrgLogo} size={24} className={cx(className, styles.avatar)}>
						{teamshareOrganization?.organization_name ??
							currentAccount?.magic_organization_code}
					</MagicAvatar>
					{teamshareOrganization?.organization_name ??
						currentAccount?.magic_organization_code}
					<IconCaretDownFilled size={18} color="currentColor" />
				</Flex>
			</MagicButton>
		</Popover>
	)
}

export default memo(OrganizationSwitch)
