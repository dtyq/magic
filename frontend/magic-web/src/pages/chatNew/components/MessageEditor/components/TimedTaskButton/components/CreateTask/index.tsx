import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import type { RadioChangeEvent } from "antd"
import { DatePicker, Flex, Form, Input, Radio, Select } from "antd"
import MagicButton from "@/components/base/MagicButton"
import { useEffect, useMemo, useState } from "react"
import { IconCalendarClock, IconChevronLeft } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import InputNumberComp from "../InputNumber"
import { useMemoizedFn } from "ahooks"
import type { Dayjs } from "@/lib/dayjs"
import type { UserTask } from "@/types/chat/task"
import dayjs from "@/lib/dayjs"
import chatTopicStore from "@/stores/chatNew/topic"
import { MagicSwitch } from "@/components/base/MagicSwitch"
import TopicService from "@/services/chat/topic/class"
import ConversationTaskService from "@/services/chat/conversation/ConversationTaskService"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"
import { observer } from "mobx-react-lite"
import { useStyles } from "./styles"
import {
	MONTH_OPTION,
	RepeatTypeMap,
	Units,
	WEEK_OPTION,
	EVERY_OPTION,
	DEFAULT_TASK_DATA,
	defaultTopicOptions,
	DEFAULT_TOPIC_VALUE,
	DEFAULT_VALUE,
} from "./constant"
import { CustomSelect } from "./components/CustomSelect"
import { TimeSelect } from "./components/TimeSelect"
import { CustomRepeat } from "./components/CustomRepeat"

interface CreateTaskProps {
	conversationId?: string
	currentTask: UserTask | null
	reBack: () => void
}

const CreateTask = observer(({ conversationId, currentTask, reBack }: CreateTaskProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const [form] = Form.useForm()

	const [selectedUnit, setSelectedUnit] = useState<Units>(Units.DAY)
	const [value, setValue] = useState<RepeatTypeMap>(RepeatTypeMap.NO_REPEAT)
	const [count, setCount] = useState<number>(1)
	const [showDeadline, setShowDeadline] = useState<boolean>(true)

	useEffect(() => {
		if (currentTask) {
			let day = null
			switch (currentTask.type) {
				case RepeatTypeMap.NO_REPEAT:
					day = dayjs(`${currentTask.day} ${currentTask.time}`, "YYYY-MM-DD HH:mm")
					break
				case RepeatTypeMap.WEEKLY_REPEAT:
				case RepeatTypeMap.MONTHLY_REPEAT:
					day = Number(currentTask.day)
					break
				default:
					day = currentTask.day
					break
			}

			const neverEnd =
				currentTask.type === RepeatTypeMap.CUSTOM_REPEAT && !currentTask.value.deadline
			form.setFieldsValue({
				...currentTask,
				day,
				time: currentTask.time
					? dayjs(`2026-02-26 ${currentTask.time}`, "YYYY-MM-DD HH:mm")
					: null,
				value: {
					...currentTask.value,
					deadline: currentTask.value.deadline ? dayjs(currentTask.value.deadline) : null,
				},
				neverEnd,
			})
			setValue(currentTask.type)
			setCount(currentTask.value.interval)
			setSelectedUnit(currentTask.value.unit)
			if (neverEnd) {
				setShowDeadline(false)
			}
		} else {
			form.setFieldsValue(DEFAULT_TASK_DATA)
		}
	}, [currentTask, form])

	const onChange = (e: RadioChangeEvent) => {
		setValue(e.target.value)
		form.setFieldValue("day", null)
		form.setFieldValue("time", null)
		form.setFieldValue("value", DEFAULT_VALUE)
	}
	const onCancel = () => {
		reBack()
		form.resetFields()
		setValue(RepeatTypeMap.NO_REPEAT)
		setCount(1)
		setSelectedUnit(Units.DAY)
	}

	const format = (data: Dayjs, type?: "day" | "time") => {
		if (!data) return null
		switch (type) {
			case "day":
				return data.format("YYYY-MM-DD")
			case "time":
			default:
				return data.format("HH:mm")
		}
	}

	const onConfirm = async () => {
		try {
			const res = await form.validateFields()
			const values = { ...res }
			const { type } = values

			switch (type) {
				case RepeatTypeMap.NO_REPEAT:
					values.day = format(res.day, "day")
					values.time = format(res.day)
					break
				case RepeatTypeMap.DAILY_REPEAT:
					values.time = format(values.time)
					break
				case RepeatTypeMap.CUSTOM_REPEAT:
					values.time = format(values.time)
					if (values.value?.deadline) {
						values.value.deadline = format(values.value.deadline, "day")
					}
					if (values.value?.unit === Units.YEAR) {
						values.day = dayjs().format("YYYY-MM-DD")
					}
					break
				default:
					values.time = format(values.time)
			}

			if (values.topic_id === DEFAULT_TOPIC_VALUE) {
				await TopicService.createTopic?.().then((val) => {
					const topicId = val[0].id
					values.topic_id = topicId
				})
			}

			const newValues = {
				...DEFAULT_TASK_DATA,
				...values,
				day: values.day !== null && values.day !== undefined ? values.day.toString() : "",
				id: currentTask?.id,
				agent_id: ConversationBotDataService.agentId,
				conversation_id: conversationId,
			}
			const isUpdate = !!newValues.id
			const successMessage = isUpdate
				? `${t("button.save")}${t("flow.apiKey.success")}`
				: `${t("button.create")}${t("flow.apiKey.success")}`

			const callback = () => {
				magicToast.success(successMessage)
				onCancel()
			}
			if (isUpdate) {
				ConversationTaskService.updateTask(newValues, callback)
			} else {
				ConversationTaskService.createTask(newValues, callback)
			}
		} catch (error) {
			console.error("表单验证失败:", error)
		}
	}

	const handleIncrease = useMemoizedFn((name) => {
		form.setFieldValue(name, count + 1)
		setCount((prev) => prev + 1)
	})

	const handleDecrease = useMemoizedFn((name) => {
		if (count - 1 <= 0) return
		form.setFieldValue(name, count - 1)
		setCount((prev) => prev - 1)
	})

	const title = useMemo(() => {
		return currentTask ? t("chat.timedTask.editTimedTask") : t("chat.timedTask.createTask")
	}, [currentTask, t])

	const weekdayOption = useMemo(() => WEEK_OPTION(t), [t])
	const monthOption = useMemo(() => MONTH_OPTION(t), [t])
	const everyOption = useMemo(() => EVERY_OPTION(t), [t])

	const topicList = chatTopicStore.timeTaskTopicList

	return (
		<Flex vertical gap={10}>
			<Flex align="center" gap={4}>
				<MagicButton type="text" className={styles.buttonBack} onClick={onCancel}>
					<MagicIcon component={IconChevronLeft} size={26} />
				</MagicButton>
				<div className={styles.title}>{title}</div>
			</Flex>
			<Form layout="vertical" form={form} requiredMark={false}>
				<Form.Item
					name="name"
					className={styles.formItem}
					label={t("chat.timedTask.taskContent")}
					rules={[{ required: true }]}
				>
					<Input placeholder={t("chat.timedTask.taskContentPlaceholder")} />
				</Form.Item>
				<Form.Item
					name="topic_id"
					label={t("chat.timedTask.topic")}
					className={styles.formItem}
					initialValue={
						topicList.length > 0 ? topicList[0].value : defaultTopicOptions[0].value
					}
					rules={[{ required: true, message: t("chat.timedTask.topicPlaceholder") }]}
				>
					<Select options={topicList.length > 0 ? topicList : defaultTopicOptions} />
				</Form.Item>
				<Form.Item
					name="type"
					className={styles.formItem}
					label={t("chat.timedTask.repeat")}
					initialValue={RepeatTypeMap.NO_REPEAT}
				>
					<Radio.Group className={styles.radioGroup} onChange={onChange} value={value}>
						<Radio value={RepeatTypeMap.NO_REPEAT}>
							{t("chat.timedTask.noRepeat")}
						</Radio>
						{value === RepeatTypeMap.NO_REPEAT && (
							<Form.Item
								noStyle
								name="day"
								rules={[
									{
										required: true,
										message: t(
											"chat.urgentModal.form.timedTransmissionOpenPlaceholder",
										),
									},
								]}
							>
								<DatePicker
									showTime
									placeholder={t(
										"chat.urgentModal.form.timedTransmissionOpenPlaceholder",
									)}
									suffixIcon={
										<IconCalendarClock size={16} color="currentColor" />
									}
								/>
							</Form.Item>
						)}
						<Radio value={RepeatTypeMap.DAILY_REPEAT}>
							{t("chat.timedTask.dailyRepeat")}
						</Radio>
						{value === RepeatTypeMap.DAILY_REPEAT && <TimeSelect />}
						<Radio value={RepeatTypeMap.WEEKLY_REPEAT}>
							{t("chat.timedTask.weeklyRepeat")}
						</Radio>
						{value === RepeatTypeMap.WEEKLY_REPEAT && (
							<CustomSelect
								name="day"
								message={t("chat.timedTask.weeklyTimePlaceholder")}
								width={50}
								options={weekdayOption}
							/>
						)}
						<Radio value={RepeatTypeMap.MONTHLY_REPEAT}>
							{t("chat.timedTask.monthlyRepeat")}
						</Radio>
						{value === RepeatTypeMap.MONTHLY_REPEAT && (
							<CustomSelect
								name="day"
								message={t("chat.timedTask.monthlyTimePlaceholder")}
								width={50}
								options={monthOption}
							/>
						)}
						<Radio value={RepeatTypeMap.WEEKDAY_REPEAT}>
							{t("chat.timedTask.weekdayRepeat")}
						</Radio>
						{value === RepeatTypeMap.WEEKDAY_REPEAT && <TimeSelect />}
						<Radio value={RepeatTypeMap.CUSTOM_REPEAT}>
							{t("chat.timedTask.customRepeat")}
						</Radio>
						{value === RepeatTypeMap.CUSTOM_REPEAT && (
							<Flex vertical gap={4} className={styles.custom}>
								<Flex gap={4} align="center" justify="space-between">
									<span>{t("calendar.newEvent.repeatOptions.every")}</span>
									<InputNumberComp
										width={100}
										name={["value", "interval"]}
										onIncrease={handleIncrease}
										onDecrease={handleDecrease}
									/>
									<Form.Item
										noStyle
										name={["value", "unit"]}
										rules={[
											{
												required: true,
												message: t("chat.timedTask.repeatPlaceholder"),
											},
										]}
										initialValue={everyOption[0].value}
									>
										<Select
											options={everyOption}
											defaultValue={everyOption[0].value}
											onChange={(val) => {
												setSelectedUnit(val)
												form.setFieldValue(["value", "values"], [])
											}}
										/>
									</Form.Item>
								</Flex>
								<CustomRepeat type={selectedUnit} />
								<Flex gap={4} align="center">
									<Form.Item noStyle name="neverEnd">
										<MagicSwitch
											onChange={(checked) => {
												setShowDeadline(!checked)
												form.setFieldValue(["value", "deadline"], null)
											}}
										/>
									</Form.Item>
									<div>{t("chat.timedTask.neverEnding")}</div>
								</Flex>
								<Form.Item noStyle name={["value", "deadline"]}>
									{showDeadline && (
										<Flex gap={4} align="center">
											<div>{t("chat.timedTask.deadline")}</div>
											<Form.Item
												noStyle
												name={["value", "deadline"]}
												rules={[
													{
														required: showDeadline,
														message: t(
															"chat.timedTask.timePlaceholder",
														),
													},
												]}
											>
												<DatePicker
													format="YYYY-MM-DD"
													style={{ flexGrow: 1 }}
													placeholder={t(
														"chat.urgentModal.form.timedTransmissionOpenPlaceholder",
													)}
													suffixIcon={
														<IconCalendarClock
															size={16}
															color="currentColor"
														/>
													}
													onChange={(date) => {
														if (date) {
															form.setFieldValue("neverEnd", false)
														}
													}}
												/>
											</Form.Item>
										</Flex>
									)}
								</Form.Item>
							</Flex>
						)}
					</Radio.Group>
				</Form.Item>
			</Form>
			<Flex align="center" gap={10} justify="flex-end">
				<MagicButton type="default" onClick={onCancel}>
					{t("common.cancel")}
				</MagicButton>
				<MagicButton type="primary" onClick={onConfirm}>
					{t("common.confirm")}
				</MagicButton>
			</Flex>
		</Flex>
	)
})

export default CreateTask
