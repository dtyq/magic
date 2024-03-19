import { createStyles } from "antd-style"
import bg from "./bg.png"

export const useUserDetailStyles = createStyles(({ css, token, prefixCls }) => ({
	container: css`
		height: 100%;
		background: url(${bg}) no-repeat;
		background-size: 100% auto;
		background-color: ${token.magicColorScales.grey[0]};
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	`,
	mask: css`
		width: 100%;
		height: 210px;
		background: linear-gradient(
			to bottom,
			transparent 0%,
			transparent 10%,
			rgba(249, 249, 249, 1) 100%
		);
	`,
	navBar: css`
		background-color: transparent;
		position: fixed;
		top: ${token.safeAreaInsetTop};
		left: 0;
		right: 0;
		z-index: 10;
	`,
	memberCard: css`
		max-height: unset;
		border-radius: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		box-shadow: none;
		background: none;
		z-index: 0;
		flex: 1;

		&& {
			animation: none;
		}
	`,
	header: css`
		margin-top: calc(80px + ${token.safeAreaInsetTop});
		margin-left: 12px;
		margin-right: 12px;
		padding: 10px 12px;
	`,
	headerTop: css`
		padding: 0;
	`,
	avatar: css`
		width: 90px;
		height: 90px;
		border: 3px solid ${token.magicColorUsages.white};
		border-radius: 20px;
	`,
	username: css`
		font-size: 16px;
		font-weight: 600;
	`,
	organization: css`
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	descriptions: css`
		margin: 0 12px;
		height: fit-content;
	`,
	segmented: css`
		&.${prefixCls}-segmented {
			padding: 0 12px;
			--${prefixCls}-segmented-track-bg: transparent;
		}
	`,
	button: css`
		border: none;
		background-color: ${token.magicColorUsages.fill[0]};
		color: ${token.magicColorUsages.text[1]};
		&:hover {
			background-color: ${token.magicColorUsages.fill[1]};
			color: ${token.magicColorUsages.text[1]};
		}
	`,
	buttons: css`
		background-color: ${token.magicColorUsages.white};
		padding: 12px;
		border-top: 1px solid ${token.magicColorUsages.border};
	`,
}))
