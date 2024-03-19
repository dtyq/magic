import { createStyles } from "antd-style"

export const useStyles = createStyles(({ cx, css, token }) => {
	const moreActionButton = cx(css`
		display: none;
		flex: none;

		@media (max-width: 768px) {
			display: inline-flex;
		}
	`)

	return {
		headerSection: {
			display: "flex",
			justifyContent: "flex-end",
			alignItems: "center",
			padding: "8px 6px",
			borderBottom: `1px solid ${token.colorBorder}`,
			flexShrink: 0,
		},
		siderTask: {
			display: "flex",
			flexDirection: "column",
			flex: 1,
			padding: "6px 6px 6px 6px",
			gap: 4,
			overflowX: "hidden",
			overflowY: "auto",
		},
		titleRightIcon: {
			stroke: token.colorTextDescription,
		},
		item: css`
			display: flex;
			align-items: center;
			height: 36px;
			gap: 4px;
			border-radius: 8px;
			padding: 8px 8px 8px 4px;
			cursor: pointer;
			&:hover {
				background-color: #2e2f380d;
				.${moreActionButton} {
					display: inline-flex;
				}
			}
		`,
		moreActionButton,
		arrowIcon: {
			width: 20,
			stroke: token.colorTextDescription,
			flex: "none",
		},
		name: {
			fontSize: 14,
			fontWeight: 400,
			lineHeight: "20px",
			color: token.magicColorUsages.text[1],
			flex: "auto",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		siderTaskEmpty: {
			flex: "auto",
			overflow: "hidden",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			color: token.colorTextQuaternary,
		},
		menuDeleteIcon: {
			stroke: token.magicColorUsages.danger.default,
		},
		icon: {
			stroke: `${token.magicColorUsages.text[2]} !important`,
			borderRadius: "4px",
		},
		text: {
			color: `${token.magicColorUsages.text[1]} !important`,
		},
	}
})
