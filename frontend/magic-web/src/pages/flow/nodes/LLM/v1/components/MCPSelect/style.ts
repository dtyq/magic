import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	toolsSelect: css`
		margin: 0 12px !important;
		margin-bottom: 12px !important;
	`,
	toolsWrap: css`
		background-color: #f9f9f9;
		padding: 10px;
		border-radius: 8px;
	`,
	addToolBtn: css`
		width: 100%;
		text-align: center;
		color: #315cec;
		height: 32px;
		cursor: pointer;

		&:hover {
			background-color: #2e2f380d;
		}
	`,
}))
