import { createStyles } from "antd-style"

export const useVectorKnowledgeDocumentStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		title: css`
			font-size: 16px;
			font-weight: 600;
		`,
		subTitle: css`
			margin: 6px 0 10px;
			font-size: 14px;
			color: rgba(28, 29, 35, 0.6);
		`,
		searchBar: css`
			width: 20%;
			min-width: 200px;
		`,
		batchOperation: css`
			padding: 0 12px;
			cursor: pointer;
			color: ${token.colorTextSecondary};
			border: 1px solid rgba(28, 29, 35, 0.08);
			border-radius: 6px;
		`,
		deleteText: css`
			min-width: 80px;
			color: #ff4d3a;
		`,
		tableContainer: css`
			margin-top: 12px;
			flex: 1;
			overflow: hidden;

			.${prefixCls}-table-container {
				border-bottom: 1px solid ${token.colorBorder};
			}

			.${prefixCls}-table-thead .${prefixCls}-table-cell {
				background-color: #f9f9f9;
				font-weight: 500;
			}

			.${prefixCls}-tag {
				font-weight: 500;
			}
		`,
		segmentMode: css`
			width: fit-content;
			padding: 2px 8px;
			font-size: 12px;
			color: rgba(28, 29, 35, 0.8);
			border-radius: 4px;
			border: 1px solid #e6e7ea;
		`,
		fileTypeIcon: css`
			margin-right: 8px;
			vertical-align: middle;
		`,
		statusTag: css`
			border-radius: 4px;
		`,
		operation: css`
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		actionButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 30px;
			height: 30px;
			cursor: pointer;
			border-radius: 4px;

			&:hover {
				background: rgba(46, 47, 56, 0.05);
			}
		`,
		operationButton: css`
			width: 30px;
			height: 30px;
			cursor: pointer;
			border-radius: 4px;

			&:hover {
				background: rgba(46, 47, 56, 0.05);
			}
		`,
	}
})
