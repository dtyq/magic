import { Form, DatePicker } from "antd"
import { useMemoizedFn } from "ahooks"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import dayjs, { Dayjs } from "dayjs"
import { set, get } from "lodash-es"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"
import NodeOutputWrap from "../../../components/NodeOutputWrap/NodeOutputWrap"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"

const { RangePicker } = DatePicker

export default function MessageSearchV0() {
	const { t } = useTranslation()
	const [form] = Form.useForm()

	const { updateNodeConfig } = useFlow()

	const { currentNode } = useCurrentNode()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return
		if (changeValues.time_range) {
			const values = changeValues.time_range.map((time: Dayjs) => {
				return dayjs(time).format("YYYY-MM-DD HH:mm:ss")
			})
			set(currentNode, ["params"], {
				...get(currentNode, ["params"]),
				start_time: values[0],
				end_time: values[1],
			})
			updateNodeConfig({
				...currentNode,
			})
			return
		}
		Object.entries(changeValues).forEach(([key, value]) => {
			set(currentNode, ["params", key], value)
			updateNodeConfig({ ...currentNode })
		})
	})

	const initialValues = useMemo(() => {
		const { start_time, end_time, max_record } = currentNode?.params || {}
		if (!start_time && !end_time) return currentNode?.params
		const timeRange = [
			dayjs(start_time, "YYYY-MM-DD HH:mm:ss") || null,
			dayjs(end_time, "YYYY-MM-DD HH:mm:ss") || null,
		]
		return {
			time_range: timeRange,
			max_record,
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<NodeOutputWrap className={styles.searchUsers}>
			<Form
				className={styles.messageSearch}
				form={form}
				onValuesChange={onValuesChange}
				layout="vertical"
				initialValues={initialValues}
			>
				<Form.Item
					label={t("messageSearch.maxRecordCount", { ns: "flow" })}
					name="max_record"
				>
					<MagicInput type="number" className="nodrag" />
				</Form.Item>

				<Form.Item label={t("messageSearch.range", { ns: "flow" })} name="time_range">
					<RangePicker
						placeholder={[
							t("common.startTime", { ns: "flow" }),
							t("common.endTime", { ns: "flow" }),
						]}
						showTime
						className="nodrag"
						popupClassName="nowheel"
					/>
				</Form.Item>
			</Form>
		</NodeOutputWrap>
	)
}
