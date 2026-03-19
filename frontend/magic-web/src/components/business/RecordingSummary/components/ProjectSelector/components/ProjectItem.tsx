import { createStyles } from "antd-style"
import { ProjectItemProps } from "../types"
import { useTranslation } from "react-i18next"
import IconProject from "@/pages/superMagic/components/icons/IconProject"
import WorkspaceTag from "./WorkspaceTag"
import MagicIcon from "@/components/base/MagicIcon"
import { IconCheck } from "@tabler/icons-react"

const useStyles = createStyles(({ css, token }) => ({
	projectItem: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid transparent;

		&:hover {
			background-color: ${token.colorFillTertiary};
		}

		&.selected {
			background-color: #eef3fd;
			border: 1px solid ${token.magicColorUsages.primary.default};
		}
	`,

	projectInfo: css`
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	`,

	projectDetails: css`
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		min-width: 0;
	`,

	projectIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background-color: ${token.colorFillQuaternary};
		border-radius: 4px;
		flex-shrink: 0;

		.anticon {
			color: ${token.colorTextSecondary};
			font-size: 14px;
		}
	`,

	projectName: css`
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-right: 4px;
	`,

	checkIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: ${token.magicColorUsages.primary.default};

		&.hidden {
			opacity: 0;
			visibility: hidden;
		}
	`,
}))

function ProjectItem({
	project,
	selected = false,
	onClick,
	showWorkspaceName = false,
}: ProjectItemProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const handleClick = () => {
		onClick?.(project)
	}

	return (
		<div className={cx(styles.projectItem, selected && "selected")} onClick={handleClick}>
			<div className={styles.projectInfo}>
				<div className={styles.projectDetails}>
					<div className={styles.projectIcon}>
						<IconProject />
					</div>
					<div
						className={styles.projectName}
						title={project.project_name || t("project.unnamedProject")}
					>
						{project.project_name || t("project.unnamedProject")}
					</div>
					{showWorkspaceName && <WorkspaceTag workspaceName={project.workspace_name} />}
				</div>
			</div>
			<div className={cx(styles.checkIcon, !selected && "hidden")}>
				<MagicIcon component={IconCheck} size={20} color="currentColor" />
			</div>
		</div>
	)
}

export default ProjectItem
