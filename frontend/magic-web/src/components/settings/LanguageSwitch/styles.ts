import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		select: css`
			width: 100%;
		`,
		menuItem: css`
			height: 32px;
			display: flex;
			align-items: center;
		`,
		menuItemLeft: css`
			flex: 1;
			overflow: hidden;
		`,
		menuItemTop: css`
			display: flex;
			align-items: center;
			font-size: 14px;
			height: 20px;
		`,
		menuItemTopName: css`
			flex: 1 0 0;
			overflow: hidden;
			font-weight: 600;
			white-space: nowrap;
			text-overflow: ellipsis;
		`,
		menuItemBottom: css`
			flex: 1 0 0;
			display: flex;
			align-items: center;
			color: ${isDarkMode ? token.magicColorScales.grey[7] : token.magicColorScales.grey[5]};
			font-size: 12px;
			height: 16px;
		`,
	}
})
