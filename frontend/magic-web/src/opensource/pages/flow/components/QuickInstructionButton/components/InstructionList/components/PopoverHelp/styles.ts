import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		topTitle: css`
			font-size: 16px;
			font-weight: 600;
			line-height: 22px;
			color: ${token.magicColorUsages.text[1]};
		`,
		tooltipContent: css`
			padding-top: 10px;
			position: relative;
			overflow: hidden;
			height: 50px;
			display: flex;
		`,
		img: css`
			width: 100%;
		`,
		mask: css`
			position: absolute;
			top: -200%;
			left: 0;
			width: 100%;
			height: 240px;
			border-radius: 50%;
			background: radial-gradient(
				circle,
				transparent 10%,
				rgba(255, 255, 255, 0.8) 50%,
				rgb(255, 255, 255) 100%
			);
		`,
		tooltipDesc: css`
			font-size: 12px;
			line-height: 14px;
			color: ${token.magicColorUsages.text[3]};
		`,
		addButton: css`
			padding: 0;
			color: ${token.magicColorScales.brand[5]};
			cursor: pointer;
		`,
		icon: css`
			color: ${token.magicColorUsages.text[2]};
		`,
	}
})
