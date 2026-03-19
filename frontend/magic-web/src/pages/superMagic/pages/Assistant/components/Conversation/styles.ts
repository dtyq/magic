import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	wrapper: css`
		height: 100%;

		> div {
			border-right: 1px solid ${token.colorBorder};

			&:last-child {
				border-right: none;
			}
		}
	`,
	container: css`
		flex: 1;
		height: 100%;
		padding: 0 55px;
		position: relative;
	`,
	header: css`
		height: 50px;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
	`,
	chatList: css`
		height: 100%;
		padding-top: 50px;
		padding-bottom: 162px;
		max-width: 768px;
		margin: 0 auto;
	`,
	messageEditor: css`
		height: fit-content;
		min-height: 142px;
		max-height: 200px;
		margin: 0 55px 20px 55px;
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
	`,
	messageEditorContainer: css`
		max-width: 768px;
		border-radius: 12px;
		background: ${token.magicColorUsages.bg[1]};
		box-shadow:
			0px 0px 30px 0px rgba(0, 0, 0, 0.06),
			0px 0px 1px 0px rgba(0, 0, 0, 0.3);
		border: 1px solid ${token.magicColorUsages.border};
		padding: 10px;
		margin: 0 auto;
	`,
}))
