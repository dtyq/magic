import { createStyles } from "antd-style"

export default createStyles(
	({ css, isDarkMode, prefixCls, token }, { isMobile }: { isMobile: boolean }) => ({
		container: css``,
		groupAvatar: css`
			box-sizing: content-box;
			overflow: hidden;
		`,
		groupInfo: css`
			padding: 0 10px;
			overflow: hidden;
		`,
		groupInfoContent: css`
			width: 280px;
		`,
		groupName: css`
			color: ${token.colorText};
			text-align: left;
			font-size: 14px;
			font-weight: 600;
			line-height: 20px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		groupNotice: css`
			color: ${token.colorTextQuaternary};
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			text-align: left;
		`,
		memberSection: css`
			background-color: ${isMobile
				? token.magicColorUsages.bg[0]
				: token.magicColorScales.grey[0]};
			padding: 10px;
			border-radius: 10px;
			width: 100%;
			margin: 0;
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
			cursor: pointer;
			background: ${token.magicColorScales.grey[0]};
		`,
		groupAdminTip: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,
		buttonList: css`
			border-radius: 8px;
			width: 100%;
			background: ${token.magicColorScales.grey[0]};

			.${prefixCls}-btn {
				min-height: 50px;
				border-radius: 0;
				font-size: 14px;
				font-weight: 400;
				line-height: 20px;
			}

			.${prefixCls}-btn:not(:last-child) {
				border-bottom: 1px solid ${token.magicColorUsages.border};
			}
		`,
		viewAllMembersButton: css`
			margin-top: 8px;
			color: ${isDarkMode ? token.magicColorUsages.text[2] : token.magicColorUsages.text[1]};
		`,
		groupNameContent: css`
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 90%;
		`,
	}),
)
