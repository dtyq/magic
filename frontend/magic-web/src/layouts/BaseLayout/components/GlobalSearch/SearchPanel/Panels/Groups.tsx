import { useTranslation } from "react-i18next"
import { Form, Input } from "antd"
import MagicSpin from "@/components/base/MagicSpin"
import EmptyIcon from "@/assets/logos/empty.svg"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { GlobalSearch } from "@/types/search"
import { useMemoizedFn } from "ahooks"
import type { PanelsProps } from "./Applications"
import { panelClassNames as styles } from "./classNames"
import SearchItem from "../SearchItem"
import { useMagicSearchStore } from "../../store"
import { useRequest } from "../request"

function Groups(props: PanelsProps) {
	const { maxHeight } = props
	const { t } = useTranslation("search")

	const searchWord = useMagicSearchStore((store) => store.searchWord)

	const { data, run, loading, hasMorePage, nextRequestToken } =
		useRequest<GlobalSearch.GroupItem>(searchWord, 3)

	// 滚动加载更多
	const onScroll = useMemoizedFn((event: React.UIEvent<HTMLDivElement>) => {
		const { scrollHeight, clientHeight, scrollTop } = event.currentTarget
		// 当距离底部不到100px时触发加载
		if (scrollHeight - (scrollTop + clientHeight) <= 100 && !loading && data?.length > 0) {
			if (hasMorePage) {
				run({
					type: 3,
					key_word: searchWord,
					page_token: nextRequestToken,
				})
			}
		}
	})

	return (
		<div className={styles.panel}>
			<div className={styles.container}>
				<div className={styles.header}>{t("quickSearch.tabs.groups")}</div>
				{loading && data.length === 0 ? (
					<div className={styles.empty}>
						<div className="flex size-full flex-1 flex-col items-center justify-center">
							<MagicSpin spinning />
							<span>{t("quickSearch.settings.loading")}</span>
						</div>
					</div>
				) : (
					<ScrollArea
						className={styles.wrapper}
						viewportClassName="h-auto p-1"
						viewportStyle={{ maxHeight }}
						viewportProps={{ onScroll }}
					>
						{!data || data.length === 0 ? (
							<div className={styles.empty}>
								<img src={EmptyIcon} alt="" />
								<span>{t("quickSearch.settings.empty")}</span>
							</div>
						) : (
							<>
								{data.map((item: GlobalSearch.GroupItem) => (
									<SearchItem.Group key={item?.id} item={item} />
								))}
								{loading && (
									<div className="flex justify-center py-2.5">
										<MagicSpin spinning />
									</div>
								)}
							</>
						)}
					</ScrollArea>
				)}
			</div>
			<div className={styles.section}>
				<div className={styles.title}>{t("quickSearch.settings.filter")}</div>
				<ScrollArea className={styles.sectionBody} viewportStyle={{ maxHeight }}>
					<Form layout="vertical">
						<Form.Item label={t("quickSearch.settings.includeMembers")}>
							<Input placeholder={t("quickSearch.settings.clickToSelect")} />
						</Form.Item>
					</Form>
				</ScrollArea>
			</div>
		</div>
	)
}

export default Groups
