import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import { IconChevronRight, IconFolder } from "@tabler/icons-react"
import { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"
import { useStyles } from "./ProjectSelectorButtonStyle"
import { FlexBox } from "@/components/base"
import { useMemo } from "react"

interface ProjectSelectorButtonProps {
	selectedTopic: Topic | null
	selectedProject: ProjectListItem | null
	selectedProjectFromSelector: ProjectListItem | null
	size: MessageEditorSize
	onClick: () => void
	disabled: boolean
}

function ProjectSelectorButton({
	selectedTopic,
	selectedProject,
	selectedProjectFromSelector,
	size,
	onClick,
	disabled,
}: ProjectSelectorButtonProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const projectName = useMemo(() => {
		if (selectedProjectFromSelector) {
			return selectedProjectFromSelector.project_name || t("project.unnamedProject")
		}
		if (selectedProject) {
			return selectedProject.project_name || t("project.unnamedProject")
		}
		return t("recordingSummary.projectSelector.newProject")
	}, [selectedProjectFromSelector, selectedProject, t])

	if (selectedTopic) {
		return null
	}

	return (
		<button
			className={cx(styles.projectSelectorButton, size)}
			onClick={onClick}
			disabled={disabled}
			data-testid="recording-editor-project-selector-button"
		>
			{t("recordingSummary.projectSelector.storageTo")}:{" "}
			<FlexBox align="center" gap={2} className={styles.projectSelectorText}>
				<MagicIcon
					component={IconFolder}
					size={size === "small" ? 14 : 16}
					className={styles.projectSelectorIcon}
				/>
				<span className={styles.projectName}>{projectName}</span>
			</FlexBox>
			<MagicIcon
				component={IconChevronRight}
				size={size === "small" ? 14 : 20}
				className={styles.projectSelectorChangeLink}
			/>
		</button>
	)
}

export default ProjectSelectorButton
