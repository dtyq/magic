import type {
	ProjectListItem,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import type { User } from "@/opensource/types/user"

export interface ProjectListItemProps {
	project: ProjectListItem
	workspace: Workspace | null
	userInfo: User.UserInfo | null
	isSelected: boolean
	onSelect: (project: ProjectListItem) => void
	onActionClick: (project: ProjectListItem) => void
	emptyText: string
}
