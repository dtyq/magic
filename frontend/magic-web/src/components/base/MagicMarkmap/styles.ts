import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		container: css`
			width: 100%;
			height: calc(100% - 32px);
			min-height: 280px;
			position: relative;
			background: ${token.colorBgContainer};
		`,
		toolbarContainer: css`
			width: 100%;
			overflow-x: auto;
			overflow-y: hidden;
			padding: 6px;
			height: 40px;
		`,
		mindmapTitle: css`
			padding: 8px 12px;
			color: ${token.colorTextSecondary};
			text-align: justify;
			font-size: 14px;
			font-style: normal;
			line-height: 20px;
			font-weight: 600;
			flex-grow: 1;
			flex-shrink: 0;
			overflow: hidden;
		`,
		tools: css`
			height: 32px;
			width: fit-content;
			overflow-x: auto;
			overflow-y: hidden;
		`,
		toolbarText: css`
			color: ${token.colorTextSecondary};
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px;
		`,
		svg: css`
			width: 100%;
			height: 100%;
			min-height: 280px;
			background: ${token.colorBgContainer};
			background-image: radial-gradient(circle, rgba(0, 0, 0, 0.1), 1px, transparent 1px);
			background-size: 20px 20px;
			user-select: none;
		`,
		button: css`
			cursor: pointer;
			gap: 2px;
			color: ${token.colorTextSecondary};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			padding: 4px;
			flex: 0;

			.${prefixCls}-btn-icon {
				line-height: 0.5;
			}
		`,
		fullScreenContainer: css`
			height: 80vh;
			padding: 0 !important;
			overflow: hidden;
		`,
	}
})
