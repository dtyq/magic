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
			gap: 30px;
			align-items: flex-start;
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
			font-weight: 600;
			font-size: 24px;
			line-height: 32px;
			color: rgba(28, 29, 35, 0.8);
			margin: 0;
		`,

		subtitle: css`
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;
			color: rgba(28, 29, 35, 0.6);
			margin: 0;
		`,

		demoSection: css`
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			justify-content: flex-start;
			width: 100%;
		`,

		demoArea: css`
			background-color: #e6e7ea;
			border: 1px solid rgba(28, 29, 35, 0.08);
			border-radius: 8px;
			width: 100%;
			overflow: hidden;
			position: relative;
		`,

		demoImage: css`
			width: 100%;
			height: auto;
			display: block;
			object-fit: cover;
			object-position: center;
			pointer-events: none;
		`,

		stepsList: css`
			display: flex;
			flex-direction: column;
			gap: 6px;
			align-items: flex-start;
			justify-content: flex-start;
			width: 100%;
			margin: 0;
			padding: 0;
			list-style: decimal;
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;
			color: rgba(28, 29, 35, 0.8);
		`,

		stepItem: css`
			margin-left: calc(1.5 * 1 * var(--list-marker-font-size, 14px));
			white-space: pre-wrap;
		`,

		stepHighlight: css`
			font-weight: 600;
			color: #1c1d23;
		`,

		dontShowAgainButton: css`
			width: 100%;
			display: flex;
			padding: 8px 24px;
			justify-content: center;
			align-items: center;
			gap: 10px;
			border-radius: 8px;
			border: 1px solid rgba(28, 29, 35, 0.08);
			background: rgba(46, 47, 56, 0.05);
			color: rgba(28, 29, 35, 0.6);
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;

			&:hover {
				background: rgba(46, 47, 56, 0.08);
				border-color: rgba(28, 29, 35, 0.12);
			}
		`,
	}
})
