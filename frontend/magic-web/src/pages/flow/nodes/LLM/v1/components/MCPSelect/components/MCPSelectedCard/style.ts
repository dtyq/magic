import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	toolsSelectedCard: css`
		border-radius: 8px;
		background-color: #fff;
		padding: 6px 12px;
		position: relative;
		// &:hover {
		//     background-color: #2E2F380D;

		// }
	`,

	avatar: css`
		border-radius: 8px;
		width: 32px;
		height: 32px;
		margin-right: 10px;
	`,

	title: css`
		height: 20px;
		width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
		text-wrap: nowrap;
		font-size: 16px;
		font-style: normal;
		font-weight: 600;
		line-height: 22px; /* 137.5% */
		overflow: hidden;
		text-wrap: nowrap;
		width: 380px;
		text-overflow: ellipsis;
	`,

	desc: css`
		height: 16px;
		color: rgba(28, 29, 35, 0.35);
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px; /* 133.333% */
		overflow: hidden;
		text-wrap: nowrap;
		width: 380px;
		text-overflow: ellipsis;
	`,

	danger: css`
		color: #ff1809 !important;
		font-weight: 400;
	`,

	deleteBtn: css`
		padding: 6px;
		border-radius: 8px;
		color: #1c1d2399;
		cursor: pointer;
		&:hover {
			background-color: #2e2f380d;
		}
	`,

	settingBtnWrap: css`
		padding: 6px;
		width: 36px;
		height: 32px;
		border-radius: 8px;
		cursor: pointer;
		&:hover {
			background-color: #2e2f380d;
		}
	`,
}))
