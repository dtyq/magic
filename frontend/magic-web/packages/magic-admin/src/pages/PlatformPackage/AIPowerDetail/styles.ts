import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css, token, isDarkMode, prefixCls }, { isMobile }: { isMobile: boolean }) => {
		return {
			container: css`
				min-width: ${isMobile ? "100%" : "400px"};
				width: 100%;
				height: 100%;
				max-width: ${isMobile ? "100%" : "920px"};
				margin: 0 auto;
				padding: ${isMobile ? "0" : "30px 10px 10px"};
			`,
			cardContainer: css`
				height: 100%;
				display: flex;
				flex-direction: column;
				gap: 20px;
				padding: 20px;
				border-radius: 8px;
				border: 1px solid ${token.magicColorUsages.border};
				background: linear-gradient(
					to bottom,
					${isDarkMode
							? token.magicColorUsages.warningLight.default
							: token.magicColorUsages.primaryLight.default}
						6%,
					${isDarkMode ? token.magicColorUsages.fill[0] : token.magicColorUsages.white}
						26%
				);
			`,
			card: css`
				padding: 0 !important;
				border: none !important;
				background-color: transparent !important;
			`,
			status: css`
				font-size: 12px;
				font-weight: 400;
				color: ${token.magicColorUsages.text[2]};
			`,
			ellipsis: css`
				line-clamp: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				display: -webkit-box;
				-webkit-line-clamp: 1;
				-webkit-box-orient: vertical;
				word-break: break-all;
			`,
			divider: css`
				margin: 0;
			`,
			label: css`
				flex-shrink: 0;
				width: ${isMobile ? "100%" : "36%"};
			`,
			labelText: css`
				font-size: 14px;
				font-weight: 400;
				color: ${token.magicColorUsages.text[1]};
			`,
			labelDesc: css`
				font-size: 12px;
				color: ${token.magicColorUsages.text[3]};
			`,
			formItem: css`
				width: 100%;
				min-height: 32px;
				margin-bottom: 0;
			`,
			required: css`
				&::after {
					content: "*";
					margin-left: 4px;
					color: ${token.colorError};
				}
			`,
			subHeader: css`
				height: 22px;
			`,
			checkServiceDocs: css`
				display: flex;
				align-items: center;
				align-self: flex-end;
				gap: 4px;
				font-size: 12px;
				color: ${token.magicColorUsages.primary.default};
				cursor: pointer;
			`,
			buttonGroup: css`
				margin-top: auto;
			`,
			modelItem: css`
				font-size: 14px;
				border: none;
				background: transparent;
				height: 30px;
				padding: 0;
			`,
			modelList: css`
				max-height: 300px;
				overflow-y: auto;
			`,
			searchSelect: css`
				.${prefixCls}-select-item {
					padding: 0 10px;
					height: 30px;
					margin-bottom: 4px;
					&:last-child {
						margin-bottom: 0;
					}
				}
			`,
		}
	},
)
