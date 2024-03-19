import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		layout: css`
			width: 100%;
			height: 860px;
			max-height: 80vh;
			border-radius: 12px;
			overflow: hidden;
			display: flex;
			flex-direction: column;

			@media (max-width: 768px) {
				height: 85vh;
				max-height: 85vh;
			}
		`,
		main: css`
			width: 100%;
			height: fit-content;
			flex: none;
			padding: 0 20px;

			@media (max-width: 768px) {
				padding: 0;
			}
		`,
		header: css`
			width: 100%;
			height: 70px;
			flex: none;
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 20px 0;
			color: ${token.magicColorUsages.text[1]};
			font-size: 18px;
			font-weight: 600;
			line-height: 24px; /* 133.333% */
		`,
		breadcrumbDivider: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[3]};
		`,
		back: css`
			width: 30px;
			height: 30px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.fill[0]};
			color: ${token.magicColorUsages.text[2]};

			&:hover {
				background-color: ${token.magicColorUsages.fill[1]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[2]};
			}
		`,
		icon: css`
			width: 30px;
			height: 30px;
			border-radius: 8px;
			overflow: hidden;
			background: linear-gradient(#02aab0, #00cdac);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			color: #fff;
		`,
		close: css`
			width: 30px;
			height: 30px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			transition: all linear 0.1s;
			border-radius: 6px;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
	}
})
