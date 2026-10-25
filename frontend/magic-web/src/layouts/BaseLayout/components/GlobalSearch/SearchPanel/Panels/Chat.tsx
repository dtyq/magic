import { useTranslation } from "react-i18next"
import { Form, Input, Radio, Space, DatePicker } from "antd"
import { useMemo } from "react"
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

const enum SearchMessageType {
	All = "all",
	Link = "link",
	File = "file",
	Media = "media",
}

const enum SearchMessageDate {
	UnrestrictedTime = "unrestrictedTime",
	Today = "today",
	AlmostAWeek = "almostAWeek",
	AlmostAMonth = "almostAMonth",
}

function useOptions() {
	const { t } = useTranslation("search")

	const typeOptions = useMemo(() => {
		return [
			{ text: t("quickSearch.settings.messageType.all"), value: SearchMessageType.All },
			{ text: t("quickSearch.settings.messageType.link"), value: SearchMessageType.Link },
			{ text: t("quickSearch.settings.messageType.file"), value: SearchMessageType.File },
			{ text: t("quickSearch.settings.messageType.media"), value: SearchMessageType.Media },
		]
	}, [t])

	const timeOptions = useMemo(() => {
		return [
			{
				text: t("quickSearch.settings.time.unrestrictedTime"),
				value: SearchMessageDate.UnrestrictedTime,
			},
			{ text: t("quickSearch.settings.time.today"), value: SearchMessageDate.Today },
			{
				text: t("quickSearch.settings.time.almostAWeek"),
				value: SearchMessageDate.AlmostAWeek,
			},
			{
				text: t("quickSearch.settings.time.almostAMonth"),
				value: SearchMessageDate.AlmostAMonth,
			},
		]
	}, [t])

	return { typeOptions, timeOptions }
}

function Chat(props: PanelsProps) {
	const { maxHeight } = props
	const { t } = useTranslation("search")

	const { typeOptions, timeOptions } = useOptions()

	const searchWord = useMagicSearchStore((store) => store.searchWord)

	const { data, run, loading, hasMorePage, nextRequestToken } = useRequest<GlobalSearch.ChatItem>(
		searchWord,
		4,
	)

	// 滚动加载更多
	const onScroll = useMemoizedFn((event: React.UIEvent<HTMLDivElement>) => {
		const { scrollHeight, clientHeight, scrollTop } = event.currentTarget
		// 当距离底部不到100px时触发加载
		if (scrollHeight - (scrollTop + clientHeight) <= 100 && !loading && data?.length > 0) {
			if (hasMorePage) {
				run({
					type: 4,
					key_word: searchWord,
					page_token: nextRequestToken,
				})
			}
		}
	})

	return (
		<div className={styles.panel}>
			<div className={styles.container}>
				<div className={styles.header}>{t("quickSearch.tabs.chat")}</div>
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
								{data.map((item: GlobalSearch.ChatItem) => (
									<SearchItem.Chat key={item.name} item={item} />
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
						<Form.Item label={t("quickSearch.settings.initiator")}>
							<Input placeholder={t("quickSearch.settings.clickToSelect")} />
						</Form.Item>
						<Form.Item label={t("quickSearch.settings.currentConversation")}>
							<Input placeholder={t("quickSearch.settings.clickToSelect")} />
						</Form.Item>
						<Form.Item label={t("quickSearch.settings.messageContains")}>
							<Radio.Group>
								<Space direction="vertical">
									{typeOptions.map((option) => (
										<Radio key={option.value} value={option.value}>
											{option.text}
										</Radio>
									))}
								</Space>
							</Radio.Group>
						</Form.Item>
						<Form.Item label={t("quickSearch.settings.dateTime")}>
							<Radio.Group>
								<Space direction="vertical">
									{timeOptions.map((option) => (
										<Radio key={option.value} value={option.value}>
											{option.text}
										</Radio>
									))}
								</Space>
							</Radio.Group>
						</Form.Item>
						<Form.Item noStyle>
							<DatePicker
								className="mb-2 w-full"
								placeholder={t("quickSearch.settings.startTime")}
							/>
						</Form.Item>
						<Form.Item noStyle>
							<DatePicker
								className="w-full"
								placeholder={t("quickSearch.settings.endTime")}
							/>
						</Form.Item>
					</Form>
				</ScrollArea>
			</div>
		</div>
	)
}

export default Chat
