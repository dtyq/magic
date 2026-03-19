import MagicAvatarStack from "@/components/base/MagicAvatarStack"
import MagicIcon from "@/components/base/MagicIcon"
import {
	CollaborationProjectListItem,
	Collaborator,
	ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { IconUsersPlus } from "@tabler/icons-react"
import { CSSProperties } from "react"
import { useStyles } from "./styles"
import { useMemoizedFn } from "ahooks"
import { canManageProject } from "@/pages/superMagic/utils/permission"

interface AddCollaboratorsProps<T extends ProjectListItem | CollaborationProjectListItem> {
	members: Collaborator[]
	totalCount: number
	style?: CSSProperties
	className?: string
	isSelfCollaborationProjectStatus?: boolean
	selectedProject: T
	onAddCollaborators?: (project: T) => void
}

function AddCollaborators<T extends ProjectListItem | CollaborationProjectListItem>({
	members,
	totalCount,
	className,
	style,
	isSelfCollaborationProjectStatus,
	selectedProject,
	onAddCollaborators,
}: AddCollaboratorsProps<T>) {
	const { styles, cx } = useStyles()

	const handleAddCollaborators = useMemoizedFn((e) => {
		e.stopPropagation()
		onAddCollaborators?.(selectedProject)
	})

	const canManage = canManageProject(selectedProject.user_role)

	return (
		<>
			<div
				className={cx(
					styles.container,
					isSelfCollaborationProjectStatus && styles.selfCollaboration,
					className,
					canManage && styles.canManage,
				)}
				style={style}
				onClick={canManage ? handleAddCollaborators : undefined}
			>
				{isSelfCollaborationProjectStatus && (
					<MagicIcon component={IconUsersPlus} size={14} />
				)}
				<MagicAvatarStack members={members} totalCount={totalCount} />
			</div>
		</>
	)
}

export default AddCollaborators
