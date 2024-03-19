import { Drawer, Flex, Button } from "antd"
import { useBoolean, useMemoizedFn, useMount } from "ahooks"
import { observer } from "mobx-react-lite"
import { IconChevronLeft, IconX } from "@tabler/icons-react"
import { cx } from "antd-style"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useForm } from "antd/es/form/Form"
import type {
	QuickInstructionList,
	QuickInstruction,
	Bot,
	QuickInstructionBase,
	InstructionStatus,
	CommonQuickInstruction,
} from "@/opensource/types/bot"
import { InstructionGroupType, InstructionType } from "@/opensource/types/bot"
import { botStore } from "@/opensource/stores/bot"
import { BotApi } from "@/opensource/apis"
import { useStyles } from "./styles"
import InstructionList from "./components/InstructionList"
import InstructionForm from "./components/InstructionForm"
import btnStyles from "../SaveDraftButton/index.module.less"
import { isSystemItem } from "./const"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

type QuickInstructionButtonProps = {
	Icon?: boolean
	agent: Bot.Detail
}

function QuickInstructionButton({ agent, Icon }: QuickInstructionButtonProps) {
	const { t } = useTranslation("interface")
	const { t: globalT } = useTranslation()

	const { styles } = useStyles()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const [edit, { setTrue: openEdit, setFalse: closeEdit }] = useBoolean(false)

	const [currentInstruction, setCurrentInstruction] = useState<
		CommonQuickInstruction | undefined
	>()

	const [selectedValue, setSelectedValue] = useState<InstructionType>(
		InstructionType.SINGLE_CHOICE,
	)

	const [selectedGroupType, setSelectedGroupType] = useState<InstructionGroupType>(
		InstructionGroupType.TOOL,
	)
	const [form] = useForm<QuickInstruction & { switch_on: boolean; switch_off: boolean }>()

	const instructionsList = botStore.instructList
	const options = botStore.instructOption

	const getInstructOption = useMemoizedFn(async () => {
		const res = await BotApi.getInstructTypeOption()
		botStore.setInstructOption(
			Object.entries(res).map(([key, value]) => ({
				value,
				label: key,
			})),
		)
	})

	const getInstructGroup = useMemoizedFn(async () => {
		const res = await BotApi.getInstructGroupTypeOption()
		botStore.setInstructGroupOption(res)
	})

	const getInstructColors = useMemoizedFn(async () => {
		const res = await BotApi.getInstructStatusColors()
		botStore.setInstructStatusColors(res)
	})

	const getInstructIcons = useMemoizedFn(async () => {
		const res = await BotApi.getInstructStatusIcons()
		botStore.setInstructStatusIcons(res)
	})

	const getSystemInstruct = useMemoizedFn(async () => {
		const res = await BotApi.getSystemInstruct()
		botStore.setSystemInstructList(res)
	})

	const handleCancel = useMemoizedFn(() => {
		setCurrentInstruction(undefined)
		setSelectedValue(InstructionType.SINGLE_CHOICE)
		form.resetFields()
		form.setFieldsValue({
			type: InstructionType.SINGLE_CHOICE,
		})
		closeEdit()
	})

	useMount(() => {
		getInstructOption()
		getInstructGroup()
		getInstructColors()
		getInstructIcons()
		getSystemInstruct()
	})

	useEffect(() => {
		if (!open) {
			closeEdit()
		}
	}, [closeEdit, open])

	const addNewInstruction = useMemoizedFn((type: InstructionGroupType) => {
		const group = instructionsList.find((item) => item.position === type)
		const quickInstructList = group?.items.filter((item) => !isSystemItem(item)) || []
		if (quickInstructList.length >= 5) {
			magicToast.error(t("agent.maxInstruction"))
			return
		}
		setSelectedGroupType(type)
		openEdit()
	})

	const save = useMemoizedFn((list: QuickInstructionList[]) => {
		BotApi.saveInstruct({
			bot_id: agent.botEntity?.id,
			instructs: list,
		}).then((res) => {
			botStore.setInstructList(res)
			magicToast.success(globalT("common.savedSuccess", { ns: "flow" }))
			agent.botEntity.instructs = res
			handleCancel()
		})
	})

	const onFinish = useMemoizedFn(
		async (values: QuickInstruction & { switch_on: boolean; switch_off: boolean }) => {
			let groupIdx = instructionsList.findIndex((item) => item.position === selectedGroupType)

			const newInstructionsList = [...instructionsList]
			// 如果 group 不存在且列表为空，创建新的 group
			let groupList: QuickInstruction[] = []
			if (groupIdx === -1) {
				newInstructionsList.push({
					position: selectedGroupType,
					items: [],
				})
				groupIdx = newInstructionsList.findIndex(
					(item) => item.position === selectedGroupType,
				)
			} else {
				groupList = newInstructionsList[groupIdx].items
			}

			// 如果是开关，需要设置 default_value
			if (values.type === InstructionType.SWITCH) {
				values.default_value = values.switch_on ? "on" : "off"
			}
			// 状态指令,需要设置 default_value
			if (values.type === InstructionType.STATUS) {
				values.default_value =
					values.values.findIndex((item: InstructionStatus) => item.switch) + 1
			}

			const isEdit = groupList.findIndex((item) => item.id === values.id)

			// 检查是否存在重复名称
			const isDuplicateName = (name: string, id?: string) =>
				groupList.some((item) => item.name && item.name === name && (!id || item.id !== id))

			// 编辑
			if (isEdit !== -1) {
				if (isDuplicateName(values.name, values.id)) {
					magicToast.error(t("agent.nameRepeatError"))
					return
				}
				groupList[isEdit] = values
			} else {
				// 新增逻辑
				if (isDuplicateName(values.name)) {
					magicToast.error(t("agent.nameRepeatError"))
					return
				}
				if (groupList.filter((item) => !isSystemItem(item)).length >= 5) {
					magicToast.error(t("agent.maxInstruction"))
					return
				}
				groupList.push(values)
			}

			newInstructionsList[groupIdx].items = groupList
			save(newInstructionsList)
		},
	)

	// 删除指令
	const deleteInstruction = useMemoizedFn(
		async (type: InstructionGroupType, val: QuickInstructionBase) => {
			const newList = instructionsList.map((data) => {
				if (data.position === type) {
					return {
						...data,
						items: data.items.filter((i) => i.id !== val.id),
					}
				}
				return data
			})

			await BotApi.saveInstruct({
				bot_id: agent.botEntity?.id,
				instructs: newList,
			}).then(() => {
				botStore.setInstructList(newList)
				agent.botEntity.instructs = newList
				magicToast.success(globalT("common.deleteSuccess", { ns: "flow" }))
			})
		},
	)

	// 选择指令
	const selectInstruction = useMemoizedFn(
		(type: InstructionGroupType, val: CommonQuickInstruction) => {
			setCurrentInstruction(val)
			setSelectedValue(val.type)
			setSelectedGroupType(type)
			openEdit()
		},
	)

	// 指令数
	const instructionNum = useMemo(() => {
		return instructionsList.reduce((prev, curr) => {
			return prev + curr.items.length
		}, -1)
	}, [instructionsList])

	const Title = useMemo(() => {
		return edit ? (
			<Flex gap={8} className={styles.title} align="center">
				<MagicIcon
					component={IconChevronLeft}
					className={styles.pointer}
					onClick={handleCancel}
				/>
				<div className={styles.topTitle}>
					{currentInstruction?.id ? t("button.edit") : t("button.add")}
					{t("agent.quickInstruction")}
				</div>
			</Flex>
		) : (
			<Flex vertical gap={8} className={styles.title}>
				<Flex align="center" justify="space-between">
					<div className={styles.topTitle}>{`${t(
						"agent.quickInstruction",
					)} (${instructionNum})`}</div>
					<MagicIcon component={IconX} className={styles.pointer} onClick={setFalse} />
				</Flex>
				<div className={styles.desc}>{t("agent.instructionsDesc")}</div>
			</Flex>
		)
	}, [
		currentInstruction?.id,
		edit,
		handleCancel,
		instructionNum,
		setFalse,
		styles.desc,
		styles.pointer,
		styles.title,
		styles.topTitle,
		t,
	])

	return (
		<>
			{!Icon && (
				<Button type="text" className={btnStyles.btn} onClick={setTrue}>
					{t("agent.quickInstruction")}
				</Button>
			)}
			{Icon && (
				<Flex flex={1} onClick={setTrue}>
					{t("agent.quickInstruction")}
				</Flex>
			)}
			<Drawer
				title={Title}
				className={cx(styles.drawer, {
					[styles.isEmptyDrawer]: instructionsList.length === 0 && !edit,
				})}
				open={open}
				onClose={setFalse}
				width={600}
				closeIcon={null}
				footer={
					edit && (
						<MagicButton type="primary" style={{ width: 100 }} onClick={form.submit}>
							{t("button.save")}
						</MagicButton>
					)
				}
				zIndex={1000}
			>
				{edit && (
					<InstructionForm
						form={form}
						selectedValue={selectedValue}
						options={options}
						currentInstruction={currentInstruction}
						setSelectedValue={setSelectedValue}
						onFinish={onFinish}
						edit={edit}
					/>
				)}
				{!edit && (
					<InstructionList
						instructionsList={instructionsList}
						selectInstruction={selectInstruction}
						addInstruction={addNewInstruction}
						deleteInstruction={deleteInstruction}
						updateInstructsList={save}
					/>
				)}
			</Drawer>
		</>
	)
}

export default observer(QuickInstructionButton)
