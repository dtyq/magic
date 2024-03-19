import type {
	CollaborationProjectListItem,
	ProjectListItem,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { observer } from "mobx-react-lite"

interface WithCollaboratorsProps {
	selectedProject: ProjectListItem | CollaborationProjectListItem | null
}

/**
 * Open-source stub: collaboration panel is enterprise-only.
 * Renders nothing. Full UI exists in enterprise overlay.
 */
function WithCollaborators(_props: WithCollaboratorsProps) {
	return null
}

export function WithCollaboratorsNamed(_props: WithCollaboratorsProps) {
	return null
}

export default observer(WithCollaborators)
