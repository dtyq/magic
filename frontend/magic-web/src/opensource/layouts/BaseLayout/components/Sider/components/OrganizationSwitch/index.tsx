import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { useCurrentMagicOrganization } from "@/opensource/models/user/hooks"
import ComponentRender from "@/opensource/components/ComponentRender"
import { Popover } from "antd"
import type { ReactNode } from "react"
import { useState, memo } from "react"
import { useStyles } from "./styles"
import OrganizationList from "./OrganizationList"

interface OrganizationSwitchProps {
	className?: string
	showPopover?: boolean
	children?: ReactNode
}

const OrganizationSwitch = memo(function OrganizationSwitch({
	className,
	showPopover = true,
	children,
}: OrganizationSwitchProps) {
	const { styles, cx } = useStyles()

	const currentAccount = useCurrentMagicOrganization()

	const [open, setOpen] = useState(false)

	const ChildrenContent = children ?? (
		<MagicAvatar
			src={currentAccount?.organization_logo}
			size={30}
			className={cx(className, styles.avatar)}
		>
			{currentAccount?.organization_name}
		</MagicAvatar>
	)

	if (!showPopover) {
		return ChildrenContent
	}

	return (
		<Popover
			classNames={{ root: styles.popover }}
			placement="rightBottom"
			open={open}
			onOpenChange={setOpen}
			arrow={false}
			trigger={["click"]}
			autoAdjustOverflow
			content={<ComponentRender componentName="OrganizationList" onClose={() => setOpen(false)} />}
		>
			{ChildrenContent}
		</Popover>
	)
})

export default OrganizationSwitch
