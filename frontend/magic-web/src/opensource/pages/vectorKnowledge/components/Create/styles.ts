import { createStyles } from "antd-style"

export const useVectorKnowledgeCreateStyles = createStyles(
	({ css, token, isDarkMode, prefixCls }) => {
		return {
			wrapper: css`
				height: 100%;
			`,
			container: css`
				height: 100%;
				overflow: hidden;
			`,
			content: css`
				flex: 1;
				width: 100%;
				padding: 24px 25%;
				overflow-y: auto;
			`,
			header: css`
				padding: 13px 20px;
				border-bottom: 1px solid ${token.colorBorder};
				font-size: 18px;
				font-weight: 600;
				color: ${isDarkMode
					? token.magicColorScales.grey[9]
					: token.magicColorUsages.text[1]};
				background: ${isDarkMode ? "transparent" : token.magicColorUsages.white};
				height: 50px;
			`,
			arrow: css`
				border-radius: 4px;
				cursor: pointer;
				&:hover {
					background: ${isDarkMode
						? token.magicColorScales.grey[6]
						: token.magicColorScales.grey[0]};
				}
			`,
			title: css`
				font-size: 18px;
				font-weight: 600;
				padding-bottom: 10px;
				margin-bottom: 20px;
				border-bottom: 1px solid
					${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.border};
			`,
			label: css`
				font-weight: 600;
			`,
			required: css`
				&::after {
					content: "*";
					padding-left: 5px;
					color: red;
				}
			`,
			uploadIcon: css`
				color: rgba(28, 29, 35);
				margin-bottom: 5px;
			`,
			uploadText: css`
				font-size: 16px;
				color: ${token.colorTextSecondary};
				font-weight: 700;
				margin-bottom: 8px;
			`,
			uploadDescription: css`
				color: ${token.colorTextSecondary};
				font-size: 12px;
			`,
			fileList: css`
				margin-top: 16px;
			`,
			fileItem: css`
				margin-top: 10px;
				padding: 12px;
				border: 1px solid rgba(28, 29, 35, 0.08);
				border-radius: 6px;
			`,
			uploadRetry: css`
				font-size: 14px;
				color: #ff4d3a;
			`,
			uploadRetryText: css`
				color: #315cec;
				cursor: pointer;
			`,
			footer: css`
				width: 100%;
				padding: 24px 25%;
			`,
			backButton: css`
				padding: 0 24px;
				background: none;
				color: rgba(28, 29, 35, 0.6);
			`,
			dataSourceWrapper: css`
				display: flex;
				gap: 12px;
			`,
			dataSourceItem: css`
				flex: 1;
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 10px;
				font-weight: 600;
				border: 1px solid ${token.colorBorder};
				border-radius: 8px;
				cursor: pointer;
				&:hover {
					border-color: ${token.colorPrimary};
				}
			`,
			dataSourceItemActive: css`
				border-color: ${token.colorPrimary};
				box-shadow: 0px 4px 14px 0px rgba(0, 0, 0, 0.1);
			`,
			dataSourceItemIcon: css`
				width: 40px;
				height: 40px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 8px;
			`,
			orangeIcon: css`
				background: #fff8eb;
			`,
			blueIcon: css`
				background: #eef3fd;
			`,
			enterpriseKnowledgedesc: css`
				font-size: 12px;
				color: rgba(28, 29, 35, 0.35);
			`,
			enterpriseContainer: css`
				margin-top: 10px;
				min-height: 400px;
				display: flex;
				border: 1px solid rgba(28, 29, 35, 0.08);
				border-radius: 8px;
			`,
			enterpriseLeft: css`
				width: 50%;
				border-right: 1px solid rgba(28, 29, 35, 0.08);
			`,
			enterpriseLeftHeader: {
				background: "#f5f5f5",
				padding: "10px",

				[`& .${prefixCls}-input-prefix`]: {
					color: "rgba(28, 29, 35, 0.35)",
				},
			},
			enterpriseRight: css`
				width: 50%;
				padding: 10px;
				display: flex;
				flex-direction: column;
			`,
			enterpriseRightHeader: css`
				color: rgba(28, 29, 35, 0.8);
				font-size: 12px;
			`,
			enterpriseLeftContent: css`
				padding: 10px;
			`,
			enterpriseLeftLoading: css`
				width: 100%;
				height: 200px;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 10px;
			`,
			enterpriseLeftLoadingText: css`
				color: rgba(28, 29, 35, 0.6);
				font-size: 12px;
			`,
			enterpriseLeftFile: css`
				width: 100%;
				display: flex;
				align-items: center;
				gap: 10px;
				padding: 8px;
				border-radius: 8px;
				box-sizing: border-box;

				&:hover {
					background: rgba(46, 47, 56, 0.05);
				}
			`,
			enterpriseLeftFileContent: css`
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
				min-width: 0;
				width: calc(100% - 26px);
			`,
			enterpriseLeftFileContentSelected: css`
				cursor: not-allowed;
			`,
			enterpriseLeftFileTitleWrapper: css`
				flex: 1;
				min-width: 0;
				display: flex;
				align-items: center;
				gap: 6px;
			`,
			enterpriseFileIcon: css`
				width: 24px;
				height: 24px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 4px;
				background-color: rgba(46, 47, 56, 0.05);
				flex-shrink: 0;
			`,
			enterpriseFileTitle: css`
				font-size: 14px;
				color: #1c1d23;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				min-width: 0;
			`,
			enterpriseLeftFileInfo: css`
				width: fit-content;
				flex-shrink: 0;
				display: flex;
				align-items: center;
				gap: 6px;
			`,
			enterpriseLeftFileAvatar: css`
				border-radius: 50% !important;
			`,
			enterpriseLeftFileCreatorName: css`
				max-width: 60px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				font-size: 12px;
				color: rgba(28, 29, 35, 0.6);
			`,
			enterpriseRightContent: css`
				flex: 1;
			`,
			enterpriseRightFile: css`
				margin-top: 10px;
				padding: 6px 8px;
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 10px;
				border-radius: 8px;
				border: 1px solid rgba(28, 29, 35, 0.08);
			`,
			enterpriseRightFileTrash: css`
				width: 30px;
				height: 30px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 4px;
				cursor: pointer;
				color: rgba(28, 29, 35, 0.6);
				&:hover {
					background: rgba(28, 29, 35, 0.08);
				}
			`,
			enterpriseEmpty: css`
				flex: 1;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				color: rgba(28, 29, 35, 0.35);
				font-size: 14px;
			`,
		}
	},
)
