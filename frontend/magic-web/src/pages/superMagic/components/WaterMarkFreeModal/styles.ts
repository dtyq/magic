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
	/** Mobile sheet: stack scrollable agreement above fixed action buttons. */
	mobileLayout: css`
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
		height: 100%;
	`,
	agreementContentMobile: css`
		flex: 1;
		min-height: 0;
		max-height: none;
	`,
	mobileFooter: css`
		display: flex;
		flex-shrink: 0;
		justify-content: flex-end;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		padding-bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
		background: ${token.magicColorUsages.bg[0]};
	`,
	/** Match Ant Design Modal footer button sizing (same as desktop cancelButton / primary). */
	mobileFooterButton: css`
		flex: none;
		min-width: 88px;
		height: 32px;
		padding: 4px 15px;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 400;
		line-height: 22px;
		white-space: nowrap;
		cursor: pointer;
		transition: opacity 0.2s;

		&:active {
			opacity: 0.75;
		}
	`,
	mobileCancelButton: css`
		background-color: ${token.magicColorUsages.bg[0]};
		color: ${token.magicColorUsages.text[2]};
		border: 1px solid ${token.magicColorUsages.border};
	`,
	mobileOkButton: css`
		background-color: ${token.colorText};
		color: ${token.colorBgContainer};
		border: none;

		&:disabled {
			cursor: not-allowed;
			background-color: ${token.magicColorUsages.disabled.bg};
			color: ${token.magicColorUsages.disabled.text};
			border: 1px solid ${token.magicColorUsages.disabled.border};
			opacity: 1;
		}
	`,
}))
