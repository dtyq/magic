import { createStyles, keyframes } from "antd-style"

const shimmer = keyframes`
	0% {
		background-position: -1000px 0;
	}
	100% {
		background-position: 1000px 0;
	}
`

export const useStyles = createStyles(({ token, css }) => ({
	projectItem: css`
		height: 64px;
		padding: 10px 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: 8px;
	`,
	projectIcon: css`
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: linear-gradient(
			90deg,
			${token.colorFillTertiary} 25%,
			${token.colorFillQuaternary} 50%,
			${token.colorFillTertiary} 75%
		);
		background-size: 2000px 100%;
		animation: ${shimmer} 1.5s infinite;
	`,
	projectNameSkeleton: css`
		height: 20px;
		width: 144px;
		border-radius: 4px;
		background: linear-gradient(
			90deg,
			${token.colorFillTertiary} 25%,
			${token.colorFillQuaternary} 50%,
			${token.colorFillTertiary} 75%
		);
		background-size: 2000px 100%;
		animation: ${shimmer} 1.5s infinite;
	`,
	projectUpdatedAtSkeleton: css`
		height: 16px;
		width: 112px;
		border-radius: 4px;
		background: linear-gradient(
			90deg,
			${token.colorFillTertiary} 25%,
			${token.colorFillQuaternary} 50%,
			${token.colorFillTertiary} 75%
		);
		background-size: 2000px 100%;
		animation: ${shimmer} 1.5s infinite;
	`,
	projectActions: css`
		height: 100%;
		display: flex;
		align-items: center;
	`,
	projectChevronSkeleton: css`
		width: 16px;
		height: 16px;
		border-radius: 4px;
		background: linear-gradient(
			90deg,
			${token.colorFillTertiary} 25%,
			${token.colorFillQuaternary} 50%,
			${token.colorFillTertiary} 75%
		);
		background-size: 2000px 100%;
		animation: ${shimmer} 1.5s infinite;
	`,
}))
