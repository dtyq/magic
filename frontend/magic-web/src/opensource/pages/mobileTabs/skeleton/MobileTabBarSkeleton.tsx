import { createStyles, keyframes } from "antd-style"

const shimmer = keyframes`
	0% {
		transform: translateX(-100%);
	}
	100% {
		transform: translateX(100%);
	}
`

const useStyles = createStyles(({ css, token }) => ({
	tabBarWrapper: css``,
	tabBar: css`
		background-color: ${token.magicColorUsages?.bg?.[0]};
		border-top: 1px solid ${token.magicColorUsages?.border};
		height: calc(60px + ${token.safeAreaInsetBottom});
		padding: 0 10px;
		padding-bottom: ${token.safeAreaInsetBottom};
		width: 100%;
		border-top-left-radius: 16px;
		border-top-right-radius: 16px;
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-around;
		gap: 4px;
	`,
	tabItem: css`
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		height: 44px;
		border-radius: 12px;
		padding: 8px 12px;
	`,
	skeletonIcon: css`
		width: 20px;
		height: 20px;
		border-radius: 4px;
		background-color: ${token.colorFillQuaternary};
		position: relative;
		overflow: hidden;

		&::after {
			content: "";
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: linear-gradient(
				90deg,
				transparent,
				${token.colorFillSecondary},
				transparent
			);
			transform: translateX(-100%);
			animation: ${shimmer} 1.5s infinite ease-in-out;
		}
	`,
	skeletonTitle: css`
		width: 40px;
		height: 14px;
		border-radius: 2px;
		background-color: ${token.colorFillQuaternary};
		position: relative;
		overflow: hidden;

		&::after {
			content: "";
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: linear-gradient(
				90deg,
				transparent,
				${token.colorFillSecondary},
				transparent
			);
			transform: translateX(-100%);
			animation: ${shimmer} 1.5s infinite ease-in-out;
		}
	`,
}))

function MobileTabBarSkeleton() {
	const { styles } = useStyles()

	return (
		<div className={styles.tabBarWrapper}>
			<div className={styles.tabBar}>
				{Array.from({ length: 4 }).map((_, index) => (
					<div key={index} className={styles.tabItem}>
						<div className={styles.skeletonIcon} />
						<div className={styles.skeletonTitle} />
					</div>
				))}
			</div>
		</div>
	)
}

export default MobileTabBarSkeleton
