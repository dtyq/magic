import { useTranslation } from "react-i18next"
import { Flex } from "antd"
import MagicSpin from "@/components/base/MagicSpin"
import EmptyIcon from "@/assets/logos/empty.svg"
import MagicScrollBar from "@/components/base/MagicScrollBar"
import type { GlobalSearch } from "@/types/search"
import { useMemoizedFn } from "ahooks"
import type { PanelsProps } from "./Applications"
import { useStyles } from "./styles"
import SearchItem from "../SearchItem"
import { useMagicSearchStore } from "../../store"
import { useRequest } from "../request"

function Schedule(props: PanelsProps) {
	const { maxHeight } = props
	const { styles } = useStyles()
	const { t } = useTranslation("search")

	const searchWord = useMagicSearchStore((store) => store.searchWord)

	const { data, run, loading, hasMorePage, nextRequestToken } =
		useRequest<GlobalSearch.ScheduleItem>(searchWord, 8)

	// 滚动加载更多
	const onScroll = useMemoizedFn((event) => {
		const { scrollHeight, clientHeight, scrollTop } = event.target
		// 当距离底部不到100px时触发加载
		if (scrollHeight - (scrollTop + clientHeight) <= 100 && !loading && data?.length > 0) {
			if (hasMorePage) {
				run({
					type: 8,
					key_word: searchWord,
					page_token: nextRequestToken,
				})
			}
		}
	})

	return (
		<div className={styles.panel}>
			<div className={styles.container}>
				<div className={styles.header}>{t("quickSearch.tabs.schedule")}</div>
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
								{data.map((item: GlobalSearch.ScheduleItem) => (
									<SearchItem.Schedule key={item?.id} item={item} />
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

export default Schedule
