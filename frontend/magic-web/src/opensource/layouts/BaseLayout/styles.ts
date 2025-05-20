import { createStyles } from "antd-style"

export const useStyles = createStyles(
	(
		{ token, css, isDarkMode },
		{ siderSize }: { siderSize?: { width: number; height: number } },
	) => {
		return {
			global: {
				width: "100%",
				height: "100%",
				overflow: "hidden",
				backgroundSize: "cover",
				backgroundPosition: "center",
				backgroundRepeat: "no-repeat",
				backgroundColor: token.magicColorUsages.bg[0],
				"--sider-width": `${siderSize?.width}px`,
			},
			header: {
				backgroundColor: token.magicColorUsages.bg[0],
				borderBottom: `1px solid ${
					isDarkMode ? token.magicColorScales.grey[1] : token.colorBorder
				}`,
			},
			wrapper: {
				height: `calc(100vh - ${token.titleBarHeight}px)`,
			},
			sider: {
				backgroundColor: token.magicColorUsages.bg[0],
				borderRight: `1px solid ${
					isDarkMode ? token.magicColorScales.grey[1] : token.colorBorder
				}`,
			},
			subSider: {},
			content: css`
				width: calc(100% - var(--sider-width));
				height: 100%;
			`,
		}
	},
)
