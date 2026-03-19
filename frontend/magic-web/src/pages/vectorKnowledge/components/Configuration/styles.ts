import { createStyles } from "antd-style"

export const useVectorKnowledgeConfigurationStyles = createStyles(
	({ css, token, isDarkMode, prefixCls }) => {
		return {
			wrapper: css`
				width: 100%;
				height: 100%;
				overflow: hidden;
			`,
			leftWrapper: css`
				width: 50%;
				height: 100%;
				border-right: 1px solid rgba(28, 29, 35, 0.08);
				overflow: hidden;
			`,
			container: css`
				flex: 1;
				padding: 20px 20px 0;
				overflow-y: auto;
			`,
			title: css`
				font-size: 18px;
				font-weight: 600;
				padding-bottom: 10px;
				margin-bottom: 20px;
				border-bottom: 1px solid rgba(28, 29, 35, 0.08);
			`,
			oldVersionTip: css`
				font-size: 12px;
				color: rgba(28, 29, 35, 0.35);
			`,
			content: css`
				margin-bottom: 30px;
			`,
			formItem: css`
				margin-bottom: 0;
				flex: 1;
			`,
			configSection: css`
				margin-bottom: 20px;
			`,
			configTitle: css`
				font-size: 16px;
				font-weight: 600;
				margin-bottom: 10px;
			`,
			configDesc: css`
				font-size: 12px;
				color: rgba(28, 29, 35, 0.35);
				margin-bottom: 10px;
			`,
			patternSection: css`
				margin-bottom: 14px;
				border: 1px solid rgba(28, 29, 35, 0.08);
				border-radius: 8px;

				.sectionHeader {
					padding: 10px;
					border-radius: 8px 8px 0 0;
				}
			`,
			activeSection: css`
				border: 1px solid #315cec;
				box-shadow: 0px 4px 14px 0px #0000001a;

				.sectionHeader {
					background: #f9f9f9;
				}
			`,
			patternIcon: css`
				width: 40px;
				height: 40px;
				border-radius: 8px;
				background: rgba(46, 47, 56, 0.05);
			`,
			blueIcon: css`
				background: #eef3fd;
				color: #315cec;
			`,
			yellowIcon: css`
				background: #fff8eb;
				color: #ff7d00;
			`,
			greenIcon: css`
				background: #ecf9ec;
				color: #32c436;
			`,
			divider: css`
				margin: 10px 0;
			`,
			patternTitle: css`
				font-size: 14px;
				font-weight: 600;
			`,
			patternDesc: css`
				font-size: 12px;
				color: rgba(28, 29, 35, 0.35);
			`,
			patternSectionContent: css`
				padding: 10px;
			`,
			resetButton: css`
				width: fit-content;
				padding: 6px 24px;
				background: none;
				color: rgba(28, 29, 35, 0.6);
			`,
			checkboxItem: css`
				display: flex;
				align-items: center;
				justify-content: center;
				width: 24px;
				height: 24px;
				color: rgba(28, 29, 35, 0.35);
				cursor: pointer;
			`,
			checked: css`
				color: #315cec;
				border: none;
			`,
			subSection: css`
				padding: 10px;
				border: 1px solid rgba(28, 29, 35, 0.08);
				border-radius: 8px;
			`,
			subSectionTitle: css`
				font-size: 14px;
				font-weight: 600;
				margin-bottom: 10px;
			`,
			subSectionContent: css`
				margin-top: 10px;
				padding-left: calc(40px + 8px);
			`,
			iconHelp: css`
				width: 16px;
				height: 16px;
				color: rgba(28, 29, 35, 0.6);
			`,
			footer: css`
				padding: 20px;
			`,
			backButton: css`
				padding: 0 24px;
				background: none;
				color: rgba(28, 29, 35, 0.6);
			`,
			optionProvider: css`
				visibility: hidden;
			`,
			selectPopup: {
				[".optionProvider"]: {
					visibility: "visible",
					padding: "2px 8px",
					fontSize: "12px",
					color: "rgba(28, 29, 35, 0.35)",
					borderRadius: "4px",
					border: "1px solid rgba(28, 29, 35, 0.08)",
				},
			},

			rightWrapper: css`
				width: 50%;
				height: 100%;
				overflow: hidden;
			`,
			previewHeader: css`
				padding: 10px 20px;
				color: rgba(28, 29, 35, 0.6);
				background: #f9f9f9;
			`,
			documentSelect: {
				minWidth: "200px",

				[`.${prefixCls}-select-selector`]: {
					background: "rgba(46, 47, 56, 0.05) !important",
					border: "none !important",
				},

				[`.${prefixCls}-select-selection-item`]: {
					fontSize: "12px",
					fontWeight: "600",
					color: "#1C1D23",
				},

				[`.${prefixCls}-select-arrow`]: {
					color: "#1C1D23 !important",
				},
			},
			estimatedSegments: css`
				font-size: 12px;
				padding: 2px 10px;
				border: 1px solid rgba(28, 29, 35, 0.08);
				border-radius: 4px;
			`,
			previewContent: css`
				flex: 1;
				padding: 20px;
				overflow-y: auto;
			`,
			previewLoading: css`
				width: 100%;
				height: 100%;
			`,
			previewLoadingText: css`
				margin-top: 20px;
				color: rgba(28, 29, 35, 0.6);
			`,
			segmentItem: css`
				margin-bottom: 20px;
			`,
			segmentItemTitle: css`
				width: fit-content;
				color: #315cec;
				font-size: 12px;
				font-weight: 600;
				background: #eef3fd;
				padding: 4px 8px;
				border-radius: 4px;
				margin-bottom: 10px;
			`,
			segmentItemContent: css`
				font-size: 14px;
			`,
			loadingMore: css`
				display: flex;
				justify-content: center;
				align-items: center;
				gap: 10px;
				padding-top: 10px;
				color: rgba(28, 29, 35, 0.6);
			`,
		}
	},
)
