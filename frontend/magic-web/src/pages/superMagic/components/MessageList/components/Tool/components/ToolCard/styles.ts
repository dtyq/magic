import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ token, css }, { toFilterColor }: { toFilterColor: string }) => ({
		maxWidth: css`
			width: 100%;
		`,

		toolCardWrap: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,

		card: css`
			display: flex;
			flex-direction: column;
			justify-content: center;
			padding: 0 6px;
			border-radius: 8px;
			background: ${token.colorBgContainer};
			transition: all 0.2s ease;
			cursor: pointer;
			width: fit-content;
			max-width: 100%;
			box-shadow:
				0px 0px 1px 0px #0000004d,
				0px 4px 14px 0px ${toFilterColor};
			height: 32px;
			flex-shrink: 1;
			flex: 1;
		`,

		header: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,

		content: css`
			flex: 1;
			min-width: 0;
			overflow: hidden;
			line-height: 20px;
			height: 20px;
		`,

		action: css`
			font-size: 12px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[1]};
			line-height: 20px;
			flex-shrink: 0;
			white-space: nowrap;
		`,

		remark: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
			line-height: 20px;
			flex-shrink: 1;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			min-width: 0;
		`,

		suffix: css`
			display: flex;
			align-items: center;
			gap: 4px;
			flex-shrink: 0;
			margin-left: 8px;
		`,

		urlIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			color: ${token.colorTextTertiary};
			cursor: pointer;
			transition: color 0.2s ease;

			&:hover {
				color: ${token.colorPrimary};
			}
		`,
	}),
)
