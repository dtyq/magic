import { useImmer } from "use-immer"
import { useMemoizedFn } from "ahooks"
import dayjs, { type Dayjs } from "@/lib/dayjs"
import { SearchApprovalStatus, SearchMessageDate } from "../types"

interface SearchPanelApprovalFormData {
	status?: null | string
	starter_ids?: Array<string>
	date?: null | SearchMessageDate
	start_time?: null | number
	end_time?: null | number
}

function compareDates(date1: Dayjs, date2: Dayjs) {
	const dayjsDate1 = dayjs(date1)
	const dayjsDate2 = dayjs(date2)
	return (
		dayjsDate1.year() === dayjsDate2.year() &&
		dayjsDate1.month() === dayjsDate2.month() &&
		dayjsDate1.date() === dayjsDate2.date()
	)
}

/** 内聚表单状态与逻辑变更 */
export function useApprovalFormStore() {
	const [formData, setFormData] = useImmer<SearchPanelApprovalFormData>({
		status: null,
		starter_ids: [],
		date: SearchMessageDate.UnrestrictedTime,
		start_time: null,
		end_time: null,
	})

	/** 状态变更 */
	const onStatusChange = useMemoizedFn((status: SearchApprovalStatus) => {
		setFormData((preState) => {
			preState.status = status === SearchApprovalStatus.All ? null : status
		})
	})

	/** 选中用户变更 */
	const onUsersChange = useMemoizedFn((users: Array<string>) => {
		setFormData((preState) => {
			preState.starter_ids = users
		})
	})

	/** 日期变更 */
	const onDateChange = useMemoizedFn((date: SearchMessageDate) => {
		setFormData((preState) => {
			preState.date = date
			switch (date) {
				case SearchMessageDate.UnrestrictedTime:
					preState.start_time = null
					preState.end_time = null
					break
				case SearchMessageDate.Today:
					preState.start_time = dayjs().unix()
					preState.end_time = dayjs().unix()
					break
				case SearchMessageDate.AlmostAMonth:
					preState.start_time = dayjs().subtract(1, "month").unix()
					preState.end_time = dayjs().unix()
					break
				case SearchMessageDate.AlmostAWeek:
					preState.start_time = dayjs().subtract(1, "week").unix()
					preState.end_time = dayjs().unix()
					break
				default:
			}
		})
	})

	/** 日期范围变更 */
	const onDateRangeChange = useMemoizedFn(
		(value: Dayjs | null | 0, key: "start_time" | "end_time") => {
			// 构建日期类型命中策略
			const rules = [
				(start: Dayjs, end: Dayjs) =>
					compareDates(start, dayjs()) && compareDates(end, dayjs()),
				(start: Dayjs, end: Dayjs) =>
					compareDates(start, dayjs().subtract(1, "week")) && compareDates(end, dayjs()),
				(start: Dayjs, end: Dayjs) =>
					compareDates(start, dayjs().subtract(1, "month")) && compareDates(end, dayjs()),
			]

			setFormData((preState) => {
				preState[key] = value && value.unix()

				if (!preState?.start_time && !preState?.end_time) {
					preState.date = SearchMessageDate.UnrestrictedTime
				} else {
					const startDate = dayjs((preState?.start_time ?? 0) * 1000)
					const endDate = dayjs((preState?.end_time ?? 0) * 1000)
					const index = rules.findIndex((rule) => {
						return rule(startDate, endDate)
					})
					preState.date =
						[
							SearchMessageDate.Today,
							SearchMessageDate.AlmostAWeek,
							SearchMessageDate.AlmostAMonth,
						][index] ?? null
				}
			})
		},
	)

	return {
		formData,
		onStatusChange,
		onUsersChange,
		onDateChange,
		onDateRangeChange,
	}
}
