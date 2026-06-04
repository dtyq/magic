import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ token, css }, { safeAreaInsetTop }: { safeAreaInsetTop?: number | string }) => {
		return {
			// 移动端样式
			mobileLayout: css`
				display: flex;
				flex-direction: column;
				width: 100%;
				height: 100%;
				background-color: ${token.magicColorScales.grey[0]};
			`,
			mobileHeader: css`
				display: flex;
				align-items: center;
				justify-content: space-between;
				height: 48px;
				padding: 0 12px;
				background-color: ${token.magicColorUsages.bg[0]};
				border-bottom: 1px solid ${token.colorBorder};
				flex-shrink: 0;
			`,
			mobileHeaderButton: css`
				min-width: 40px;
				padding: 8px;
				color: ${token.magicColorUsages.text[0]};
				-webkit-tap-highlight-color: transparent;

				&:active {
					opacity: 0.7;
				}
			`,
			mobileHeaderTitle: css`
				font-size: 16px;
				font-weight: 600;
				color: ${token.magicColorUsages.text[0]};
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			`,
			mobileContent: css`
				flex: 1;
				overflow-y: auto;
				overflow-x: hidden;
				-webkit-overflow-scrolling: touch;
				padding: 10px;
			`,
			mobileContentPadding: css`
				padding: 12px;
			`,
			// 移动端菜单抽屉
			mobileMenuDrawer: css`
				height: 100%;
				display: flex;
				flex-direction: column;
				background-color: ${token.magicColorUsages.bg[0]};
			`,
			mobileMenuHeader: css`
				display: flex;
				align-items: center;
				justify-content: space-between;
				height: 56px;
				padding: 0 16px;
				border-bottom: 1px solid ${token.colorBorder};
				flex-shrink: 0;
				margin-top: ${safeAreaInsetTop};
			`,
			mobileMenuHeaderTitle: css`
				font-size: 18px;
				font-weight: 600;
				color: ${token.magicColorUsages.text[0]};
			`,
			mobileMenuCloseButton: css`
				color: ${token.magicColorUsages.text[1]};
			`,
			mobileMenuList: css`
				flex: 1;
				overflow-y: auto;
				padding: 8px;
			`,
			mobileMenuItem: css`
				margin-bottom: 4px;
			`,
			mobileMenuItemContent: css`
				display: flex;
				align-items: center;
				padding: 12px 16px;
				cursor: pointer;
				color: ${token.magicColorUsages.text[0]};
				transition: background-color 0.2s;
				-webkit-tap-highlight-color: transparent;
				margin-bottom: 4px;

				&:active {
					background-color: ${token.magicColorScales.grey[1]};
				}
			`,
			mobileMenuItemActive: css`
				background-color: ${token.colorPrimaryBg};
				color: ${token.colorPrimary};
				font-weight: 500;
				border-radius: 8px;
			`,
			mobileMenuItemIcon: css`
				display: flex;
				align-items: center;
				margin-right: 12px;
				font-size: 20px;
			`,
			mobileMenuItemLabel: css`
				flex: 1;
				font-size: 15px;
			`,
			mobileMenuItemChildren: css`
				padding-left: 32px;
			`,
		}
	},
)
