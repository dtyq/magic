import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	container: css`
		height: 100%;

		> div {
			border-right: 1px solid ${token.colorBorder};

			&:last-child {
				border-right: none;
			}
		}
	`,
	previewPanel: css`
		height: 100%;
	`,
	splitter: css`
		height: 100%;

		.magic-splitter-panel {
			border-right: 1px solid ${token.colorBorder};

			&:last-child {
				border-right: none;
			}
		}
	`,
	mainSplitterPanel: css`
		flex-grow: 1 !important;
	`,
}))
