import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	tabBar: css`
		border-top: 1px solid ${token.colorBorder};
		background-color: ${token.magicColorUsages.bg[0]};
		height: calc(56px + ${token.safeAreaInsetBottom});
		padding-bottom: ${token.safeAreaInsetBottom};
		width: 100%;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 999;

		.adm-tab-bar-item {
			color: ${token.magicColorUsages.text[1]};

			&.adm-tab-bar-item-active {
				color: ${token.colorPrimary};
			}
		}

		.adm-tab-bar-item-icon {
			font-size: 24px;
		}

		.adm-tab-bar-item-title {
			font-size: 12px;
			margin-top: 4px;
		}
	`,
}))
