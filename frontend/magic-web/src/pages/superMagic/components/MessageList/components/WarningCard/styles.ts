import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			background: ${token.magicColorScales.grey[0]};
			border-radius: 8px;
			padding: 8px;
			margin: 10px 0;
			display: flex;
			flex-direction: column;
			gap: 10px;
			width: 100%;
		`,

		header: css`
			background-color: ${token.magicColorUsages.white};
			border-radius: 8px;
			padding: 6px 10px 6px 6px;
			display: flex;
			align-items: center;
			gap: 6px;
			box-shadow:
				0px 0px 1px 0px rgba(0, 0, 0, 0.3),
				0px 4px 14px 0px rgba(255, 0, 4, 0.1);
			width: fit-content;
		`,

		iconWrapper: css`
			width: 20px;
			height: 20px;
			border-radius: 4px;
			background: linear-gradient(to right, #ffb347, #ffcc33);
			display: flex;
			align-items: center;
			justify-content: center;
			svg {
				stroke: #fff;
			}
		`,

		title: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 12px;
			line-height: 1.3333;
			color: ${token.magicColorUsages.text[1]};
		`,

		content: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			line-height: 1.4286;
			color: ${token.magicColorUsages.text[1]};
			flex: 1;
		`,

		buttonGroup: css`
			display: flex;
			align-items: center;
			gap: 10px;
			width: 100%;
		`,

		secondaryButton: css`
			height: 32px;
			padding: 6px 24px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.fill[0]};
			border: none;
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			color: ${token.magicColorUsages.text[1]};
			flex-shrink: 0;

			&:hover {
				background-color: ${token.magicColorUsages.fill[1]};
				border: none;
				color: ${token.magicColorUsages.text[1]};
			}

			&:focus {
				background-color: ${token.magicColorUsages.fill[0]};
				border: none;
				color: ${token.magicColorUsages.text[1]};
			}
		`,

		primaryButton: css`
			height: 32px;
			padding: 6px 12px;
			border-radius: 8px;
			background: linear-gradient(272deg, #ca58ff 3.75%, #6c8eff 51.14%, #4768d4 98.53%);
			border: none;
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			color: ${token.magicColorUsages.white};
			flex: 1;

			&:hover {
				background: linear-gradient(
					272deg,
					#ca58ff 3.75%,
					#6c8eff 51.14%,
					#4768d4 98.53%
				) !important;
				border: none;
				opacity: 0.9;
			}

			&:focus {
				background: linear-gradient(
					272deg,
					#ca58ff 3.75%,
					#6c8eff 51.14%,
					#4768d4 98.53%
				) !important;
				border: none;
			}

			&:disabled {
				color: ${token.colorWhite};
			}
		`,
	}
})
