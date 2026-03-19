import { createStyles } from "antd-style"
import { CSS_VARIABLES } from "./constants"

export const useStyles = createStyles(({ token, css, responsive }) => {
	// Base styles
	const baseContainer = css`
		background-color: ${token.magicColorUsages?.bg?.[0]};
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow-x: visible;
		gap: 18px;
	`

	// Responsive styles
	const responsiveContainer = css`
		${responsive.mobile} {
			${CSS_VARIABLES.explorePagePaddingInline}: 12px;
			${CSS_VARIABLES.explorePagePaddingBlock}: 14px;
		}

		${responsive.tablet} {
			${CSS_VARIABLES.explorePagePaddingInline}: 16px;
			${CSS_VARIABLES.explorePagePaddingBlock}: 20px;
		}

		${responsive.desktop} {
			${CSS_VARIABLES.explorePagePaddingInline}: 20px;
			${CSS_VARIABLES.explorePagePaddingBlock}: 24px;
		}
	`

	return {
		wrapper: css`
			padding-top: ${token.safeAreaInsetTop};
			background-color: ${token.magicColorUsages.bg[0]};
			height: 100%;
		`,
		container: css`
			${baseContainer}
			${responsiveContainer}
            padding-bottom: ${token.safeAreaInsetBottom};
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		title: css`
			color: ${token.magicColorUsages?.text?.[0]};
			text-align: center;
			font-size: 16px;
			font-weight: 600;
			line-height: 22px;
		`,
	}
})
