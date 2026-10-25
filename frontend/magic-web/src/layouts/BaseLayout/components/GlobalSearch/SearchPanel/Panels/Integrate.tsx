import { useTranslation } from "react-i18next"
import { IconTrash } from "@tabler/icons-react"
import { Divider } from "antd"
// import { useMagicSearchStore } from "@/components/business/GlobalSearch/store"
// import { useRequest } from "@/components/business/GlobalSearch/SearchPanel/request"
import type { PanelsProps } from "./Applications"
// import type { GlobalSearch } from "@/types/search.ts"
// import { useMemoizedFn } from "ahooks"

const styles = {
	panel: "h-full bg-card p-3",
	border: "mb-5 mt-2.5 bg-border",
	container: "flex w-full flex-col gap-2.5",
	header: "flex h-[22px] items-center justify-between text-sm font-normal leading-5 text-foreground/40",
	wrapper: "",
	item: "mb-2.5 mr-2.5 inline-flex cursor-pointer items-center gap-1 rounded-[1000px] bg-neutral-100 px-3.5 py-1.5 text-sm font-normal leading-5 text-foreground hover:bg-neutral-200 active:bg-neutral-100 dark:bg-white/10 dark:hover:bg-white/[0.15] dark:active:bg-white/10",
	itemIcon: "size-4 flex-none bg-[#ccc]",
	button: "size-[22px] cursor-pointer text-foreground/40",
}

function Integrate(props: PanelsProps) {
	const { maxHeight } = props
	const { t } = useTranslation("search")
	// const searchWord = useMagicSearchStore((store) => store.searchWord)

	// const {data, run, loading, hasMorePage, nextRequestToken} = useRequest<GlobalSearch.ContactItem>(searchWord, -1)
	//
	// // 滚动加载更多
	// // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-unused-vars
	// const onScroll = useMemoizedFn((event) => {
	// 	const {scrollHeight, clientHeight, scrollTop} = event.target
	// 	// 当距离底部不到100px时触发加载
	// 	if (scrollHeight - (scrollTop + clientHeight) <= 100 && !loading && data?.length > 0) {
	// 		if (hasMorePage) {
	// 			run({
	// 				type: -1,
	// 				key_word: searchWord,
	// 				page_token: nextRequestToken,
	// 			})
	// 		}
	// 	}
	// })

	return (
		<div className={styles.panel} style={{ maxHeight }}>
			<div className={styles.container}>
				<div className={styles.header}>
					{t("quickSearch.settings.historicalSearch")}
					<div className={styles.button}>
						<IconTrash size={20} stroke={1} />
					</div>
				</div>
				<div className={styles.wrapper}>
					<div className={styles.item}>Teamshare</div>
					<div className={styles.item}>Magic</div>
					<div className={styles.item}>项目</div>
					<div className={styles.item}>神奇项目</div>
				</div>
			</div>
			<Divider className={styles.border} />
			<div className={styles.container}>
				<div className={styles.header}>{t("quickSearch.settings.predictiveSearch")}</div>
				<div className={styles.wrapper}>
					<div className={styles.item}>
						<span className={styles.itemIcon} />
						增冠霖(大白)
					</div>
					<div className={styles.item}>
						<span className={styles.itemIcon} />
						Magic 项目群
					</div>
					<div className={styles.item}>
						<span className={styles.itemIcon} />
						小白
					</div>
				</div>
			</div>
		</div>
	)
}

export default Integrate
