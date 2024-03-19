import { createStyles } from "antd-style"
import ModeTabsSkeleton from "./ModeTabsSkeleton"
import useSkeletonStyles from "./useSkeletonStyles"

interface MessagePanelSkeletonProps {
	className?: string
	isMobile?: boolean
	showMobileModeSelector?: boolean
}

const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			width: 100%;
			border-radius: 12px;
			display: flex;
			flex-direction: column;
			gap: 10px;
		`,
		isMobile: css`
			padding: 12px;
			padding-bottom: 0;
			gap: 8px;
		`,
		editorWrapper: css`
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			height: 172px;
			gap: 12px;
			padding: 12px;
			border-radius: 12px;
			border: 1px solid ${token.magicColorUsages.border};
			background: ${token.magicColorUsages.bg[0]};
		`,
		editorWrapperMobile: css`
			height: 160px;
		`,
		input: css`
			height: 72px;
			border-radius: 12px;
		`,
		toolbar: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
		`,
		toolbarLeft: css`
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		icon: css`
			width: 32px;
			height: 32px;
			border-radius: 10px;
		`,
		modeSwitch: css`
			width: 110px;
			height: 32px;
			border-radius: 10px;
		`,
		quickStartHeader: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		quickStartTitle: css`
			width: 180px;
			height: 30px;
			border-radius: 6px;
		`,
		refresh: css`
			width: 24px;
			height: 24px;
			border-radius: 8px;
		`,
		cardList: css`
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 10px;
		`,
		card: css`
			flex: 1;
			height: 96px;
			border-radius: 12px;
		`,
	}
})

function MessagePanelSkeleton({
	className,
	isMobile,
	showMobileModeSelector = true,
}: MessagePanelSkeletonProps) {
	const { styles, cx } = useStyles()
	const { styles: skeletonStyles } = useSkeletonStyles()

	return (
		<div className={cx(styles.container, className, { [styles.isMobile]: isMobile })}>
			{!isMobile && <ModeTabsSkeleton />}

			<div className={cx(styles.editorWrapper, { [styles.editorWrapperMobile]: isMobile })}>
				<div className={cx(styles.input, skeletonStyles.skeleton)} />
				<div className={styles.toolbar}>
					<div className={styles.toolbarLeft}>
						{Array.from({ length: 4 }).map((_, index) => (
							<div key={index} className={cx(styles.icon, skeletonStyles.skeleton)} />
						))}
					</div>
					<div className={cx(styles.modeSwitch, skeletonStyles.skeleton)} />
				</div>
			</div>

			{isMobile ? (
				showMobileModeSelector && (
					<div className={styles.quickStartHeader}>
						<div className={cx(styles.quickStartTitle, skeletonStyles.skeleton)} />
						<div className={cx(styles.quickStartTitle, skeletonStyles.skeleton)} />
						<div className={cx(styles.quickStartTitle, skeletonStyles.skeleton)} />
						<div className={cx(styles.quickStartTitle, skeletonStyles.skeleton)} />
					</div>
				)
			) : (
				<div className={styles.quickStartHeader}>
					<div className={cx(styles.quickStartTitle, skeletonStyles.skeleton)} />
					<div className={cx(styles.refresh, skeletonStyles.skeleton)} />
				</div>
			)}

			{!isMobile && (
				<div className={styles.cardList}>
					{Array.from({ length: 5 }).map((_, index) => (
						<div key={index} className={cx(styles.card, skeletonStyles.skeleton)} />
					))}
				</div>
			)}
		</div>
	)
}

export default MessagePanelSkeleton
