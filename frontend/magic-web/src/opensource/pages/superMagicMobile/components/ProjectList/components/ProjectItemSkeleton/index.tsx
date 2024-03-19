import { useStyles } from "./styles"
import FlexBox from "@/opensource/components/base/FlexBox"

function ProjectItemSkeleton() {
	const { styles } = useStyles()

	return (
		<div className={styles.projectItem}>
			<div className={styles.projectIcon} />
			<FlexBox gap={4} vertical flex={1} style={{ maxWidth: "calc(100% - 100px)" }}>
				<FlexBox gap={4} align="center">
					<div className={styles.projectNameSkeleton} />
				</FlexBox>
				<div className={styles.projectUpdatedAtSkeleton} />
			</FlexBox>
			<div className={styles.projectActions}>
				<div className={styles.projectActionSkeleton} />
				<div className={styles.projectActionSkeleton} />
			</div>
		</div>
	)
}

export default ProjectItemSkeleton
