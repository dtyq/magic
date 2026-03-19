import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token }) => {
	return {
		wrapper: css`
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 20px;
		`,
		header: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px; /* 137.5% */
		`,
		container: css`
			width: 100%;
			display: flex;
			flex: 1;
		`,
		input: css`
			width: 100%;
			height: 100%;
			resize: none !important;
		`,
		loadingContainer: css`
			display: flex;
			justify-content: center;
			padding: 8px;
		`,
		errorText: css`
			color: ${token.colorError};
			font-size: 12px;
			margin-top: 4px;
		`,
	}
})

export default useStyles
