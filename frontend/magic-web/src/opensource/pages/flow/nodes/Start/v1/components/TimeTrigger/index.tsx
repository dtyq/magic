import { useMemo } from "react"

import { DatePicker, Form, TimePicker } from "antd"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import type { DefaultOptionType } from "antd/lib/select"
import { useMemoizedFn } from "ahooks"
import dayjs from "dayjs"
import weekday from "dayjs/plugin/weekday"
import localeData from "dayjs/plugin/localeData"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import styles from "./index.module.less"
import {
	CycleTypeMap,
	CYCLE_TYPE_OPTION,
	getDefaultTimeTriggerParams,
	TIME_DATE_TYPE,
	Units,
	WEEK_MAP,
} from "./constants"
import CustomRepeat from "./components/CustomRepeat"
import type { TimeTriggerParams } from "./types"

// 扩展 dayjs 插件
dayjs.extend(weekday)
dayjs.extend(localeData)

// 定义分支的接口
interface Branch {
	branch_id: string
	config?: Partial<TimeTriggerParams>
}

type DateOptionsProps = {
	value?: string
	type: TimeTriggerParams["type"]
	options: DefaultOptionType[]
	onChange?: (type: TimeTriggerParams["type"]) => void
}

const DayOption = ({ value, type, options, onChange }: DateOptionsProps) => {
	const displayValue = useMemo(() => {
		if (TIME_DATE_TYPE.includes(type)) return dayjs.isDayjs(value) ? value : null
		return typeof value === "string" ? value : null
	}, [value, type])

	return TIME_DATE_TYPE.includes(type) ? (
		<DatePicker
			allowClear={false}
			value={displayValue as any}
			suffixIcon={null}
			onChange={onChange}
			style={{ width: "100%" }}
			format="YYYY-MM-DD"
		/>
	) : (
		<MagicSelect
			value={displayValue}
			options={options}
			onChange={onChange}
			fieldNames={{ value: "id" }}
		/>
	)
}

type TimeTriggeredProps = {
	// 分支id
	branchId: string
}

const TimeTrigger = ({ branchId }: TimeTriggeredProps) => {
	const { t } = useTranslation()
	const [form] = Form.useForm()
	const { updateNodeConfig, nodeConfig } = useFlow()

	const { currentNode } = useCurrentNode()

	const branch = useMemo(() => {
		const branches = currentNode?.params?.branches || []
		return branches.find((b: Branch) => b.branch_id === branchId)
	}, [branchId, currentNode])

	const cycleType = branch?.config?.type

	const cycleOptions = useMemo(() => {
		if ([CycleTypeMap.WEEKLY_REPEAT].includes(cycleType)) {
			const options = []
			for (let i = 0; i <= 6; i += 1) {
				options.push({
					label: `${WEEK_MAP[i]}`,
					id: `${i}`,
				})
			}
			return options
		}

		if ([CycleTypeMap.MONTHLY_REPEAT].includes(cycleType)) {
			const options = []
			for (let i = 1; i <= 31; i += 1) {
				options.push({
					label: resolveToString(t("start.nDay", { ns: "flow" }), { num: i }),
					id: `${i}`,
				})
			}
			return options
		}

		return []
	}, [cycleType, t])

	const onValuesChange = useMemoizedFn((changedValues: Partial<TimeTriggerParams>) => {
		if (branch && !branch?.config) {
			branch.config = {}
		}
		const branchConfig = branch?.config
		if (changedValues.type && branchConfig) {
			if (
				[CycleTypeMap.DAILY_REPEAT, CycleTypeMap.WEEKDAY_REPEAT].includes(
					changedValues.type,
				)
			) {
				branchConfig.day = null
			}

			if ([CycleTypeMap.WEEKLY_REPEAT].includes(changedValues.type)) {
				branchConfig.day = `${dayjs().weekday()}`
			}

			if ([CycleTypeMap.MONTHLY_REPEAT].includes(changedValues.type)) {
				branchConfig.day = `${dayjs().date()}`
			}

			if (TIME_DATE_TYPE.includes(changedValues.type)) {
				branchConfig.day = dayjs().format("YYYY-MM-DD")
			}

			if ([CycleTypeMap.CUSTOM_REPEAT].includes(changedValues.type)) {
				branchConfig.value = {
					interval: 1,
					unit: Units.DAY,
					values: [],
					deadline: null,
				}
			} else {
				const defaultContent = getDefaultTimeTriggerParams()
				branchConfig.value = { ...defaultContent.value }
			}

			branchConfig.time = "00:00"
		}

		if (changedValues.day && TIME_DATE_TYPE.includes(branchConfig?.type)) {
			changedValues.day = dayjs(changedValues.day).format("YYYY-MM-DD")
		}

		if (changedValues.time) {
			changedValues.time = dayjs(changedValues.time).format("HH:mm")
		}

		if (branchConfig) {
			Object.assign(branch.config!, changedValues)
			const currentNodeConfig = nodeConfig[currentNode?.node_id ?? ""]
			updateNodeConfig({ ...currentNodeConfig })
		}
	})

	const getTransformBranch = useMemoizedFn((sourceBranch) => {
		// 检查time值是否有效
		const timeValue = sourceBranch?.config?.time
		let parsedTime

		if (timeValue && typeof timeValue === "string" && /^\d{2}:\d{2}$/.test(timeValue)) {
			// 如果是有效的HH:mm格式
			parsedTime = dayjs(`2000-01-01 ${timeValue}`)
		} else {
			// 默认时间
			parsedTime = dayjs().startOf("day")
		}

		return {
			...sourceBranch?.config,
			day: TIME_DATE_TYPE.includes(sourceBranch?.config?.type)
				? dayjs(sourceBranch?.config?.day, "YYYY-MM-DD")
				: sourceBranch?.config?.day,
			time: parsedTime,
		}
	})

	const initialValues = useMemo(() => {
		if (branch && !branch?.config) {
			branch.config = getDefaultTimeTriggerParams()
			updateNodeConfig({ ...currentNode! })
			return getTransformBranch(branch)
		}
		return getTransformBranch(branch)
	}, [branch, currentNode, getTransformBranch, updateNodeConfig])

	return (
		<Form
			initialValues={initialValues}
			onValuesChange={onValuesChange}
			className={styles.timeTrigger}
			form={form}
		>
			<Form.Item className={styles.cycleSelect}>
				<Form.Item name="type" className={styles.typeOption}>
					<MagicSelect options={CYCLE_TYPE_OPTION} fieldNames={{ value: "id" }} />
				</Form.Item>
				{![CycleTypeMap.DAILY_REPEAT, CycleTypeMap.WEEKDAY_REPEAT].includes(cycleType) && (
					<Form.Item name="day" className={styles.dayOption}>
						<DayOption type={cycleType} options={cycleOptions} />
					</Form.Item>
				)}
				<Form.Item name="time" className={styles.timeOption}>
					<TimePicker suffixIcon={null} allowClear={false} format="HH:mm" />
				</Form.Item>
			</Form.Item>
			{[CycleTypeMap.CUSTOM_REPEAT].includes(cycleType) && (
				<Form.Item name="value" className="custom-value">
					<CustomRepeat />
				</Form.Item>
			)}
		</Form>
	)
}

export default TimeTrigger
