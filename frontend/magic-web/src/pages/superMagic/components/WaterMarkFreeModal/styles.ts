import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	agreementContent: css`
		overflow-y: auto;
		max-height: 500px;
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 12px;
		color: ${token.magicColorUsages.text[0]};
	`,
	editorBody: css`
		.simple-editor-wrapper {
			background-color: ${token.magicColorScales.grey[0]};
			overflow: unset;
		}
		.simple-editor-content .tiptap.ProseMirror.simple-editor {
			padding: 20px;
		}
		.tiptap.ProseMirror {
			color: ${token.magicColorUsages.text[0]};
			h1:first-child {
				padding: 0;
				font-size: 30px;
			}
			h2 {
				font-size: 22px;
				font-weight: 600;
				padding: 0;
				margin: 10px 0;
			}
			h3 {
				font-size: 18px;
				font-weight: 500;
				padding: 0;
				margin: 10px 0;
			}
			p {
				margin-bottom: 10px;
				font-size: 14px;
			}
		}
	`,
	cancelButton: css`
		background-color: ${token.magicColorUsages.bg[0]};
		color: ${token.magicColorUsages.text[2]};
		border: 1px solid ${token.magicColorUsages.border};
	`,
	okButton: css`
		&:disabled {
			background-color: ${token.magicColorUsages.disabled.bg};
			color: ${token.magicColorUsages.disabled.text};
			border: 1px solid ${token.magicColorUsages.disabled.border};
		}
	`,
}))
