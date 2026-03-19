import { createStyles } from "antd-style"
import type { GlobalSearch } from "@/types/search"
import HighlightText from "../HighlightText"

const useApprovalStyles = createStyles(({ token }) => {
	return {
		item: {
			width: "100%",
			height: "auto",
			padding: "8px 12px 8px 12px",
			display: "flex",
			alignItems: "flex-start",
			justifyItems: "center",
			flexDirection: "column",
			gap: 4,
			borderBottom: `1px solid ${token.magicColorUsages.border}`,
			cursor: "pointer",

			"&:hover": {
				backgroundColor: "rgba(46, 50, 56, 0.05)",
			},

			"&:active": {
				backgroundColor: "rgba(46, 50, 56, 0.09)",
			},
		},
		header: {
			display: "flex",
			gap: 6,
			width: "100%",
			height: 20,
			alignItems: "center",
			justifyContent: "space-between",
		},
		icon: {
			width: 20,
			height: 20,
			borderRadius: 4,
		},
		title: {
			fontSize: "14px",
			fontWeight: 600,
			lineHeight: "20px",
			marginRight: "auto",
			color: token.magicColorUsages.text[0],
		},
		time: {
			fontSize: "12px",
			fontWeight: 400,
			lineHeight: "16px",
			color: token.magicColorUsages.text[2],
		},
		wrapper: {
			height: "fix-content",
			display: "flex",
			flexDirection: "column",
			gap: 4,
		},
		wrapperItem: {
			fontSize: "12px",
			fontWeight: 400,
			lineHeight: "16px",
			color: token.magicColorUsages.text[2],
		},
		footer: {
			width: "100%",
		},
		status: {
			float: "right",
			fontSize: "12px",
			fontWeight: 400,
			lineHeight: "16px",
		},
	}
})

interface SearchItemApprovalProps {
	item: GlobalSearch.ApprovalItem
}

function Approval(props: SearchItemApprovalProps) {
	const { item } = props
	const { styles } = useApprovalStyles()

	return (
		<div className={styles.item}>
			<div className={styles.header}>
				<div className={styles.icon}>
					<div style={{ height: "100%", backgroundColor: "#ddd" }} />
				</div>
				<div className={styles.title}>
					<HighlightText text={item?.title} />
				</div>
				<div className={styles.time}>
					<HighlightText text={item?.created_at} />
				</div>
			</div>
			<div className={styles.wrapper}>
				<div className={styles.wrapperItem}>
					<HighlightText text="系统: Teamshare 控制台" />
				</div>
				<div className={styles.wrapperItem}>
					<HighlightText text="权限：应用管理、企业管理" />
				</div>
				<div className={styles.wrapperItem}>
					<HighlightText text="用途：管理内部应用、管理组织架构以及人员" />
				</div>
			</div>
			<div className={styles.footer}>
				<span className={styles.status}>
					<HighlightText text={`${item?.status}`} />
				</span>
			</div>
		</div>
	)
}

export default Approval
