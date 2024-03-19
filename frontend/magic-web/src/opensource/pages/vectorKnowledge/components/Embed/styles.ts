import { createStyles } from "antd-style"

export const useVectorKnowledgeEmbedStyles = createStyles(({ css, token, isDarkMode }) => {
	return {
		container: css`
			height: 100%;
			max-width: 900px;
			min-width: 700px;
			margin: 0 auto;
			padding-bottom: 20px;
			overflow: hidden;
		`,
		header: css`
			padding: 40px 0 8px;
		`,
		headerTitle: css`
			font-size: 20px;
			font-weight: 600;
			margin-bottom: 18px;
		`,
		knowledgeInfo: css`
			display: flex;
			align-items: center;
			gap: 12px;
		`,
		knowledgeIcon: css`
			width: 40px;
			height: 40px;
			border-radius: 6px;
		`,
		knowledgeDetail: css``,
		knowledgeLabel: css`
			font-size: 12px;
			margin-bottom: 4px;
		`,
		knowledgeName: css`
			font-size: 14px;
			font-weight: 500;
		`,
		configSection: css`
			margin-bottom: 20px;
		`,
		configItem: css`
			display: flex;
			align-items: center;
		`,
		configLabel: css`
			flex: 1;
			min-width: 150px;
			font-size: 14px;
			color: rgba(28, 29, 35, 0.6);
			margin-bottom: 8px;
		`,
		configValue: css`
			flex: 2;
			font-size: 14px;
		`,
		fileList: css`
			flex: 1;
			overflow: hidden;
		`,
		fileListContent: css`
			height: 100%;
			padding: 0 14px;
			display: flex;
			flex-direction: column;
			background-color: rgba(46, 47, 56, 0.05);
			border-radius: 6px;
		`,
		fileListScroll: css`
			flex: 1;
			overflow-y: auto;
		`,
		statusSection: css`
			padding: 12px 0;
		`,
		statusInfo: css`
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 16px;
			font-weight: 500;
		`,
		fileItem: css`
			padding: 12px;
			background-color: #fff;
			border: 1px solid rgba(28, 29, 35, 0.08);
			border-radius: 6px;
			margin-bottom: 10px;
		`,
		fileInfo: css`
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		icon: css`
			vertical-align: middle;
		`,
		divider: css`
			margin: 8px 0 12px;
		`,
		modelProvider: css`
			padding: 0px 4px;
			font-size: 12px;
			color: rgba(28, 29, 35, 0.35);
			border-radius: 4px;
			border: 1px solid rgba(28, 29, 35, 0.08);
		`,
		empty: css`
			padding: 12px;
			text-align: center;
		`,
		loadingContainer: css`
			width: 100%;
			height: 300px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 16px;
		`,
		loadingText: css`
			margin-top: 16px;
			color: #8c8c8c;
			font-size: 14px;
		`,
		error: css`
			width: 100%;
			height: 300px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 16px;
			color: #ff4d4f;
		`,
	}
})
