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
	topicItem: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		padding: 4px;
		border-radius: 8px;
		background-color: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		height: 40px;
	`,
	leftContent: css`
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		overflow: hidden;
	`,
	statusIconSkeleton: css`
		width: 20px;
		height: 20px;
		border-radius: 20px;
		flex-shrink: 0;
		background: linear-gradient(
			90deg,
			${token.colorFillTertiary} 25%,
			${token.colorFillQuaternary} 50%,
			${token.colorFillTertiary} 75%
		);
		background-size: 2000px 100%;
		animation: ${shimmer} 1.5s infinite;
	`,
	modeTagSkeleton: css`
		width: 48px;
		height: 20px;
		border-radius: 4px;
		flex-shrink: 0;
		background: linear-gradient(
			90deg,
			${token.colorFillTertiary} 25%,
			${token.colorFillQuaternary} 50%,
			${token.colorFillTertiary} 75%
		);
		background-size: 2000px 100%;
		animation: ${shimmer} 1.5s infinite;
	`,
	topicTitleSkeleton: css`
		height: 20px;
		flex: 1;
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
	rightActions: css`
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	`,
	actionButtonSkeleton: css`
		width: 18px;
		height: 18px;
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
