import { createStyles } from "antd-style"
import useSkeletonStyles from "./useSkeletonStyles"

const useModeTabsStyles = createStyles(({ css }) => ({
	modeTabs: css`
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 32px;
		margin-top: 10px;
	`,
	modeTab: css`
		width: 50px;
		height: 50px;
		margin-bottom: 32px;
		border-radius: 16px;
	`,
}))

function ModeTabsSkeleton() {
	const { styles, cx } = useModeTabsStyles()
	const { styles: skeletonStyles } = useSkeletonStyles()
	return (
		<div className={styles.modeTabs}>
			{Array.from({ length: 6 }).map((_, index) => (
				<div key={index} className={cx(styles.modeTab, skeletonStyles.skeleton)} />
			))}
		</div>
	)
}

export default ModeTabsSkeleton
