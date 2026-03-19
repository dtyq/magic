import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => {
	return {
		popContent: css`
			width: 400px;

			.magic-form-item {
				margin-bottom: 10px;
				background-color: #2e2f380d;
				border-radius: 12px;
				padding: 12px;
			}
		`,

		avatar: css`
			border-radius: 8px;
			width: 30px;
			height: 30px;
			margin-right: 8px;
		`,

		titleWrap: css`
			flex: 1;
		`,
		title: css`
			width: 250px;
			overflow: hidden;
			text-overflow: ellipsis;
			text-wrap: nowrap;
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px; /* 137.5% */
		`,
		toolDesc: css`
			color: rgba(28, 29, 35, 0.35);
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
			margin: 10px 0;
		`,
		header: css`
			display: flex;
			align-items: center;
			margin-bottom: 10px;
		`,
	}
})
