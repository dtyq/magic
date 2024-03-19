import { createStyles } from "antd-style"
import { memo } from "react"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css, token }) => ({
	workspaceTag: css`
		display: flex;
		height: 16px;
		padding: 0 4px;
		justify-content: center;
		align-items: center;
		gap: 10px;
		border-radius: 4px;
		background: ${token.magicColorUsages.fill[0]};

		color: ${token.magicColorUsages.text[2]};
		font-size: 10px;
		font-style: normal;
		font-weight: 400;
		line-height: 13px;
	`,
}))

function WorkspaceTag({ workspaceName }: { workspaceName: string }) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	return (
		<div className={styles.workspaceTag}>
			{workspaceName || t("workspace.unnamedWorkspace")}
		</div>
	)
}

export default memo(WorkspaceTag)
