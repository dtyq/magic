import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	fileInfo: css`
		font-size: 14px;
		color: ${token.colorText};
		line-height: 1.6;
		font-family: ${token.fontFamilyCode};
	`,
}))
