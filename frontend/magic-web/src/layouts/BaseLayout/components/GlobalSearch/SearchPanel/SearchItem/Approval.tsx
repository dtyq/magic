import type { GlobalSearch } from "@/types/search"
import HighlightText from "../HighlightText"

const styles = {
	item: "flex h-auto w-full cursor-pointer flex-col items-start gap-1 border-b border-border px-3 py-2 hover:bg-[rgba(46,50,56,0.05)] active:bg-[rgba(46,50,56,0.09)]",
	header: "flex h-5 w-full items-center justify-between gap-1.5",
	icon: "size-5 rounded",
	title: "mr-auto text-sm font-semibold leading-5 text-foreground",
	time: "text-xs font-normal leading-4 text-foreground/60",
	wrapper: "flex h-fit flex-col gap-1",
	wrapperItem: "text-xs font-normal leading-4 text-foreground/60",
	footer: "w-full",
	status: "float-right text-xs font-normal leading-4",
}

interface SearchItemApprovalProps {
	item: GlobalSearch.ApprovalItem
}

function Approval(props: SearchItemApprovalProps) {
	const { item } = props

	return (
		<div className={styles.item}>
			<div className={styles.header}>
				<div className={styles.icon}>
					<div className="h-full bg-[#ddd]" />
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
