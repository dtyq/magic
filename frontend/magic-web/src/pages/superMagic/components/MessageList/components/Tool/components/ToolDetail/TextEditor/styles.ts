import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, isDarkMode }) => ({
	container: css`
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		background: ${token.colorBgContainer};
		overflow: hidden;
	`,

	header: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: ${token.colorFillQuaternary};
		border-bottom: 1px solid ${token.colorBorder};
	`,

	fileName: css`
		font-size: 12px;
		color: ${token.colorTextSecondary};
		font-family: ${token.fontFamilyCode};
		font-weight: 500;
	`,

	actions: css`
		display: flex;
		gap: 4px;
	`,

	actionButton: css`
		color: ${token.colorTextTertiary};

		&:hover {
			color: ${token.colorText};
			background: ${token.colorFillSecondary};
		}
	`,

	editorBody: css`
		flex: 1;
		overflow: hidden auto;
		padding: 10px 20px;

		.simple-editor-content .tiptap.ProseMirror.simple-editor {
			padding: 0;
		}

		&::-webkit-scrollbar {
			width: 6px;
		}

		&::-webkit-scrollbar-thumb {
			background-color: ${isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)"};
			border-radius: 3px;
		}

		&::-webkit-scrollbar-track {
			background-color: transparent;
		}
	`,

	content: css`
		position: relative;
	`,

	commonHeader: {
		position: "relative",
		height: "40px",
		flex: "none",
		borderBottom: `1px solid ${token.colorBorderSecondary}`,
		backgroundColor: "white",
		padding: "10px",
		fontSize: 14,
		gap: 4,
		fontWeight: 400,
		lineHeight: "20px",
		color: token.colorTextSecondary,
		width: "100%",
	},
	titleContainer: {
		flex: 1,
		maxWidth: "100%",
	},
	icon: {
		flex: "none",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		textOverflow: "ellipsis",
		overflow: "hidden",
		whiteSpace: "nowrap",
	},
}))
