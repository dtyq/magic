import { memo } from "react"
import { createStyles } from "antd-style"
import { IconChevronRight, IconUsers } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

const useShareWorkspaceStyles = createStyles(({ token, css }) => ({
	container: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 6px 12px;
		border-radius: 8px;
		cursor: pointer;
		background: transparent;

		&:hover {
			background: ${token.magicColorUsages.fill[0]};
		}
	`,
	left: css`
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	`,
	icon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		color: ${token.magicColorUsages.text[1]};
	`,
	textGroup: css`
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	`,
	title: css`
		font-size: 14px;
		line-height: 20px;
		font-weight: 400;
		color: ${token.magicColorUsages.text[1]};
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	`,
	desc: css`
		font-size: 10px;
		line-height: 13px;
		color: ${token.magicColorUsages.text[3]};
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	`,
	right: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		color: ${token.magicColorUsages.text[2]};
	`,
}))

function CollaborationWorkspace() {
	const { styles } = useShareWorkspaceStyles()
	const { t } = useTranslation("super")

	return (
		<div className={styles.container} data-name="ShareWorkspace">
			<div className={styles.left}>
				<div className={styles.icon}>
					<IconUsers size={20} />
				</div>
				<div className={styles.textGroup}>
					<div className={styles.title}>{t("workspace.teamSharedWorkspace")}</div>
					<div className={styles.desc}>{t("workspace.teamSharedWorkspaceDesc")}</div>
				</div>
			</div>
			<div className={styles.right}>
				<IconChevronRight size={20} />
			</div>
		</div>
	)
}

export default memo(CollaborationWorkspace)
