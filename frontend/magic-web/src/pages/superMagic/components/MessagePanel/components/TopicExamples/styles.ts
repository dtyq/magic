import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls }) => {
	return {
		exampleContainer: css`
			width: 100%;
			padding: 8px;
			display: flex;
			flex-direction: column;
			background: #f9f9f9;
			border-radius: 10px;
			overflow: hidden;
			box-sizing: border-box;
		`,
		exampleCollapse: css`
			.${prefixCls}-collapse-header {
				display: flex;
				align-items: center !important;
				padding: 0px !important;
			}
			.${prefixCls}-collapse-expand-icon {
				padding: 0px 12px !important;
			}
			.${prefixCls}-collapse-content-box {
				padding: 8px 0px 0px 0px !important;
			}
		`,
		exampleHeader: css`
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-weight: 600;
		`,
		exampleList: css`
			width: 100%;
			display: grid;
			grid-template-columns: repeat(5, calc((100% - 32px) / 5));
			gap: 8px;
		`,
		exampleItem: css`
			padding: 16px;
			display: flex;
			flex-direction: column;
			gap: 8px;
			cursor: pointer;
			border-radius: 8px;
			border: 1px solid ${token.colorBorder};
			background: ${token.magicColorUsages.bg[0]};

			&:hover {
				background: ${token.magicColorUsages.primaryLight.default};
				border-color: ${token.magicColorUsages.primaryLight.hover};
			}
		`,
		exampleItemTitle: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[1]};
		`,
		exampleItemContent: css`
			font-size: 12px;
			line-height: 16px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[3]};
			display: -webkit-box;
			line-clamp: 2;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			text-overflow: ellipsis;
			overflow: hidden;
		`,
		exampleItemRefresh: css`
			width: 28px;
			height: 28px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 8px;
			cursor: pointer;

			&:hover {
				background: ${token.magicColorUsages.bg[1]};
			}
		`,

		summaryExampleList: css`
			width: 100%;
			display: flex;
			gap: 8px;
		`,
		summaryExampleItem: css`
			flex: 1;
			position: relative;
			padding-right: 100px;
			cursor: pointer;
			border-radius: 8px;
			border: 1px solid ${token.colorBorder};
		`,
		summaryExampleItem1: css`
			background: linear-gradient(131.86deg, #e3efff -3.54%, #ffffff 58.99%);
			border: 1px solid #dbeafe;
		`,
		summaryExampleItem2: css`
			background: linear-gradient(131.86deg, #eaecff -3.54%, #ffffff 58.99%);
			border: 1px solid #f3e8ff;
		`,
		summaryExampleItem3: css`
			background: linear-gradient(131.86deg, #fff7ed -3.54%, #ffffff 58.99%);
			border: 1px solid #ffedd5;
		`,
		summaryExampleItemContent: css`
			padding: 16px 0 16px 16px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		`,
		summaryExampleItemTitle: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			color: #0a0a0a;
		`,
		summaryExampleItemDescription: css`
			font-size: 12px;
			line-height: 16px;
			font-weight: 400;
			color: #737373;
		`,
		summaryExampleItemIcon: css`
			position: absolute;
			bottom: 0;
			right: 0;
			width: 108px;
			height: auto;
			align-self: flex-end;
		`,
	}
})
