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
		padding: 4px 8px 4px 4px;
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: 8px;
		border: 1px solid ${token.magicColorUsages.border};
	`,
	projectIcon: css`
		width: 40px;
		height: 40px;
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
	projectNameSkeleton: css`
		height: 20px;
		width: 120px;
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
		height: 13px;
		width: 80px;
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
		align-items: stretch;
		gap: 8px;
	`,
	projectActionSkeleton: css`
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
