import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { Popover } from "antd"
import type { ReactNode } from "react"
import { useState, useMemo } from "react"
import OrganizationList from "./OrganizationList"
import { useCurrentMagicOrganization, useOrganization } from "@/opensource/models/user/hooks"
import PersonalOrganizationAvatar from "@/opensource/assets/resources/personal-organization-avatar.svg"
import { userStore } from "@/opensource/models/user"
import { observer } from "mobx-react-lite"
import { cn } from "@/opensource/lib/utils"

export interface OrganizationSwitchProps {
	className?: string
	showPopover?: boolean
	children?: ReactNode
}

const OrganizationSwitch = observer(function OrganizationSwitch({
	className,
	showPopover = true,
	children,
	...props
}: OrganizationSwitchProps) {
	const currentAccount = useCurrentMagicOrganization()
	const { organizations } = useOrganization()
	const { isPersonalOrganization } = userStore.user

	const teamshareOrganization = useMemo(() => {
		return organizations.find(
			(org) => org.organization_code === currentAccount?.third_platform_organization_code,
		)
	}, [currentAccount?.third_platform_organization_code, organizations])

	const [open, setOpen] = useState(false)

	const ChildrenContent = children ?? (
		<MagicAvatar
			src={
				isPersonalOrganization
					? PersonalOrganizationAvatar
					: teamshareOrganization?.organization_logo?.[0]?.url
			}
			size={30}
			className={cn(className, "border border-border text-white")}
		>
			{teamshareOrganization?.organization_name ?? currentAccount?.magic_organization_code}
		</MagicAvatar>
	)

	const handleOrganizationListClose = () => {
		setOpen(false)
	}

	if (!showPopover) {
		return ChildrenContent
	}

	return (
		<Popover
			styles={{
				root: {
					marginBottom: 12,
					marginLeft: 4,
				},
				body: {
					padding: 0,
				},
			}}
			placement="rightBottom"
			open={open}
			onOpenChange={setOpen}
			arrow={false}
			trigger={["click"]}
			autoAdjustOverflow
			content={<OrganizationList onClose={handleOrganizationListClose} />}
			{...props}
		>
			{ChildrenContent}
		</Popover>
	)
})

export default OrganizationSwitch
