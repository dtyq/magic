import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }, { isMobile }: { isMobile: boolean }) => {
	return {
		title: css`
			font-size: ${isMobile ? "14px" : "16px"};
			font-weight: 400;
			text-wrap: nowrap;
			color: ${token.magicColorUsages.text[1]};
			// overflow: hidden;
			text-overflow: ellipsis;
		`,
		description: css`
			font-size: 12px;
			display: inline-block;
			text-align: left;
			color: ${token.magicColorUsages.text[3]};
			overflow: hidden;
			text-overflow: ellipsis;
			line-clamp: 1;
			-webkit-line-clamp: 1;
			display: -webkit-box;
			-webkit-box-orient: vertical;
		`,
		listItem: css`
			height: 44px;
			padding: ${isMobile ? "6px" : "10px"};
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			background-color: ${token.magicColorUsages.bg[0]};
			// overflow: hidden;
		`,
		modelInfo: css`
			overflow: hidden;
		`,
		tag: css`
			margin: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.magicColorUsages.text[2]};
			background-color: ${token.magicColorUsages.bg[0]};
		`,
	}
})
