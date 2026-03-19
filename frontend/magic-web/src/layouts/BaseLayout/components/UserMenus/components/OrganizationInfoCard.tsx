import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { observer } from "mobx-react-lite"
import MagicDropdown from "@/components/base/MagicDropdown"
import OrganizationList from "@/layouts/BaseLayout/components/Sider/components/OrganizationSwitch/OrganizationList"
import { userStore } from "@/models/user"
import { cn } from "@/lib/utils"
import OrganizationAvatarRender from "@/components/business/OrganizationAvatarRender"
import OrganizationRender from "@/components/business/OrganizationRender"

interface OrganizationInfoCardProps {
	onClose: () => void
}

const OrganizationInfoCard = observer(function OrganizationInfoCard({
	onClose,
}: OrganizationInfoCardProps) {
	const [organizationListOpen, setOrganizationListOpen] = useState(false)

	const userInfo = userStore.user.userInfo

	function handleOrganizationListClose() {
		setOrganizationListOpen(false)
		onClose()
	}

	return (
		<div
			className="flex w-full flex-col items-start overflow-hidden rounded-md border border-border bg-sidebar"
			data-testid="user-menus-organization-info"
		>
			{/* User Card */}
			<MagicDropdown
				placement="right"
				open={organizationListOpen}
				onOpenChange={setOrganizationListOpen}
				trigger={["click"]}
				popupRender={() => (
					<div
						className="flex w-[300px] max-w-[90vw] flex-col items-start gap-2.5 rounded-lg bg-popover text-popover-foreground"
						data-testid="user-menus-organization-list"
						onClick={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
					>
						<OrganizationList onClose={handleOrganizationListClose} />
					</div>
				)}
				overlayClassName="p-0"
			>
				<div
					className={cn(
						"flex w-full cursor-pointer items-center gap-2 p-2",
						"hover:bg-sidebar-accent",
						"border-b border-border",
					)}
					data-testid="user-menus-organization-switch"
					onClick={(e) => e.stopPropagation()}
				>
					{/* Avatar */}
					<OrganizationAvatarRender size={32} />

					{/* User Details Column */}
					<div className="flex min-h-px min-w-px flex-1 flex-col items-start justify-center gap-0.5">
						<p
							className="w-full truncate text-sm font-semibold leading-5 text-sidebar-foreground"
							data-testid="user-menus-organization-name"
						>
							<OrganizationRender organizationCode={userInfo?.organization_code} />
						</p>
					</div>

					{/* Collapse Icon */}
					<div className="flex h-4 w-4 shrink-0 items-center justify-center">
						<ChevronRight className="h-4 w-4" />
					</div>
				</div>
			</MagicDropdown>
		</div>
	)
})

export default OrganizationInfoCard
