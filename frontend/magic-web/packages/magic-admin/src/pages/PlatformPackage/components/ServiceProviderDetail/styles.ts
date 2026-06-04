import { createStyles } from "antd-style"

export const useStyles = createStyles(
	(
		{ css, token, isDarkMode },
		{ isOfficial, isMobile }: { isOfficial: boolean; isMobile?: boolean },
	) => {
		return {
			content: css`
				min-width: ${isMobile ? "100%" : "400px"};
				width: 100%;
				max-width: ${isMobile ? "100%" : "920px"};
				margin: 0 auto;
				padding: ${isMobile ? "0" : "30px 10px 10px"};
			`,
			cardContainer: css`
				display: flex;
				flex-direction: column;
				gap: ${isOfficial ? 8 : 20}px;
				padding: ${isMobile ? 10 : 20}px;
				border-radius: 8px;
				border: 1px solid ${token.magicColorUsages.border};
				background: linear-gradient(
					to bottom,
					${isDarkMode
							? token.magicColorUsages.warningLight.default
							: token.magicColorUsages.primaryLight.default}
						6%,
					${isDarkMode ? token.magicColorUsages.fill[0] : token.magicColorUsages.white}
						36%
				);
			`,
			card: css`
				padding: 0 !important;
				border: none !important;
				background-color: transparent !important;
			`,
			status: css`
				font-size: 12px;
				font-weight: 400;
				color: ${token.magicColorUsages.text[2]};
			`,
			ellipsis: css`
				line-clamp: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				display: -webkit-box;
				-webkit-line-clamp: 1;
				-webkit-box-orient: vertical;
				word-break: break-all;
			`,
			divider: css`
				margin: 0;
			`,
			deleteButton: css`
				padding: 6px 24px;
				border: 1px solid ${token.magicColorUsages.dangerLight.default} !important;
			`,
		}
	},
)
