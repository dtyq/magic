import StatusIcon from "@/pages/superMagic/components/MessageHeader/components/StatusIcon"
import { useStyles } from "./styles"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"

function TopicItemSkeleton() {
	const { styles } = useStyles()

	return (
		<div className={styles.topicItem}>
			<div className={styles.leftContent}>
				<StatusIcon status={TaskStatus.WAITING} />
				<div className={styles.statusIconSkeleton} />
				<div className={styles.topicTitleSkeleton} />
			</div>
			<div className={styles.rightActions}>
				<div className={styles.actionButtonSkeleton} />
			</div>
		</div>
	)
}

export default TopicItemSkeleton
