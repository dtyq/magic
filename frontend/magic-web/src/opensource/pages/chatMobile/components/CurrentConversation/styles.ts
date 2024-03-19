import { createStyles } from "antd-style"

export const useCurrentConversationStyles = createStyles(({ css, token }, offset: number) => ({
	container: css`
		width: 100%;
		height: 100%;
		background-color: ${token.magicColorScales.grey[0]};
		position: absolute;
		bottom: unset;
	`,
	safeArea: css`
		background-color: ${token.magicColorScales.white};
	`,
	fold: css`
		position: fixed;
		bottom: 0;
		height: calc(100% - ${offset}px);
	`,
	headerTitle: css`
		color: ${token.magicColorUsages.text[0]};
		font-size: ${token.magicFontUsages.response.text14px};
		font-style: normal;
		font-weight: 600;
		line-height: 20px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	headerSubTitle: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: ${token.magicFontUsages.response.text12px};
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	content: css`
		height: 100%;
		overflow: hidden;
	`,
	title: css`
		margin-bottom: ${token.margin}px;
		font-size: ${token.magicFontUsages.response.text16px};
		font-weight: ${token.fontWeightStrong};
		color: ${token.colorText};
	`,
	messageText: css`
		color: ${token.colorTextSecondary};
		font-size: ${token.magicFontUsages.response.text14px};
	`,
}))
