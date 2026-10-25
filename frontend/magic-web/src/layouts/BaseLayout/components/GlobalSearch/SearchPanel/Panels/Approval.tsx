import { useTranslation } from "react-i18next"
import { DatePicker, Form, Input, Radio, Space } from "antd"
import MagicSpin from "@/components/base/MagicSpin"
import EmptyIcon from "@/assets/logos/empty.svg"
import type { GlobalSearch } from "@/types/search"
import dayjs from "@/infrastructure/vendors/dayjs"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useMemoizedFn } from "ahooks"
import type { PanelsProps } from "./Applications"
import { panelClassNames as styles } from "./classNames"
import SearchItem from "../SearchItem"
import { useApprovalFormStore } from "../../hooks/useApprovalFormStore"
import { useApprovalOptions } from "../../hooks/useApprovalOptions"
import { SearchApprovalStatus } from "../../types"
import { useMagicSearchStore } from "../../store"
import { useRequest } from "../request"

function Approval(props: PanelsProps) {
	const { maxHeight } = props
	const { t } = useTranslation("search")

	const { statusOptions, timeOptions } = useApprovalOptions()

	const { formData, onDateChange, onStatusChange, onDateRangeChange } = useApprovalFormStore()

	const searchWord = useMagicSearchStore((store) => store.searchWord)

	const { data, run, loading, hasMorePage, nextRequestToken } =
		useRequest<GlobalSearch.ApprovalItem>(searchWord, 7)

	// 滚动加载更多
	const onScroll = useMemoizedFn((event: React.UIEvent<HTMLDivElement>) => {
		const { scrollHeight, clientHeight, scrollTop } = event.currentTarget
		// 当距离底部不到100px时触发加载
		if (scrollHeight - (scrollTop + clientHeight) <= 100 && !loading && data?.length > 0) {
			if (hasMorePage) {
				run({
					type: 7,
					key_word: searchWord,
					page_token: nextRequestToken,
				})
			}
		}
	})

	return (
		<div className={styles.panel}>
			<div className={styles.container}>
				<div className={styles.header}>{t("quickSearch.tabs.approve")}</div>
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
								{data.map((item: GlobalSearch.ApprovalItem) => (
									<SearchItem.Approval key={item.id} item={item} />
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
						<Form.Item label={t("quickSearch.settings.approvalStatus")}>
							<Radio.Group
								value={formData?.status ?? SearchApprovalStatus.All}
								onChange={(event) => onStatusChange(event?.target?.value)}
							>
								<Space direction="vertical">
									{statusOptions.map((option) => (
										<Radio key={option.value} value={option.value}>
											{option.text}
										</Radio>
									))}
								</Space>
							</Radio.Group>
						</Form.Item>
						<Form.Item label={t("quickSearch.settings.dateTime")}>
							<Radio.Group
								value={formData.date}
								onChange={(event) => onDateChange(event?.target?.value)}
							>
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
								maxDate={
									formData?.end_time
										? dayjs(Number(formData?.end_time) * 1000)
										: undefined
								}
								value={
									formData.start_time && dayjs(Number(formData.start_time) * 1000)
								}
								onChange={(event) => onDateRangeChange(event, "start_time")}
								placeholder={t("quickSearch.settings.startTime")}
							/>
						</Form.Item>
						<Form.Item noStyle>
							<DatePicker
								className="w-full"
								minDate={
									formData?.start_time
										? dayjs(Number(formData?.start_time) * 1000)
										: undefined
								}
								value={formData.end_time && dayjs(Number(formData.end_time) * 1000)}
								onChange={(event) => onDateRangeChange(event, "end_time")}
								placeholder={t("quickSearch.settings.endTime")}
							/>
						</Form.Item>
					</Form>
				</ScrollArea>
			</div>
		</div>
	)
}

export default Approval
