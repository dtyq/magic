import { createStyles } from "antd-style"

const useStyles = createStyles(({ css }) => {
	return {
		btn: css`
			color: #1c1d23cc;
			border-color: #1c1d2314;
			font-weight: 400;
		`,
		modalWrap: css`
			.magic-modal-body {
				padding: 0;
				height: 556px;
			}
		`,
		body: css`
			height: 100%;
		`,
		organizationList: css`
			height: calc(100% - 180px);
			padding: 0 12px;
		`,
	}
})

export default useStyles
