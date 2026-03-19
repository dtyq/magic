import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => {
	return {
		draftCardItem: css`
			background-color: #fff;
			padding: 12px;
			box-shadow:
				0px 0px 1px 0px #0000004d,
				0px 4px 14px 0px #0000001a;
			border-radius: 8px;
			margin-bottom: 10px;

			&:hover {
				background-color: #2e2f380d;
				cursor: pointer;
			}
		`,
		active: css`
			background-color: rgba(50, 196, 54, 0.1);
		`,
		header: css`
			margin-bottom: 4px;
		`,
		draftName: css`
			display: inline-block;
			max-width: 200px;
			overflow: hidden;
			text-overflow: ellipsis;
			text-wrap: nowrap;
		`,
		draftDesc: css`
			display: -webkit-box;
			line-clamp: 2;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
			text-overflow: ellipsis;
			margin-bottom: 8px;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			text-align: left;
			color: #1c1d2359;
		`,
		iconWrap: css`
			padding: 2px 10px;
			border: 1px solid #1c1d2314;
			border-radius: 6px;
			cursor: pointer;
			display: flex;
			align-items: center;

			&:hover {
				background-color: #2e2f380d;
				cursor: pointer;
			}

			.tabler-icon {
				color: #1c1d2399;
			}
		`,
		avatarIcon: css`
			width: 19px;
			height: 19px;
			border-radius: 50%;
		`,
		name: css`
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			text-align: left;
		`,
	}
})
