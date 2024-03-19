import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 8px;
		background: ${token.magicColorScales.grey[0]};
		border-radius: 8px;
		max-width: 100%;
		width: fit-content;
	`,
	withDetail: css`
		width: 100%;
		max-height: 298px;
		&::after {
			content: "";
			position: absolute;
			bottom: 0;
			left: 0;
			width: 100%;
			height: 120px;
			background: linear-gradient(180deg, rgba(255, 255, 255, 0) 5.83%, #f9f9f9 72.08%);
			border-radius: 0 0 8px 8px;
		}
	`,
}))
