import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import StatusIcon from "../../../MessageHeader/components/StatusIcon"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"

interface TimeoutTipsProps {
	className?: string
	style?: React.CSSProperties
}

function TimeoutTips({ className, style }: TimeoutTipsProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	const reasonList = t("timeoutTips.reasonList", { returnObjects: true }) as string[]
	const actionList = t("timeoutTips.actionList", { returnObjects: true }) as string[]

	return (
		<div className={`${styles.container} ${className || ""}`} style={style}>
			{/* 主要说明文本 */}
			<div className={styles.mainText}>{t("timeoutTips.mainText")}</div>

			{/* 具体原因列表 */}
			<div className={styles.reasonContainer}>
				{reasonList.map((reason, index) => (
					<div key={index} className={styles.reasonItem}>
						<StatusIcon
							status={TaskStatus.WAITING}
							className={styles.dot}
							customFill
							size={10}
						/>
						<span className={styles.reasonText}>{reason}</span>
					</div>
				))}
			</div>

			{/* 状态说明 */}
			<div className={styles.statusText}>{t("timeoutTips.statusText")}</div>

			{/* 操作建议框 */}
			<div className={styles.actionBox}>
				<div className={styles.actionTitle}>{t("timeoutTips.actionTitle")}</div>
				<div className={styles.actionContainer}>
					{actionList.map((action, index) => (
						<div key={index} className={styles.actionItem}>
							<StatusIcon
								status={TaskStatus.WAITING}
								className={styles.dot}
								customFill
								size={10}
							/>
							<span className={styles.actionText}>{action}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default memo(TimeoutTips)
