import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css, isDarkMode, token }, { isMobile }: { fontSize: number; isMobile: boolean }) => ({
		container: css`
			padding: 0 16px;
			width: 100%;
		`,
		avatar: css`
			flex-shrink: 0;
			width: 40px;
			height: 40px;
		`,
		messageWrapper: css`
			max-width: 60%;
		`,
		messageInfo: css`
			padding: 0 4px;
		`,
		name: css`
			color: ${token.magicColorUsages.text[2]};
			text-align: justify;
			font-size: ${token.magicFontUsages.response.text12px};
			font-weight: 400;
			line-height: 16px;
			user-select: none;
		`,
		time: css`
			font-size: ${token.magicFontUsages.response.text12px};
			color: ${token.colorTextQuaternary};
		`,
		content: css`
			justify-content: flex-end;
			padding-right: unset;
			padding-left: 50px;
			width: fit-content;
			max-width: ${isMobile ? "calc(100% - 30px)" : "calc(100% - 46px)"};
			box-sizing: border-box;
			user-select: none;
			line-height: normal;
			padding: 10px;
			border-radius: 12px;
			user-select: text;
			overflow-x: auto;
		`,
		referContent: css`
			color: ${token.colorTextQuaternary};
			padding-left: 4px;
			border-left: 4px solid ${token.colorBorder};
			margin-bottom: 4px;
		`,
		referUserName: css`
			color: ${token.colorTextQuaternary};
			font-size: ${token.magicFontUsages.response.text10px};
			white-space: nowrap;
			text-overflow: ellipsis;
			overflow: hidden;
		`,
		message: css`
			width: 100%;
			border-radius: 12px;
			overflow-anchor: none;
			user-select: none;
			align-items: flex-end;
		`,
		selfMessage: css`
			margin-left: 50px;
			flex-direction: row-reverse;
			width: 100%;
		`,
		otherMessage: css`
			margin-right: 50px;
			width: 100%;
		`,
		selfMessageStyle: css`
			color: ${token.magicColorUsages.text[1]};
			background: ${isDarkMode ? token.magicColorUsages.primaryLight.default : "#E6F0FF"};
			// background: linear-gradient(99deg, #4768d4 0%, #6c8eff 0.01%, #ca58ff 100%);
		`,
		otherMessageStyle: css`
			background: ${token.magicColorUsages.bg[1]};
			color: ${token.magicColorUsages.text[1]};
			${isDarkMode ? "" : `border: 1px solid ${token.colorBorder};`}
		`,
		contentWrapper: css`
			overflow-x: hidden;
			width: 100%;
		`,
		editStatus: css`
			font-size: ${token.magicFontUsages.response.text12px};
			color: ${token.colorTextQuaternary};
			cursor: default;
			user-select: none;
			margin-top: 4px;
		`,
	}),
)
