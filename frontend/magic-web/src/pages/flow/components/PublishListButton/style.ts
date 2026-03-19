import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		copyButton: css`
			width: 44px !important;
			padding: 8px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.white};
			&:hover {
				background-color: ${token.magicColorUsages.white} !important;
			}
		`,
		drawer: css`
			.ant-drawer-wrapper-body {
				background-color: #f9f9f9;
			}
			.ant-drawer-body {
				padding-top: 10px;
			}
		`,
		createDate: css`
			font-size: 14px;
			font-weight: 700;
			line-height: 20px;
			text-align: left;
			color: #1c1d23cc;
			margin-bottom: 10px;
		`,
		isEmptyDrawer: css`
			.ant-drawer-body {
				display: flex;
				align-items: center;
				justify-content: center;
			}
		`,
		emptyBlock: css`
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		`,
		label: css`
			font-size: 16px;
			font-weight: 600;
			line-height: 22px;
			text-align: left;
			color: #1c1d23cc;
		`,
		desc: css`
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			text-align: left;
			color: #1c1d2359;
		`,
		topTitle: css`
			font-size: 18px;
			font-weight: 600;
			line-height: 24px;
			text-align: left;
			color: #1c1d23cc;
			margin-bottom: 8px;
		`,
		topDesc: css`
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			text-align: left;
			color: #1c1d2359;
		`,
		publishTimeline: css`
			margin-top: 10px;

			.ant-timeline-item {
				padding-bottom: 6px;
			}

			.ant-timeline-item-content {
				width: calc(100% - 21px) !important;
				left: 0 !important;
			}
		`,
	}
})
