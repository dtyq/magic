import { createStyles } from "antd-style"

export const useStyle = createStyles(({ css, token }, tagStyles: { boxShadow: string }) => {
	return {
		node: css`
			width: 100%;
			height: fit-content;
			overflow: hidden;
			flex: none;
			padding: 10px 0;
		`,
		container: css`
			width: fit-content;
			padding: 8px;
			border-radius: 8px 8px 0 0;
			display: inline-flex;
			gap: 10px;
			align-items: center;
			background-color: ${token.magicColorScales.grey[0]};
			overflow: hidden;
		`,
		tag: css`
			width: fit-content;
			height: 32px;
			display: inline-flex;
			padding: 6px 6px 6px 6px;
			align-items: center;
			overflow: hidden;
			gap: 6px;
			border-radius: 8px;
			box-shadow: ${tagStyles.boxShadow};
			background-color: #fff;
			cursor: pointer;
		`,
		tagIcon: css`
			width: 20px;
			height: 20px;
			flex: none;

			img {
				vertical-align: top;
			}
		`,
		tagLabel: css`
			width: fit-content;
			flex: none;
			color: ${token.magicColorUsages.text[1]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
	}
})
