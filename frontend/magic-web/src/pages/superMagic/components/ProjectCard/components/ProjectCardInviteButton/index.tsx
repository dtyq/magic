export interface ProjectCardInviteButtonProps {
	/** Opens the add-collaborators flow */
	onInviteClick?: () => void
}

/**
 * Icon-sized "add collaborators" entry of the compact project card.
 * Open-source: collaboration is an enterprise feature, so this renders nothing; the enterprise
 * overlay mirrors this path with the real button.
 */
function ProjectCardInviteButton(_props: ProjectCardInviteButtonProps) {
	return null
}

export default ProjectCardInviteButton
