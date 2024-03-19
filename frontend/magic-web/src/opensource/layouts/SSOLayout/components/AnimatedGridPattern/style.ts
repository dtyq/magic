import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		pointer-events: none;
		position: absolute;
		inset: 0;
		height: 100%;
		width: 100%;
		fill: ${token.magicColorUsages.fill[0]};
		stroke: ${token.magicColorScales.grey[1]};
		mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.8), transparent 80%);
		background: radial-gradient(
			circle at center,
			${token.magicColorUsages.bg[0]} 0%,
			${token.magicColorUsages.bg[1]} 100%
		);

		@media (max-width: 700px) {
			display: none;
		}
	`,
	overflowSvg: css`
		overflow: visible;
	`,
	wrapper: css`
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		overflow: hidden;
	`,
	content: css`
		height: 100%;
		width: 100%;
	`,
}))
