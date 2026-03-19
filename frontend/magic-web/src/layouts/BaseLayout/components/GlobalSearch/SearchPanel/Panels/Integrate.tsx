import { useTranslation } from "react-i18next"
import { createStyles } from "antd-style"
import { IconTrash } from "@tabler/icons-react"
import { Divider } from "antd"
// import { useMagicSearchStore } from "@/components/business/GlobalSearch/store"
// import { useRequest } from "@/components/business/GlobalSearch/SearchPanel/request"
import type { PanelsProps } from "./Applications"
// import type { GlobalSearch } from "@/types/search.ts"
// import { useMemoizedFn } from "ahooks"

export const useStyles = createStyles(({ token }) => {
	return {
		panel: {
			height: "100%",
			padding: 12,
			backgroundColor: token.magicColorUsages.bg[1],
		},
		border: {
			margin: "10px 0 20px 0",
			backgroundColor: token.magicColorUsages.border,
		},
		container: {
			width: "100%",
			display: "flex",
			flexDirection: "column",
			gap: 10,
		},
		header: {
			height: 22,
			fontSize: "14px",
			fontWeight: 400,
			lineHeight: "20px",
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			color: token.magicColorUsages.text[3],
		},
		wrapper: {},
		item: {
			padding: "6px 14px",
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			borderRadius: 1000,
			backgroundColor: token.magicColorUsages.fill[0],
			color: token.magicColorUsages.text[0],
			marginRight: 10,
			marginBottom: 10,
			floaty: "left",
			cursor: "pointer",
			fontSize: "14px",
			fontWeight: 400,
			lineHeight: "20px",

			"&:hover": {
				backgroundColor: token.magicColorUsages.fill[1],
			},

			"&:active": {
				backgroundColor: token.magicColorUsages.fill[0],
			},
		},
		itemIcon: {
			width: 16,
			height: 16,
			flex: "none",
			backgroundColor: "#ccc",
		},
		button: {
			width: 22,
			height: 22,
			color: token.magicColorUsages.text[3],
			cursor: "pointer",
		},
	}
})

function Integrate(props: PanelsProps) {
	const { maxHeight } = props
	const { styles } = useStyles()
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
