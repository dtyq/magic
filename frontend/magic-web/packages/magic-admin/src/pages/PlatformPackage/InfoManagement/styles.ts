import { createStyles } from "antd-style"

export const useStyles = createStyles(
	(
		{ css, token },
		{
			siderCollapsed = false,
			isMobile = false,
			safeAreaInsetBottom = 0,
		}: { siderCollapsed?: boolean; isMobile?: boolean; safeAreaInsetBottom?: number | string },
	) => {
		return {
			container: css`
				min-width: ${isMobile ? "100%" : "400px"};
				max-width: ${isMobile ? "100%" : "920px"};
				height: 100%;
				margin: 0 auto;
				display: flex;
				flex-direction: column;
				gap: 10px;
				padding: ${isMobile ? "0" : "30px 10px 10px"};
				overflow-y: auto;
			`,
			formWrapper: css`
				width: 100%;
				padding: 20px;
				background-color: ${token.magicColorUsages.bg[0]};
				border-radius: 8px;
			`,
			footerContainer: css`
				width: ${isMobile ? "100%" : `calc(100% - ${siderCollapsed ? "56px" : "200px"})`};
				padding: ${isMobile ? "0 10px" : "0"};
				bottom: ${isMobile ? `calc(56px + ${safeAreaInsetBottom})` : "0"};
			`,
		}
	},
)
