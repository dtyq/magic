import { useStyles } from "./styles"
import FlexBox from "@/components/base/FlexBox"

/**
 * 项目骨架屏沿用原型行列表的高度与左右结构，避免加载完成前后出现布局跳变。
 */
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
				<div className={styles.projectChevronSkeleton} />
			</div>
		</div>
	)
}

export default ProjectItemSkeleton
