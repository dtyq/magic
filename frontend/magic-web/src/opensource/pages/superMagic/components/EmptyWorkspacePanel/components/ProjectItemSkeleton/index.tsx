import { createStyles, keyframes } from "antd-style"
import { ViewMode } from "../ProjectItem"

interface ProjectItemSkeletonProps {
	viewMode?: ViewMode
}

const useStyles = createStyles(({ css, token }) => {
	const shimmer = keyframes`
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	`

	return {
		skeletonItem: css`
			position: relative;
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background: ${token.magicColorUsages.bg[1]};
			height: 183px;
		`,
		skeletonItemListMode: css`
			height: 56px;
			flex-direction: row;
			align-items: center;
			justify-content: flex-start;
			width: 100%;
			padding: 0;
		`,
		skeletonIcon: css`
			position: relative;
			flex: 1;
			background: #f9f9f9;
			border-radius: 4px;
			padding: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
		`,
		skeletonIconListMode: css`
			width: 40px;
			height: 40px;
			flex: 0;
			padding: 0;
		`,
		skeletonIconInner: css`
			width: 60px;
			height: 60px;
			background-color: ${token.colorFillQuaternary};
			border-radius: 4px;
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
		skeletonIconInnerListMode: css`
			width: 40px;
			height: 40px;
		`,
		skeletonContent: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
			max-width: 100%;
		`,
		skeletonContentListMode: css`
			flex: 1;
			max-width: calc(100% - 50px);
		`,
		skeletonTitle: css`
			width: 100%;
			height: 20px;
			background-color: ${token.colorFillQuaternary};
			border-radius: 4px;
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
		skeletonTime: css`
			width: 60%;
			height: 13px;
			background-color: ${token.colorFillQuaternary};
			border-radius: 4px;
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
	}
})

function ProjectItemSkeleton({ viewMode = ViewMode.GRID }: ProjectItemSkeletonProps) {
	const { styles, cx } = useStyles()
	const isListMode = viewMode === ViewMode.LIST

	return (
		<div
			className={cx(styles.skeletonItem, {
				[styles.skeletonItemListMode]: isListMode,
			})}
		>
			<div
				className={cx(styles.skeletonIcon, {
					[styles.skeletonIconListMode]: isListMode,
				})}
			>
				<div
					className={cx(styles.skeletonIconInner, {
						[styles.skeletonIconInnerListMode]: isListMode,
					})}
				/>
			</div>
			<div
				className={cx(styles.skeletonContent, {
					[styles.skeletonContentListMode]: isListMode,
				})}
			>
				<div className={styles.skeletonTitle} />
				<div className={styles.skeletonTime} />
			</div>
		</div>
	)
}

export default ProjectItemSkeleton
