import MagicPopup from "@/components/base-mobile/MagicPopup"
import ProjectSelectorMain from "./Main"
import MagicModal from "@/components/base/MagicModal"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useState, useEffect } from "react"
import { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { IconX } from "@tabler/icons-react"
import FlexBox from "@/components/base/FlexBox"
import { useStyles } from "./styles"

interface ProjectSelectorMainProps {
	open: boolean
	onClose: () => void
	initialProject?: ProjectListItem | null
	initialWorkspace?: Workspace | null
	onProjectConfirm: (project: ProjectListItem | null, workspace: Workspace | null) => void
	title?: string
}

function ProjectSelector(props: ProjectSelectorMainProps) {
	const isMobile = useIsMobile()

	const { open, onClose, onProjectConfirm, title, initialProject, initialWorkspace } = props

	const { styles } = useStyles()

	const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null)
	const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)

	// Initialize selection when modal opens with initial values from selection
	useEffect(() => {
		if (open) {
			// Set initial values when modal opens (use provided values or null)
			if (initialProject !== undefined) {
				setSelectedProject(initialProject)
			}
			if (initialWorkspace !== undefined) {
				setSelectedWorkspace(initialWorkspace)
			}
		}
	}, [initialProject, initialWorkspace, open])

	const MainContent = (
		<ProjectSelectorMain
			selectedProject={selectedProject}
			selectedWorkspace={selectedWorkspace}
			onWorkspaceArrowClick={setSelectedWorkspace}
			onProjectSelect={setSelectedProject}
			onWorkspaceChange={setSelectedWorkspace}
			onProjectConfirm={onProjectConfirm}
			onCancel={onClose}
		/>
	)

	if (isMobile) {
		return (
			<MagicPopup visible={open} onClose={onClose}>
				<FlexBox align="center" justify="space-between" className={styles.titleWrapper}>
					<div className={styles.title}>{title}</div>
					<IconX onClick={onClose} className={styles.closeIcon} />
				</FlexBox>
				{MainContent}
			</MagicPopup>
		)
	}

	return (
		<MagicModal
			open={open}
			onCancel={onClose}
			title={title}
			classNames={{
				header: styles.header,
				body: styles.body,
				content: styles.content,
				footer: styles.footer,
			}}
			footer={null}
			maskClosable={false}
			centered
			width={800}
		>
			{MainContent}
		</MagicModal>
	)
}

export default ProjectSelector
export type { ProjectSelectorMainProps as ProjectSelectorProps, ProjectOption } from "./types"
export { default as PcSelectorButton } from "./Actions/PcActionButton"
