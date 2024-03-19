import { createStyles } from "antd-style"
import { CHAT_MOBILE_Z_INDEX } from "../../constants"

export const useStyles = createStyles(({ token, css }) => ({
	chatContent: css`
		overflow: auto;
		z-index: ${CHAT_MOBILE_Z_INDEX.CHAT_CONTENT};
		flex: 1;
	`,
	chatList: css`
		height: 100%;
		overflow: hidden;
	`,
	aiList: css`
		height: 100%;
		background-color: ${token.magicColorUsages?.white};
	`,
	emptyFallback: css`
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	`,
	emptyFallbackText: css`
		color: ${token.magicColorUsages.text[3]};
		text-align: center;
		font-size: ${token.magicFontUsages.response.text14px};
		font-weight: 400;
		line-height: 20px;
	`,
}))
