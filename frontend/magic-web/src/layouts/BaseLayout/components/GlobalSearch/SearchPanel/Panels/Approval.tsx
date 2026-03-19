import { useTranslation } from "react-i18next"
import { DatePicker, Flex, Form, Input, Radio, Space } from "antd"
import MagicSpin from "@/components/base/MagicSpin"
import EmptyIcon from "@/assets/logos/empty.svg"
import type { GlobalSearch } from "@/types/search"
import dayjs from "@/lib/dayjs"
import MagicScrollBar from "@/components/base/MagicScrollBar"
import { useMemoizedFn } from "ahooks"
import type { PanelsProps } from "./Applications"
import { useStyles } from "./styles"
import SearchItem from "../SearchItem"
import { useApprovalFormStore } from "../../hooks/useApprovalFormStore"
import { useApprovalOptions } from "../../hooks/useApprovalOptions"
import { SearchApprovalStatus } from "../../types"
import { useMagicSearchStore } from "../../store"
import { useRequest } from "../request"

function Approval(props: PanelsProps) {
	const { maxHeight } = props
	const { styles } = useStyles()
	const { t } = useTranslation("search")

	const { statusOptions, timeOptions } = useApprovalOptions()

	const { formData, onDateChange, onStatusChange, onDateRangeChange } = useApprovalFormStore()

	const searchWord = useMagicSearchStore((store) => store.searchWord)

	const { data, run, loading, hasMorePage, nextRequestToken } =
		useRequest<GlobalSearch.ApprovalItem>(searchWord, 7)

	// 滚动加载更多
	const onScroll = useMemoizedFn((event) => {
		const { scrollHeight, clientHeight, scrollTop } = event.target
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
								{data.map((item: GlobalSearch.ApprovalItem) => (
									<SearchItem.Approval key={item.id} item={item} />
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
			<div className={styles.section} style={{ flex: "0 0 220px" }}>
				<div className={styles.title}>{t("quickSearch.settings.filter")}</div>
				<div className={styles.sectionBody} style={{ maxHeight }}>
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
								style={{ width: "100%", marginBottom: 8 }}
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
								style={{ width: "100%" }}
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
				</div>
			</div>
		</div>
	)
}

export default Approval
