/* eslint-disable guard-for-in */
/**
 * 管理 表达式组件处于处于Textarea模式时的相关状态
 */
import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference"
import { Splitor } from "@/common/BaseUI/DropdownRenderer/Reference/constants"
import { Input, InputRef, Popover } from "antd"
import { useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import _ from "lodash"
import React, { MutableRefObject, useEffect, useMemo, useRef, useState } from "react"
import {
	ExpressionMode,
	KeyCodeMap,
	TextAreaModePanelHeight,
	TextAreaModeTrigger,
} from "../constant"
import { findRootNodeAndValueByValue, findTargetTriggerField, getLastName } from "../helpers"
import {
	EXPRESSION_ITEM,
	EXPRESSION_VALUE,
	EditRef,
	FIELDS_NAME,
	InputExpressionValue,
	VALUE_TYPE,
} from "../types"
import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"

interface Option {
	value: string
	label: string
	children?: Option[]
}

type UseTextareaModeProps = {
	mode: ExpressionMode
	options: DataSourceOption[]
	onChange: (value: InputExpressionValue) => void
	valueFieldName: keyof InputExpressionValue
	expressionVal: InputExpressionValue
	allowModifyField: boolean
	disabled: boolean
	valueType: VALUE_TYPE
	editRef: React.MutableRefObject<EditRef>
}

export type SelectPanelRef = {
	openSelectPanel: () => void
	closeSelectPanel: () => void
	withPopOver: (WrappedComponent: React.ReactNode, config: EXPRESSION_ITEM) => React.ReactNode
}

export default function useTextareaMode({
	mode,
	options,
	onChange,
	valueFieldName,
	expressionVal,
	allowModifyField,
	disabled,
	valueType,
	editRef,
}: UseTextareaModeProps) {
	const selectPanelRef = useRef<SelectPanelRef>({} as SelectPanelRef)
	const [selectPanelHeight, setSelectPanelHeight] = useState(TextAreaModePanelHeight)
	/** 是否弹出编辑层map */
	const [popVisibleMap, setPopVisibleMap] = useState({} as Record<string, boolean>)
	/** 动态的inputRef */
	const [inputRefMap, setInputRefMap] = useState({} as Record<string, MutableRefObject<InputRef>>)
	/** 当前正在编辑的节点 */
	const [currentNode, setCurrentNode] = useState({} as EXPRESSION_ITEM)
	const [inputValue, setInputValue] = useState("")
	/** 当前Trigger的标志 */
	const [currentTrigger, setCurrentTrigger, resetCurrentTrigger] = useResetState({
		uniqueId: "",
		offset: -1,
	})

	/** 是否打开dropdown */
	const [openDropdown, setOpenDropdown] = useState(false)

	/** @后面的文本 */
	const [userInput, setUserInput] = useState([] as string[])

	/** 关闭当前编辑弹出层 */
	const closeCurrentNodeEdit = useMemoizedFn(() => {
		if (!currentNode || !currentNode.uniqueId) return
		/** 关闭编辑层 */
		setPopVisibleMap({
			...popVisibleMap,
			[currentNode.uniqueId]: false,
		})
	})

	/** 监听表达式值变化，判断是否弹出下拉面板 */
	useUpdateEffect(() => {
		const expressionKey = FIELDS_NAME[valueType] as string
		const expressionFields = (expressionVal?.[expressionKey] || []) as EXPRESSION_VALUE[]
		const triggerValue = expressionFields.find((field) =>
			field.value.includes(TextAreaModeTrigger),
		)
		const cursor = editRef?.current?.getCursor?.()
		const targetTriggerField = findTargetTriggerField(expressionFields, cursor)
		if (targetTriggerField) {
			// console.log("targetTriggerField", targetTriggerField, expressionFields)
			setCurrentTrigger(targetTriggerField)
		}
		// 控制是否打开变量引用框
		setOpenDropdown(!!targetTriggerField)
		// 处理用户输入
		if (triggerValue) {
			const userInputAfterTrigger = triggerValue.value.split("@")[1]
			const userInputAfterSplit = userInputAfterTrigger.split(Splitor)
			setUserInput(userInputAfterSplit)
		}
	}, [expressionVal])

	// useUpdateEffect(() => {
	// 	console.log("triggerUpdate", currentTrigger)
	// }, [currentTrigger])

	/** 节点双击 */
	const handleDoubleClickNode = useMemoizedFn((config: EXPRESSION_ITEM) => {
		if (disabled) return
		/** 将之前的关闭 */
		// eslint-disable-next-line no-restricted-syntax
		for (const uniqueId in popVisibleMap) {
			if (popVisibleMap[uniqueId]) _.set(popVisibleMap, uniqueId, false)
		}
		/** 打开双击的节点的编辑面板 */
		_.set(popVisibleMap, config.uniqueId, true)
		// 第一次打开，缓存inputRef
		if (!inputRefMap[config.uniqueId]) {
			_.set(inputRefMap, config.uniqueId, React.createRef())
		}
		setInputValue(config.value)
		setCurrentNode(config)
		setPopVisibleMap({ ...popVisibleMap })

		const currentRef = inputRefMap[config.uniqueId]
		// 已经有ref了，直接focus
		if (currentRef && currentRef.current) {
			setTimeout(() => {
				currentRef.current.focus()
			}, 300)
		}
	})

	/** 打开级联选项面板 */
	const openSelectPanel = useMemoizedFn(() => {
		setOpenDropdown(true)
	})

	/** 关闭级联选项面板 */
	const closeSelectPanel = useMemoizedFn(() => {
		setOpenDropdown(false)
	})

	useEffect(() => {
		const cleanup = flowEventBus.on(FLOW_EVENTS.NODE_SELECTED, () => {
			closeSelectPanel()
		})
		return () => {
			cleanup()
		}
	}, [])
	const onPressEnter = useMemoizedFn((evt: any) => {
		evt.stopPropagation()
		/** 回车保存，并隐藏 */
		if ([KeyCodeMap.ENTER].includes(evt.keyCode)) {
			console.log("currentNode", currentNode)
			console.log("expressionVal", expressionVal)
			if (valueFieldName && expressionVal && currentNode) {
				const curValues = expressionVal[
					valueFieldName as keyof InputExpressionValue
				] as any[]
				if (curValues.length > 0) {
					const found = curValues.find(
						(item) => item.uniqueId === currentNode.uniqueId,
					) as EXPRESSION_VALUE
					if (!found) {
						/** 关闭编辑层 */
						closeCurrentNodeEdit()
						return
					}
					found.value = inputValue

					/** 检查是否命中 */
					const result = findRootNodeAndValueByValue(options, inputValue)
					/** 命中了，重新更改Node节点数据 */
					if (result) {
						// eslint-disable-next-line no-restricted-syntax
						for (const key in result.value) {
							_.set(found, key, result.value[key])
						}
					} else {
						/** 没有命中，以key作为value */
						found.name = getLastName(inputValue)
					}
					onChange({
						...expressionVal,
						[valueFieldName]: curValues,
					})

					/** 关闭编辑层 */
					closeCurrentNodeEdit()
				}
			}
		}
	})

	/** 弹出层内容 */
	const EditContent = useMemoizedFn((id: string) => {
		return (
			<Input
				value={inputValue}
				onChange={(e) => setInputValue(e.target.value)}
				// @ts-ignore
				ref={inputRefMap[id]}
				autoFocus
				onPressEnter={onPressEnter}
				onClick={(e) => {
					e.stopPropagation()
				}}
				onBlur={() => {
					/** 关闭编辑层 */
					closeCurrentNodeEdit()
				}}
			/>
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	})

	/** 提供给下层节点的高阶组件 */
	const withPopOver = useMemoizedFn(
		(WrappedComponent: React.ReactNode, config: EXPRESSION_ITEM) => {
			/** common mode 直接返回原组件 */
			if (!allowModifyField) return WrappedComponent
			const isPopoverVisible = popVisibleMap[config.uniqueId]

			/** textarea mode 需要有弹出层，修改数据 */
			return (
				<Popover
					content={() => EditContent(config.uniqueId)}
					open={isPopoverVisible}
					trigger={undefined}
				>
					{WrappedComponent}
				</Popover>
			)
		},
	)

	selectPanelRef.current = {
		openSelectPanel,
		closeSelectPanel,
		withPopOver,
	}

	/** 新增节点patch函数，用于删除特殊标识符 */
	const patchToAddLabel = useMemoizedFn((updatedExpressionVal: InputExpressionValue) => {
		// 由于是Mode=TextArea时是通过输入 「$ 」，选择完字段需要删除 「$ 」并关闭弹出层
		if (valueFieldName) {
			const curValues = updatedExpressionVal[
				valueFieldName as keyof InputExpressionValue
			] as EXPRESSION_VALUE[]
			if (curValues.length > 0) {
				// console.log("currentTrigger", currentTrigger, curValues)
				/** 直接通过正则替换掉「$ 」*/
				const triggerItem = curValues.find(
					(item) => item.uniqueId === currentTrigger.uniqueId,
				)
				// console.log(
				// 	"curValues",
				// 	curValues,
				// 	triggerItem,
				// 	triggerItem?.value?.replace?.(/\$\s+/, ""),
				// )
				if (!triggerItem) return
				const strArr = triggerItem.value.split("")
				strArr.splice(currentTrigger.offset, 1)
				triggerItem.value = strArr.join("")
				resetCurrentTrigger()
			}
		}
	})

	/** 当处于textarea mode时，需要给原来的cascader提供原有的级联选项 */
	const extraCascaderProps = useMemo(() => {
		return { open: openDropdown } as Record<string, any>
	}, [openDropdown])

	return {
		extraCascaderProps,
		openSelectPanel,
		closeSelectPanel,
		selectPanelRef,
		patchToAddLabel,
		withPopOver,
		handleDoubleClickNode,
		closeCurrentNodeEdit,
		userInput,
	}
}
