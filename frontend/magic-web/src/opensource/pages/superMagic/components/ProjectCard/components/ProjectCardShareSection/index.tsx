import type { ReactNode } from "react"

export interface ProjectCardShareSectionProps {
	/** Collaborator status text */
	collaboratorContent: ReactNode
	/** Click handler for invite collaborator button */
	onInviteClick?: () => void
}

/**
 * Open-source: Share section returns null. Full UI exists in enterprise overlay.
 */
function ProjectCardShareSection(_props: ProjectCardShareSectionProps) {
	return null
}

export default ProjectCardShareSection
