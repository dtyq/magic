import { createStyles } from "antd-style"

export const useVectorKnowledgeSettingStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		settingTitle: css`
			font-size: 16px;
			font-weight: 500;
		`,
		settingContent: css`
			margin-top: 20px;
		`,
		settingLabel: css`
			flex: 1;
		`,
		settingValue: css`
			flex: 5;
		`,
		required: css`
			&::after {
				content: "*";
				padding-left: 5px;
				color: red;
			}
		`,
		icon: css`
			width: 45px;
			height: 45px;
			border-radius: 6px;
		`,
		iconUploader: css`
			height: 45px;
			padding: 0 10px;
			font-weight: 500;
			font-size: 13px;
			color: rgba(28, 29, 35, 0.6);
			background: rgba(46, 47, 56, 0.05);
			border: 1px dashed rgba(28, 29, 35, 0.08);
			border-radius: 6px;
			cursor: pointer;
		`,
		iconUploaderTip: css`
			font-size: 12px;
			color: #999;
		`,
		resetButton: css`
			padding: 0 24px;
			background: none;
			color: rgba(28, 29, 35, 0.6);
		`,
		saveButton: css`
			padding: 0 24px;
		`,
	}
})
