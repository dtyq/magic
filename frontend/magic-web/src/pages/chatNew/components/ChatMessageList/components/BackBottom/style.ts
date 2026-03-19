import { createStyles } from "antd-style"
import { darken } from "polished"

export const useStyles = createStyles(({ token, css, cx, responsive }) => ({
	container: cx(css`
		pointer-events: none;

		position: absolute;
		z-index: 1000;
		right: 16px;
		bottom: 16px;
		transform: translateY(16px);

		padding-inline: 12px !important;

		opacity: 0;
		background: ${token.colorBgContainer};

		--magic-button-default-hover-bg: ${darken(0.05)(token.colorBgContainer)} !important;

		border-color: ${token.colorFillTertiary} !important;
		border-radius: 16px !important;

		${responsive.mobile} {
			right: 0;
			border-right: none;
			border-top-right-radius: 0 !important;
			border-bottom-right-radius: 0 !important;
		}
	`),
	visible: css`
		pointer-events: all;
		transform: translateY(0);
		opacity: 1;
	`,
}))
