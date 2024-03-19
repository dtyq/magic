/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { useControllableValue, useMemoizedFn, useUpdateEffect } from "ahooks"
import { Cascader, ConfigProvider, Modal } from "antd"
import "antd/dist/reset.css"
// import { FIELDS_NAME, VALUE_TYPE } from "cai-json-edit/dist/JsonSchemaEditor/constants"
import _, { cloneDeep, isEqual } from "lodash"
import React, { useEffect, useMemo, useRef, useState } from "react"
import ContentEditable from "./components/ContentEditable"
import { ExpressionMode, defaultExpressionValue } from "./constant"
import { GlobalProvider } from "./context/GlobalContext/Provider"
import { TextareaModeProvider } from "./context/TextareaMode/Provider"
import { getDataSourceMap } from "./helpers"
import useTextareaMode from "./hooks/useTextareaMode"
import { EditWrapper, InputExpressionStyle } from "./style"

import CascaderDropdown from "@/common/BaseUI/DropdownRenderer/Reference"
import { multipleTypes } from "@/common/BaseUI/DropdownRenderer/Reference/hooks/useRender"
import ErrorContent from "@/common/BaseUI/ErrorComponent/ErrorComponent"
import MagicSelect from "@/common/BaseUI/Select"
import { useNodeMap } from "@/common/context/NodeMap/useResize"
import { generateSnowFlake } from "@/common/utils/snowflake"
import { IconChevronDown } from "@douyinfe/semi-icons"
import i18next from "i18next"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"
import EditInModal from "./components/EditInModal"
import ExpandModal from "./components/ExpandModal/ExpandModal"
import { ArgsModalProvider } from "./context/ArgsModalContext/Provider"
import useArgsModal, { PopoverModalContent } from "./hooks/useArgsModal"
import type {
	ChangeRef,
	EXPRESSION_ITEM,
	EXPRESSION_VALUE,
	EditRef,
	ExpressionSource,
	InputExpressionProps,
	InputExpressionValue,
} from "./types"
import { FIELDS_NAME, LabelTypeMap, VALUE_TYPE } from "./types"
import { filterEmptyValues, filterNullValue, parseSizeToNumber, transferSpecialSign } from "./utils"
import { CLASSNAME_PREFIX } from "@/common/constants"
import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"
import { useReactFlow } from "reactflow"

const CustomInputExpression = (props: InputExpressionProps) => {
	const {
		disabled = false,
		dataSource = [],
		placeholder = "",
		inputPlaceholder = i18next.t("common.expressionPlaceholder", { ns: "magicFlow" }),
		referencePlaceholder = i18next.t("common.expressionPlaceholder", { ns: "magicFlow" }),
		bordered = true,
		mode = ExpressionMode.Common,
		pointedValueType,
		allowExpression = true,
		allowModifyField = false,
		multiple = true,
		value: propVal,
		onChange: changeFunc,
		onlyExpression,
		minHeight,
		maxHeight = "600px",
		withSchemaType = false,
		constantDataSource,
		allowOpenModal,
		showMultipleLine = true,
		renderConfig,
		encryption = false,
		hasEncryptionValue = false,
		showExpand = false,
		isInFlow = true,
		// 参数值设置
	} = props

	const { t } = useTranslation()

	const { nodeMap } = useNodeMap()

	const { getZoom } = useReactFlow()
	const currentZoom = getZoom()
	// 将maxHeight统一转换为数字
	const parsedMaxHeight = useMemo(() => parseSizeToNumber(maxHeight), [maxHeight])

	// 过滤初始空值
	const filterValue = useMemo(() => {
		if (!propVal) return null
		const cloneValue = _.cloneDeep(propVal) as InputExpressionValue
		cloneValue.const_value = filterEmptyValues(cloneValue.const_value)
		cloneValue.expression_value = filterEmptyValues(cloneValue.expression_value)

		return cloneValue
	}, [propVal])

	// 当清空值时，需要记录当前的值类型
	const [lastValueType, setLastValueType] = useState(VALUE_TYPE.CONST)

	const [expressionVal, onChange] = useControllableValue({
		value: filterValue || { ...defaultExpressionValue, type: lastValueType },
		onChange: changeFunc || (() => {}),
	})

	// useEffect(() => {
	// 	console.log("value changed", expressionVal, allowExpression)
	// }, [expressionVal, allowExpression])

	// useEffect(() => {
	// 	console.log("allowExpression changed", allowExpression)
	// }, [allowExpression])

	const editRef = useRef({} as EditRef)
	const [open, setOpen] = useState(false)
	const changeRef = useRef({} as ChangeRef)
	const lastDate = useRef<InputExpressionValue>()
	const inputRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const cleanup = flowEventBus.on(FLOW_EVENTS.NODE_SELECTED, () => {
			setOpen(false)
		})
		return () => {
			cleanup()
		}
	}, [])

	const [displayOptions, setDisplayOptions] = useState([] as ExpressionSource)
	const [showPlaceholder, setShowPlaceholder] = useState(false)

	const [allowExpressionGlobal, setAllowExpressionGlobal] = useState(allowExpression)

	const valueFieldName = useMemo(() => {
		// 业务指定了类型，直接使用该类型
		if (pointedValueType) return pointedValueType
		if (!expressionVal) return FIELDS_NAME[VALUE_TYPE.CONST]
		return FIELDS_NAME[expressionVal.type] as keyof InputExpressionValue
	}, [expressionVal, pointedValueType])

	const currentPlaceholder = useMemo(() => {
		if (placeholder) return placeholder
		if (expressionVal.type === VALUE_TYPE.CONST) return inputPlaceholder
		return referencePlaceholder
	}, [placeholder, inputPlaceholder, referencePlaceholder, expressionVal])

	const value = useMemo(() => {
		if (!expressionVal) return [] as EXPRESSION_VALUE[]
		return expressionVal[
			valueFieldName as keyof Omit<InputExpressionValue, "type">
		] as EXPRESSION_VALUE[]
	}, [expressionVal, valueFieldName])

	const valueType = useMemo(() => {
		if (pointedValueType === "const_value") return VALUE_TYPE.CONST
		if (!expressionVal) return VALUE_TYPE.CONST
		return expressionVal.type
	}, [expressionVal])

	const handleValueTypeChange = useMemoizedFn((valType: VALUE_TYPE) => {
		if (!expressionVal) {
			console.error("initial value cannot be null")
			return
		}
		lastDate.current = expressionVal
		onChange({
			...expressionVal,
			type: valType,
		})
	})

	const _dataSource = useMemo(() => {
		if (valueType === VALUE_TYPE.CONST && constantDataSource?.length) return constantDataSource
		if (valueType === VALUE_TYPE.EXPRESSION) {
			return [...dataSource]
		}
		return dataSource
	}, [valueType, constantDataSource, dataSource])

	const {
		extraCascaderProps,
		closeSelectPanel,
		withPopOver,
		openSelectPanel,
		handleDoubleClickNode,
		closeCurrentNodeEdit,
		patchToAddLabel,
		userInput,
	} = useTextareaMode({
		mode,
		options: _dataSource,
		onChange,
		valueFieldName,
		expressionVal,
		allowModifyField,
		disabled,
		valueType,
		editRef,
	})

	const insertLabel = useMemoizedFn((val: EXPRESSION_VALUE) => {
		const copyValue = cloneDeep(value as EXPRESSION_VALUE[]) || ([] as EXPRESSION_VALUE[])

		let resultValue: EXPRESSION_VALUE[] = []
		const {
			type,
			offset = 0,
			prevId,
			nextId,
			id: currentId,
		} = editRef?.current?.getCursor() || {}

		const selectedNodeId = editRef?.current?.getCurrentNode?.()
		const existItem = copyValue.find((item: EXPRESSION_VALUE) => item.uniqueId === currentId)

		if (
			expressionVal.type === VALUE_TYPE.CONST &&
			multipleTypes.includes(renderConfig?.type!)
		) {
			const renderType = renderConfig?.type!
			const foundItem = expressionVal.const_value?.find(
				(v: EXPRESSION_VALUE) => v.type === renderType,
			)
			if (foundItem) {
				const oldValue = foundItem[`${renderType}_value`] || []
				let newValue = val[`${renderType}_value`] || []

				// 处理选择引用值的情况
				if (val.type === LabelTypeMap.LabelFunc || val.type === LabelTypeMap.LabelNode) {
					newValue = _.castArray(val)
				}

				return [
					{
						type: renderConfig?.type!,
						uniqueId: foundItem.uniqueId,
						[`${renderType}_value`]: [...oldValue, ...newValue],
						value: "",
					},
				]
			}
		}
		// 当有选择了某个块，优先进行替换
		if (selectedNodeId) {
			const index = copyValue.findIndex(
				(item: EXPRESSION_ITEM) => item.uniqueId === selectedNodeId,
			)
			if (index > -1) {
				copyValue.splice(index, 1, val)
				resultValue = copyValue
				// 重置光标以及选中的元素
				editRef?.current?.setCursor({ id: "", type: "", offset: -1 })
				editRef?.current?.setCurrentNode?.("")
			}
		}
		// 数据不存在，且没有next和prev的关系，直接push
		else if (!editRef.current || (!currentId && !prevId && !nextId)) {
			copyValue.push(val)
			resultValue = copyValue
		}
		// 数据不存在，存在next和prev的关系
		else if (!existItem) {
			let p = -1
			if (prevId) {
				p = copyValue.findIndex((item: EXPRESSION_VALUE) => item.uniqueId === prevId)
				if (p > -1) copyValue.splice(p + 1, 0, val)
			} else if (p < 0 && nextId) {
				p = copyValue.findIndex((item: EXPRESSION_VALUE) => item.uniqueId === nextId)
				if (p === 0) copyValue.unshift(val)
				if (p > 0) copyValue.splice(p, 0, val)
			}

			if (p < 0) copyValue.push(val)
			resultValue = copyValue
		}
		// 处理兜底情况，在中间插入内容时
		else {
			resultValue = copyValue.reduce((res, item) => {
				if (item.uniqueId !== currentId) {
					res.push(item)
					return res
				}

				if (offset === 0) {
					res.push(val)
					res.push(item)
					return res
				}

				if (offset === -1 || offset === item.value.length) {
					res.push(item)
					res.push(val)
					return res
				}

				const leftValue = transferSpecialSign(item.value.slice(0, offset))
				const rightValue = transferSpecialSign(item.value.substr(offset))
				const newId = generateSnowFlake()
				res.push({
					...item,
					// 将 < 和 > 替换为 HTML 实体，防止作为 HTML 解析
					value: leftValue,
				})
				// console.log(
				// 	"Slice Item",
				// 	item.value.slice(0, offset),
				// 	"$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$",
				// 	item.value.substr(offset),
				// )
				res.push(val)
				res.push({
					...item,
					uniqueId: newId,
					// 将 < 和 > 替换为 HTML 实体，防止作为 HTML 解析
					value: rightValue,
				})
				return res
			}, [] as EXPRESSION_VALUE[])
		}
		// 需要统一进行一次转换处理，避免存储<和>，让浏览器识别为元素
		return resultValue.map((val) => {
			if (val.type === LabelTypeMap.LabelText) {
				val.value = transferSpecialSign(val.value)
			}
			return val
		})
	})

	const getDataSource = useMemoizedFn(() => {
		return _dataSource
	})

	const dataSourceMap = useMemo(() => {
		return getDataSourceMap(_dataSource || [])
	}, [_dataSource])

	const insertValue = useMemoizedFn((val: EXPRESSION_VALUE) => {
		setOpen(false)
		// 开启了多选且不是表达式的情况下
		if (!multiple && valueType === VALUE_TYPE.CONST) {
			onChange({
				...expressionVal,
				[valueFieldName]: [val],
			})
			return
		}

		if (val.type === LabelTypeMap.LabelFunc) {
			// 当插入的函数节点
			const argsLength = val?.rawOption?.arg?.length || 0
			// 插入默认的表达式数据格式
			val.args = Array(argsLength).fill(defaultExpressionValue)
			// 用完删除原始数据源
			delete val.rawOption
		}

		const newValue = insertLabel(val)

		const filteredVal = filterNullValue(newValue)
		const updatedExpressionVal = {
			...expressionVal,
			[valueFieldName]: filteredVal,
		}

		patchToAddLabel(updatedExpressionVal)

		onChange(updatedExpressionVal)
	})

	/** mode为common时添加块元素的方法 */
	const handleAddLabel = useMemoizedFn(
		// @ts-ignore
		(val, selectedOptions) => {
			const newNode = {
				uniqueId: generateSnowFlake(),
				type: val[0] || LabelTypeMap.LabelText,
				value: selectedOptions[selectedOptions.length - 1].value,
				name: selectedOptions[selectedOptions.length - 1].name,
				node_id: "",
			}
			if (!multiple) {
				onChange({
					...expressionVal,
					[valueFieldName]: [newNode],
				})
				return
			}
			if (val[0].includes(LabelTypeMap.LabelFunc)) {
				// 当插入的函数节点
				const argsLength = selectedOptions[selectedOptions.length - 1]?.arg?.length || 0
				// 插入默认的表达式数据格式
				// @ts-ignore
				newNode.args = Array(argsLength).fill(defaultExpressionValue)
			}

			const resultValue = insertLabel(newNode)

			onChange({
				...expressionVal,
				[valueFieldName]: resultValue,
			})
		},
	)

	const handleChange = useMemoizedFn((val: EXPRESSION_VALUE[]) => {
		// console.error("lastDate.current", lastDate.current)
		lastDate.current = val as any
		const filteredVal = val.filter((v) => v?.value !== "\n")
		console.log("filteredVal", filteredVal)
		if (filteredVal.length === 0) {
			setLastValueType(expressionVal?.type)
			onChange(null as any)
		} else {
			onChange({
				...expressionVal,
				[valueFieldName]: filteredVal,
			})
		}
	})

	const hiddenPlaceholder = useMemoizedFn(() => {
		setShowPlaceholder(false)
	})

	useEffect(() => {
		if (encryption) {
			hiddenPlaceholder()
		}
	}, [encryption])

	useEffect(() => {
		const copyValue = Array.isArray(value) ? cloneDeep(value) : []
		setShowPlaceholder(!copyValue.length)

		// 只在值真正改变时才更新
		// console.log(!isEqual(copyValue, lastDate.current), copyValue, lastDate.current)
		if (!isEqual(copyValue, lastDate.current)) {
			copyValue.forEach((item) => {
				item.uniqueId = item.uniqueId || generateSnowFlake()
			})
			const filterValues = filterEmptyValues(copyValue)
			editRef.current?.updateDisplayValue(filterValues)
			lastDate.current = copyValue as any
		}
	}, [value])

	useEffect(() => {
		Object.assign(changeRef.current, {
			handleChange,
			hiddenPlaceholder,
			getDataSource,
		})
	}, [handleChange, getDataSource, hiddenPlaceholder])

	const isCascaderDisableSelect = useMemo(() => {
		return disabled
	}, [disabled])

	// 是否显示切换器
	const showSwitch = useMemo(() => {
		return allowExpression && mode !== ExpressionMode.TextArea && !onlyExpression
	}, [allowExpression, mode, onlyExpression])

	/** 弹层位置 */
	const [position, setPosition] = useState({
		left: 0,
		top: 0,
	})

	const {
		isOpenArgsModal,
		openArgsModal,
		onConfirm,
		onPopoverModalClick,
		closeArgsModal,
		argValue,
		handleChangeArg,
	} = useArgsModal({
		handleChange,
		value,
	})

	return (
		<ErrorBoundary
			fallbackRender={({ error }) => {
				console.log("error", error)
				return <ErrorContent />
			}}
		>
			<ConfigProvider prefixCls={CLASSNAME_PREFIX}>
				<ArgsModalProvider
					isOpenArgsModal={isOpenArgsModal}
					openArgsModal={openArgsModal}
					onConfirm={onConfirm}
					onPopoverModalClick={onPopoverModalClick}
					closeArgsModal={closeArgsModal}
				>
					<GlobalProvider
						dataSource={_dataSource || ([] as ExpressionSource)}
						allowExpression={allowExpression}
						setAllowExpressionGlobal={setAllowExpressionGlobal}
						mode={mode}
						dataSourceMap={dataSourceMap}
						showMultipleLine={showMultipleLine}
						disabled={disabled}
						zoom={currentZoom}
						renderConfig={renderConfig}
						encryption={encryption}
						hasEncryptionValue={hasEncryptionValue}
						rawProps={props}
						selectPanelOpen={extraCascaderProps.open}
						isInFlow={isInFlow}
					>
						<TextareaModeProvider
							withPopOver={withPopOver}
							openSelectPanel={openSelectPanel}
							closeSelectPanel={closeSelectPanel}
							handleDoubleClickNode={handleDoubleClickNode}
							closeCurrentNodeEdit={closeCurrentNodeEdit}
						>
							<InputExpressionStyle
								disabled={disabled}
								isShowPlaceholder={showPlaceholder}
								placeholder={currentPlaceholder}
								bordered={bordered}
								mode={mode}
								showSwitch={showSwitch}
								maxHeight={maxHeight}
								ref={inputRef}
							>
								<EditWrapper
									disabled={disabled}
									className={props.wrapperClassName || ""}
									position={position}
									mode={mode}
									renderConfig={renderConfig}
									maxHeight={parsedMaxHeight}
								>
									{showSwitch && (
										<MagicSelect
											options={[
												{
													label: i18next.t("expression.const", {
														ns: "magicFlow",
													}),
													value: VALUE_TYPE.CONST,
												},
												{
													label: i18next.t("expression.expression", {
														ns: "magicFlow",
													}),
													value: VALUE_TYPE.EXPRESSION,
												},
											]}
											className="type-select"
											suffixIcon={<IconChevronDown />}
											onChange={handleValueTypeChange}
											disabled={disabled}
											value={valueType}
										/>
									)}
									{/* 使用新的 ExpandModal 组件替换原有的放大按钮 */}
									{showExpand && (
										<ExpandModal
											value={expressionVal}
											onChange={onChange}
											componentProps={props}
										/>
									)}
									<Cascader
										open={open}
										value={[]}
										// @ts-ignore
										options={displayOptions}
										onChange={handleAddLabel}
										disabled={isCascaderDisableSelect}
										getPopupContainer={(triggerNode) => triggerNode.parentNode}
										dropdownRender={(menu) => (
											<CascaderDropdown
												editRef={editRef}
												dataSource={_dataSource}
												onChange={insertValue}
												nodeMap={nodeMap}
												withSchemaType={withSchemaType}
												userInput={userInput}
												renderConfig={renderConfig}
												valueType={valueType}
												// 用于给内部判断是否需要显示弹层(比如部门选择器)
												dropdownOpen={extraCascaderProps?.open}
											/>
										)}
										{...extraCascaderProps}
									>
										<div
											className={`editable-container ${
												!showMultipleLine ? "only-one-line" : ""
											}`}
											onClick={(e) => e.stopPropagation()}
										>
											<ContentEditable
												ref={editRef}
												changeRef={changeRef}
												bordered={bordered}
												mode={mode}
												minHeight={minHeight}
												setPosition={setPosition}
												inputRef={inputRef}
											/>

											{allowOpenModal && (
												<EditInModal
													{...props}
													value={expressionVal}
													onChange={onChange}
												/>
											)}
											{isOpenArgsModal && (
												<Modal
													title={i18next.t("expression.setArguments", {
														ns: "magicFlow",
													})}
													open={isOpenArgsModal}
													onOk={onConfirm}
													onCancel={closeArgsModal}
												>
													<PopoverModalContent
														value={argValue}
														onChange={handleChangeArg}
														rawProps={props}
													/>
												</Modal>
											)}
										</div>
									</Cascader>
								</EditWrapper>
							</InputExpressionStyle>
						</TextareaModeProvider>
					</GlobalProvider>
				</ArgsModalProvider>
			</ConfigProvider>
		</ErrorBoundary>
	)
}
export default CustomInputExpression
