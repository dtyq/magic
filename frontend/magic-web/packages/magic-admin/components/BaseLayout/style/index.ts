import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }, { isMobile }: { isMobile?: boolean }) => {
	return {
		container: css`
			height: 100%;
			width: 100%;
			position: relative;
		`,
		content: css`
			flex: 1;
			padding-bottom: ${isMobile ? "62px" : "82px"};
		`,
		footer: css`
			height: ${isMobile ? "50px" : "72px"};
			position: fixed;
			bottom: 0;
			right: 0;
			padding: 0px;
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		footerContent: css`
			max-width: ${isMobile ? "100%" : "900px"};
			width: 100%;
			min-width: ${isMobile ? "100%" : "400px"};
			height: 100%;
			margin: 0 auto;
			padding: 0 10px;
		`,
	}
})
