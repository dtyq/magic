import { convertMenuItemsToComponents } from "@/opensource/components/base/MagicDropdown/utils"
import type { MenuProps } from "antd"
import OrganizationInfoCard from "./OrganizationInfoCard"

interface UserMenuContentProps {
	menu: MenuProps["items"]
	onMenuClick: (info: { key: string }) => void
	onClose: () => void
}

function UserMenuContent({ menu, onMenuClick, onClose }: UserMenuContentProps) {
	return (
		<div
			className="min-w-80 rounded-xl bg-popover text-popover-foreground"
			data-testid="user-menus-content"
		>
			<div className="flex flex-col gap-2.5 px-1 pt-1" data-testid="user-menus-user-wrapper">
				<OrganizationInfoCard onClose={onClose} />
			</div>
			<div className="m-[5px_4px] min-w-0 select-none" data-testid="user-menus-menu">
				{convertMenuItemsToComponents(menu, {
					onClick: onMenuClick,
				})}
			</div>
		</div>
	)
}

export default UserMenuContent
