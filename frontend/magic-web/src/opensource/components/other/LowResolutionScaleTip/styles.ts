import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		modalContainer: css`
			.${prefixCls}-modal-body {
				padding: 20px;
			}
		`,

		content: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			align-items: center;
			justify-content: flex-start;
			width: 100%;
		`,

		titleSection: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
			align-items: center;
			justify-content: flex-start;
			width: 100%;
			text-align: center;
		`,

		title: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 600;
			font-size: 28px;
			line-height: 40px;
			color: rgba(28, 29, 35, 0.8);
			margin: 0;
		`,

		subtitle: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;
			color: rgba(28, 29, 35, 0.6);
			margin: 0;
		`,

		demoSection: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			align-items: flex-start;
			justify-content: flex-start;
			width: 100%;
		`,

		demoArea: css`
			background-color: #e6e7ea;
			width: 450px;
			max-width: 100%;
			border-radius: 12px;
			border: 1px solid ${token.colorBorder};
			position: relative;
		`,

		shortcutSection: css`
			display: flex;
			flex-direction: row;
			gap: 10px;
			align-items: center;
			justify-content: center;
		`,

		shortcutText: css`
			font-family: "PingFang SC", sans-serif;
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;
			color: rgba(28, 29, 35, 0.6);
			margin: 0;
		`,

		keyGroup: css`
			display: flex;
			flex-direction: row;
			gap: 4px;
			align-items: center;
			justify-content: center;
		`,

		keyButton: css`
			background-color: #ffffff;
			border: 1px solid ${token.colorBorder};
			border-radius: 4px;
			box-shadow: 0px 2px 0px 0px #c6c8cd;
			padding: 3px 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 30px;
			height: 30px;

			font-family: "Inter", sans-serif;
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;
			color: #1c1d23;
		`,

		closeButton: css`
			width: 100%;
			margin-top: 30px;
			display: flex;
			padding: 8px 24px;
			justify-content: center;
			align-items: center;
			gap: 10px;
			align-self: stretch;
			border-radius: 8px;
			border: 1px solid ${token.colorBorder};
			background: ${token.magicColorUsages.fill[0]};
			color: ${token.magicColorUsages.text[2]};
			--${prefixCls}-color-primary-hover: ${token.magicColorUsages.fill[1]};
			--${prefixCls}-button-primary-color: ${token.magicColorUsages.text[2]};

			--${prefixCls}-color-primary-active: ${token.magicColorUsages.fill[2]};
			--${prefixCls}-button-primary-color: ${token.magicColorUsages.text[2]} !important;
		`,
	}
})
