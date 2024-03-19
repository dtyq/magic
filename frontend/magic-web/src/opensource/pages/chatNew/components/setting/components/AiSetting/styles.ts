import { createStyles } from "antd-style"

export default createStyles(({ css, prefixCls, token }, { isMobile }: { isMobile: boolean }) => ({
	container: css``,
	memberSection: css`
		background-color: ${isMobile
			? token.magicColorUsages.bg[0]
			: token.magicColorScales.grey[0]};
		padding: 10px;
		border-radius: 10px;
		width: 100%;
	`,
	member: css`
		cursor: pointer;
		margin: 3px;
	`,
	addMember: css`
		--${prefixCls}-control-height: 45px;
    color: ${token.magicColorUsages.text[1]};
    background-color: ${token.magicColorUsages.fill[0]} !important;

    &:hover {
      background-color: ${token.magicColorUsages.fill[1]} !important;
    }

    border: none;
	`,
	text: css`
		overflow: hidden;
		text-align: center;
		text-overflow: ellipsis;

		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
	`,
	title: css`
		padding-left: 10px;
		color: ${token.magicColorUsages.text[2]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	list: css`
		border-radius: 10px;
		overflow: hidden;
	`,
	shareToOther: css`
		color: ${token.colorText};
	`,
}))
