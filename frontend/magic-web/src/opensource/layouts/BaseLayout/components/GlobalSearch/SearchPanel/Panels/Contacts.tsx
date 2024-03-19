import { useTranslation } from "react-i18next"
import EmptyIcon from "@/opensource/assets/logos/empty.svg"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { Flex } from "antd"
import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
import { useMemoizedFn } from "ahooks"
import type { GlobalSearch } from "@/opensource/types/search"
import SearchItem from "../SearchItem"
import { useStyles } from "./styles"
import type { PanelsProps } from "./Applications"
import { useMagicSearchStore } from "../../store"
import { useRequest } from "../request"

function Contacts(props: PanelsProps) {
	const { maxHeight } = props
	const { styles } = useStyles()
	const { t } = useTranslation("search")
	const searchWord = useMagicSearchStore((store) => store.searchWord)

	const { data, run, loading, hasMorePage, nextRequestToken } =
		useRequest<GlobalSearch.ContactItem>(searchWord, 1)

	// 滚动加载更多
	const onScroll = useMemoizedFn((event) => {
		const { scrollHeight, clientHeight, scrollTop } = event.target
		// 当距离底部不到100px时触发加载
		if (scrollHeight - (scrollTop + clientHeight) <= 100 && !loading && data?.length > 0) {
			if (hasMorePage) {
				run({
					type: 1,
					key_word: searchWord,
					page_token: nextRequestToken,
				})
			}
		}
	})

	return (
		<div className={styles.panel}>
			<div className={styles.container}>
				<div className={styles.header}>{t("quickSearch.tabs.contacts")}</div>
				{loading && data.length === 0 ? (
					<div className={styles.empty}>
						<Flex
							flex={1}
							vertical
							align="center"
							justify="center"
							style={{ width: "100%", height: "100%" }}
						>
							<MagicSpin spinning />
							<span>{t("quickSearch.settings.loading")}</span>
						</Flex>
					</div>
				) : (
					<MagicScrollBar
						className={styles.wrapper}
						style={{ maxHeight }}
						autoHide={false}
						scrollableNodeProps={{
							onScroll,
						}}
					>
						{!data || data.length === 0 ? (
							<div className={styles.empty}>
								<img src={EmptyIcon} alt="" />
								<span>{t("quickSearch.settings.empty")}</span>
							</div>
						) : (
							<>
								{data.map((item: GlobalSearch.ContactItem) => (
									<SearchItem.Contact key={item?.user_id} item={item} />
								))}
								{loading && (
									<Flex justify="center" style={{ padding: "10px 0" }}>
										<MagicSpin spinning />
									</Flex>
								)}
							</>
						)}
					</MagicScrollBar>
				)}
			</div>
		</div>
	)
}

export default Contacts
