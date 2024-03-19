import { createStyles } from "antd-style"

export const useVectorKnowledgeRecallTestStyles = createStyles(({ css, token, prefixCls }) => ({
	container: css`
		height: 100%;
	`,
	leftPanel: css`
		flex: 1;
		display: flex;
		flex-direction: column;
	`,
	title: css`
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 4px;
	`,
	description: css`
		font-size: 12px;
		color: rgba(28, 29, 35, 0.6);
		margin-bottom: 10px;
	`,
	inputSection: css`
		margin-bottom: 16px;
		border-radius: 8px;
		border: 1px solid rgba(28, 29, 35, 0.08);
		box-shadow: 0px 4px 14px 0px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	`,
	sectionTitle: css`
		font-size: 14px;
		font-weight: 500;
		background: #f9f9f9;
		padding: 8px 12px;
	`,
	textArea: css`
		border: none;
		border-radius: 0;
	`,
	testButtonContainer: css`
		padding: 12px;
	`,
	testButton: css`
		padding: 0 24px;
	`,
	recentTitle: css`
		font-size: 16px;
		font-weight: 600;
		margin-top: 12px;
		margin-bottom: 8px;
	`,
	recordTable: css`
		.${prefixCls}-table-cell {
			font-size: 12px;
		}
		.${prefixCls}-table-thead .${prefixCls}-table-cell {
			color: rgba(28, 29, 35, 0.6);
			background-color: rgba(46, 47, 56, 0.05);
			font-size: 12px;
			font-weight: 400;
		}
	`,
	rightPanel: css`
		flex: 1;
		height: 100%;
		border-radius: 8px;
		border: 1px solid rgba(28, 29, 35, 0.08);
	`,
	resultsHeader: css`
		padding: 10px 20px;
		font-size: 14px;
		font-weight: 500;
		color: rgba(28, 29, 35, 0.8);
		background-color: #f9f9f9;
		border-bottom: 1px solid rgba(28, 29, 35, 0.08);
	`,
	resultsContent: css`
		flex: 1;
		padding: 20px;
		background-color: rgba(46, 47, 56, 0.05);
		overflow-y: auto;
	`,
	item: css`
		padding: 10px;
		margin-bottom: 20px;
		border-radius: 8px;
		background-color: #fff;
	`,
	itemHeader: css`
		width: fit-content;
		color: #315cec;
		font-size: 12px;
		font-weight: 600;
		background: #eef3fd;
		padding: 4px 8px;
		border-radius: 4px;
	`,
	itemContent: css`
		font-size: 14px;
		padding: 8px 0;
		color: rgba(28, 29, 35, 0.8);
		border-bottom: 1px solid rgba(28, 29, 35, 0.08);
	`,
	itemFileInfo: css`
		padding-top: 6px;
		color: #1c1d23;
		font-size: 14px;
	`,
	resultsLoading: css`
		width: 100%;
		height: 100%;
	`,
	resultsLoadingText: css`
		margin-top: 20px;
		color: rgba(28, 29, 35, 0.6);
	`,
	empty: css`
		width: 100%;
		height: 100%;
	`,
}))
