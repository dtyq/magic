import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"
import { IconFolder } from "@tabler/icons-react"
import recordingSummaryStore from "@/stores/recordingSummary"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css, token }) => {
	return {
		projectSelectorButton: css`
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 4px;
			padding: 2px 6px;
			border: none;
			border-radius: 8px;
			background: transparent;
			cursor: pointer;
			font-size: 12px;
			line-height: 16px;
			color: rgba(28, 29, 35, 0.8);
			height: fit-content;
			min-height: 22px;

			&.disabled {
				cursor: default;
			}

			&:hover:not(.disabled) {
				background: ${token.colorFillTertiary};
			}

			@media (max-width: 768px) {
				&:hover {
					background: transparent;
				}
			}
		`,
		folderIcon: css`
			width: 22px;
			height: 22px;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		storageText: css`
			font-size: 12px;
			line-height: 16px;
			color: rgba(28, 29, 35, 0.8);
			white-space: nowrap;
			flex-shrink: 0;
		`,
		projectInfo: css`
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 2px;
			flex-shrink: 0;
		`,
		projectName: css`
			font-size: 12px;
			line-height: 16px;
			color: rgba(28, 29, 35, 0.8);
			white-space: nowrap;
			flex-shrink: 0;
		`,
		workspaceTag: css`
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0 4px;
			height: 16px;
			background: rgba(46, 47, 56, 0.05);
			border-radius: 4px;
		`,
		workspaceTagText: css`
			font-size: 10px;
			line-height: 13px;
			color: rgba(28, 29, 35, 0.6);
			white-space: nowrap;
		`,
		chevronIcon: css`
			width: 14px;
			height: 14px;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
	}
})

export function PcActionButton({ disabled }: { disabled: boolean }) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	// Get project and workspace info from store
	const {
		businessData: { project, workspace },
	} = recordingSummaryStore

	// Use display names or fallbacks
	const displayProjectName =
		project?.project_name ||
		(project?.id === "default"
			? t("recordingSummary.projectSelector.newProject")
			: t("project.unnamedProject"))
	const displayWorkspaceName = workspace?.name || t("workspace.unnamedWorkspace")

	return (
		<div className={cx(styles.projectSelectorButton, disabled && "disabled")}>
			{/* Folder icon */}
			<div className={styles.folderIcon}>
				<IconFolder size={22} />
			</div>

			{/* Storage text */}
			<span className={styles.storageText}>
				{t("recordingSummary.projectSelector.storageTo")}:
			</span>

			{/* Project info */}
			<div className={styles.projectInfo}>
				<span className={styles.projectName}>
					{displayWorkspaceName} / {displayProjectName}
				</span>

				{/* Workspace tag */}
				{/* <WorkspaceTag workspaceName={displayWorkspaceName} /> */}
			</div>
		</div>
	)
}

export default observer(PcActionButton)
