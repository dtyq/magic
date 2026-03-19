import { createStyles } from "antd-style"

export const useVectorKnowledgeSubSiderStyles = createStyles(
	({ css, isDarkMode, token, prefixCls }) => {
		return {
			container: css`
				width: 100%;
				padding: 0 16px;
			`,
			info: css`
				padding: 16px 0 10px;
				margin-bottom: 4px;
				border-bottom: 1px solid
					${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.border};
			`,
			sourceType: css`
				display: inline-block;
				margin-bottom: 10px;
				padding: 3px 6px;
				font-size: 10px;
				line-height: 11px;
				color: rgba(28, 29, 35, 0.6);
				border: 1px solid rgba(28, 29, 35, 0.08);
				border-radius: 4px;
			`,
			name: css`
				font-weight: 600;
				font-size: 15px;
			`,
			logoImg: css`
				width: 32px;
				height: 32px;
				border-radius: 6px;
			`,
			descLabel: css`
				margin: 12px 0 8px;
				font-size: 12px;
				color: rgba(28, 29, 35, 0.35);
			`,
			descContent: css`
				font-size: 13px;
				color: rgba(28, 29, 35, 0.6);
				overflow: hidden;
				text-overflow: ellipsis;
				display: -webkit-box;
				-webkit-line-clamp: 3; /* 限制最多显示3行 */
				-webkit-box-orient: vertical;
			`,
			operationBtn: css`
				flex: 1;
			`,
			menu: css`
				border: none !important;

				.${prefixCls}-menu-item-selected {
					background-color: ${token.magicColorUsages.fill[0]};
				}

				li {
					width: 100% !important;
					margin-left: 0 !important;
					margin-right: 0 !important;
				}
			`,
			menuItem: css`
				color: #000;
			`,
		}
	},
)
