import { IconOctahedron } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { getWorkspaceRouteUrl } from "../../utils/route"

interface WorkspaceNavItemProps {
	workspaceId?: string
	onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

function WorkspaceNavItem({ workspaceId, onClick }: WorkspaceNavItemProps) {
	const { t } = useTranslation("super")

	return (
		<a
			className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg p-1.5 text-sm font-normal leading-5 text-foreground hover:bg-fill hover:text-foreground"
			href={getWorkspaceRouteUrl(workspaceId)}
			onClick={onClick}
			data-testid="workspace-nav-item"
		>
			<IconOctahedron size={16} />
			<div>{t("workspace.workspace")}</div>
		</a>
	)
}

export default WorkspaceNavItem
