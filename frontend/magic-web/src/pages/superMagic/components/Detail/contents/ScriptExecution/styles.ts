import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, isDarkMode }) => ({
	scriptExecutionContainer: css`
		overflow: hidden;
		height: 100%;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background-color: ${token.colorBgContainer};
		color: ${token.colorText};
	`,
	toolbar: css`
		--detail-action-font-size: 13px;
		--detail-action-line-height: 20px;
		--detail-action-height: 32px;
		--detail-action-gap: 6px;
		display: flex;
		align-items: center;
		flex-shrink: 0;
		min-height: 48px;
		padding: 8px 12px;
		border-bottom: 1px solid ${token.colorBorderSecondary};
		background-color: ${token.colorBgContainer};
		user-select: none;
		-webkit-user-select: none;
		@media (pointer: coarse) {
			--detail-action-height: 44px;
		}
	`,
	title: css`
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 14px;
		line-height: 22px;
		font-weight: 500;
		cursor: default;
	`,
	readOnly: css`
		font-size: 12px;
		font-weight: 400;
		color: ${token.colorTextSecondary};
		@media (max-width: 440px) {
			display: none;
		}
	`,
	status: css`
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: 4px;
		font-size: 13px;
		line-height: 20px;
		font-weight: 400;
		color: ${token.colorTextSecondary};
		& svg {
			color: ${token.colorSuccess};
		}
	`,
	error: css`
		color: ${token.colorError};
		& svg {
			color: ${token.colorError};
		}
	`,
	exitCode: css`
		padding-left: 6px;
		border-left: 1px solid ${token.colorBorderSecondary};
		color: ${token.colorTextSecondary};
		white-space: nowrap;
	`,
	toggleCode: css`
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: var(--detail-action-height);
		height: var(--detail-action-height);
		padding: 0 6px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: ${token.colorText};
		font-size: var(--detail-action-font-size);
		line-height: var(--detail-action-line-height);
		white-space: nowrap;
		cursor: pointer;
		&:hover {
			background-color: ${token.colorFillTertiary};
		}
		&:focus-visible {
			outline: 2px solid ${token.colorPrimary};
			outline-offset: 2px;
		}
	`,
	content: css`
		flex: 1;
		min-height: 0;
		min-width: 0;
		padding: 12px;
		overflow: hidden;
		background-color: ${token.colorBgLayout};
	`,
	panelGroup: css`
		min-height: 0;
		min-width: 0;
	`,
	section: css`
		height: 100%;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		border: 1px solid ${token.colorBorderSecondary};
		border-radius: ${token.borderRadius}px;
		overflow: hidden;
		background-color: ${token.colorBgContainer};
	`,
	sectionHeader: css`
		display: flex;
		align-items: center;
		flex-shrink: 0;
		min-height: 36px;
		padding: 0 12px;
		border-bottom: 1px solid ${token.colorBorderSecondary};
		font-size: 13px;
		font-weight: 500;
		color: ${token.colorTextSecondary};
	`,
	resizeHandle: css`
		/* 命中区保留足够高度；把手只占分隔线，不再增加一层内容卡片。 */
		&[data-panel-group-direction="vertical"] {
			height: 12px;
			min-height: 12px;
			flex-shrink: 0;
			background: transparent;
		}
	`,
	codeBody: css`
		flex: 1;
		min-height: 0;
		overflow: hidden;
		& .monaco-editor,
		& .monaco-editor-background,
		& .margin {
			background-color: ${isDarkMode ? "#1C2027" : "#F7F8FA"} !important;
		}
	`,
	loading: css`
		display: flex;
		height: 100%;
		align-items: center;
		justify-content: center;
	`,
}))
