import { cx } from "antd-style"
import { memo } from "react"
import EmptyWorkspacePanel from "../../components/EmptyWorkspacePanel"
import useStyles from "../Workspace/style"

const messages: any[] = []

// 工作区组件
function WorkspacePage() {
	/** ======================== Hooks ======================== */
	const { styles } = useStyles()

	return (
		<div className="flex-1 overflow-hidden rounded-xl border bg-white">
			<div className={styles.container} data-testid="main-workspace-container">
				<div className={cx(styles.messagePanelWrapper, styles.emptyMessagePanel)}>
					<EmptyWorkspacePanel messages={messages} />
				</div>
			</div>
		</div>
	)
}

// 导出的工作区组件
export default memo(WorkspacePage)
