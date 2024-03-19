import { createStyles } from "antd-style"

export const useOrganizationSwitchStyles = createStyles(({ token, css, isDarkMode }) => {
	// Base styles
	const baseContainer = css`
		background: ${isDarkMode
			? token.magicColorScales?.grey?.[9]
			: token.magicColorScales?.grey?.[0]};
	`
	return {
		// Main container
		container: css`
			${baseContainer}
			width: 100%;
			height: 100%;
			overflow: hidden;
		`,

		// Scroll container
		scrollContainer: css`
			height: 100%;
			padding: 10px;
			overflow-y: auto;
		`,
	}
})
