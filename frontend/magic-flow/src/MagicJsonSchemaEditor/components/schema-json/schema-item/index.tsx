import { IconEdit } from "@douyinfe/semi-icons"
import { Checkbox, Col, Row, Select, Switch, Tooltip } from "antd"
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import _ from "lodash"
import React, { ReactElement, useContext, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react"
import resolveToString from "@/common/utils/template"
import { MagicExpressionWidget } from "@/index"
import MagicSelect from "@/common/BaseUI/Select"
import MagicInput from "@/common/BaseUI/Input"
import { useExportFields } from "@/MagicJsonSchemaEditor/context/ExportFieldsContext/useExportFields"
import { InputExpressionValue } from "@/MagicExpressionWidget/types"
import { SchemaMobxContext } from "../../.."
import {
	JSONPATH_JOIN_CHAR,
	SchemaValueSplitor,
	ShowColumns,
	childFieldGap,
} from "../../../constants"
import { useGlobal } from "../../../context/GlobalContext/useGlobal"
import Schema, { DisabledField } from "../../../types/Schema"
import { EditorContext } from "../../editor"
import FieldInput from "../../field-input"
import SvgLine from "../../svgLine"
import DropPlus from "../drop-plus"
import useCols from "../hooks/useCols"
import useCurrentFieldSource from "../hooks/useCurrentFieldSource"
import useCustomConfig from "../hooks/useCustomConfig"
import useEncryption from "../hooks/useEncryption"
import usePropertiesLength from "../hooks/usePropertiesLength"
import useSelectOptions from "../hooks/useSelectOptions"
import useSvgLine from "../hooks/useSvgLine"
import { mapping } from "../index"
import { SchemaItemRow, SchemaItemWrap } from "./index.style"
import { getParentKey, canEditField } from "../../../utils/SchemaUtils"

const { Option } = Select

interface SchemaItemProp {
	data: Schema
	name: string
	prefix: string[]
	showEdit: (
		editorName: string[],
		prefix: string,
		propertyElement: string | { mock: string },
		type?: string,
	) => void
	showAdv: (prefix: string[], property?: Schema) => void

	/**
	 * array或者object类型专有
	 * */
	childLength?: number
	isLastSchemaItem?: boolean // 是否是最后行子schema
}

const SchemaItem = observer((props: SchemaItemProp): ReactElement | null => {
	const { data, name, prefix, showAdv, showEdit, isLastSchemaItem = false } = props

	const { t } = useTranslation()

	const { showExportCheckbox, exportFields } = useExportFields()

	const {
		allowAdd,
		disableFields,
		relativeAppendPosition,
		displayColumns = [],
		columnNames,
		showOperation,
	} = useGlobal()

	const { LabelCol, TypeCol, ValueCol, DescCol } = useCols()

	const getPrefix = useMemoizedFn(() => {
		return [...prefix].concat(name)
	})

	// 当前行距离左侧的gap
	const [leftGap, setLeftGap] = useState(0)

	const [value, setValue] = useState({} as any)

	const context = useContext(EditorContext)
	const mobxContext = useContext(SchemaMobxContext)

	// 获取父级字段
	const parentKeys = getParentKey(prefix)
	const parentField = parentKeys.length
		? _.get(mobxContext.schema, parentKeys)
		: mobxContext.schema

	const { allowExpression, expressionSource } = context
	const { currentFieldExpressionSource } = useCurrentFieldSource({
		curFieldKeys: [...getPrefix()],
	})

	const { selectOptions } = useSelectOptions()

	const selectValue = useMemo(() => {
		return value.items ? `${value.type}${SchemaValueSplitor}${value.items.type}` : value.type
	}, [value])

	const {
		expressionSourceWithDefaultOptions,
		_onlyExpression,
		_allowOperation,
		canAddSubFields,
		_constantDataSource,
	} = useCustomConfig({ value, name, type: selectValue })

	const { propertiesLength } = usePropertiesLength({ prefix })

	useEffect(() => {
		setLeftGap(childFieldGap * propertiesLength)
	}, [propertiesLength])

	// 修改节点字段名
	const handleChangeName = (e: any, newValue: any) => {
		mobxContext.changeName({ keys: prefix, name, value: newValue })
		exportFields.changeName({ keys: prefix, name, value: newValue })
		return true
	}

	const handleChangeValue = useMemoizedFn((keys: string[], val: any) => {
		if (keys.length === 0) return
		const key = keys[0]
		setValue({ ...value, [key]: val })
	})

	// 修改数据类型
	const handleChangeType = useMemoizedFn((newValue: any) => {
		const keys = getPrefix().concat("type")

		const [type, itemsType] = newValue.split(SchemaValueSplitor)

		mobxContext.changeType({ keys, value: type, itemsType })
		exportFields.changeType({ keys, value: type, itemsType })
	})

	const handleDeleteItem = useMemoizedFn(() => {
		mobxContext.deleteField({ keys: getPrefix() })
		mobxContext.enableRequire({ keys: prefix, name, required: false })
		exportFields.deleteField({ keys: getPrefix() })
		exportFields.enableRequire({ keys: prefix, name, required: false })
	})

	/*
    展示备注编辑弹窗
    editorName: 弹窗名称 ['description', 'mock']
    type: 如果当前字段是object || array showEdit 不可用
    */
	const handleShowEdit = (editorName: string, type?: string) => {
		// @ts-ignore
		showEdit(getPrefix(), editorName, data.properties[name][editorName], type)
	}

	//  增加子节点
	const handleAddField = (type: string) => {
		if (type === "object") {
			return
		}

		mobxContext.addField({
			keys: prefix,
			name,
			position: relativeAppendPosition,
		})
		exportFields.addField({
			keys: prefix,
			name,
			position: relativeAppendPosition,
		})
	}

	// 控制三角形按钮
	const handleClickIcon = () => {
		// 数据存储在 properties.xxx.properties 下
		const keyArr = [...getPrefix()].concat("properties")
		mobxContext.setOpenValue({ key: keyArr })
	}

	// 修改是否必须
	const handleEnableRequire = useMemoizedFn((checked: any) => {
		mobxContext.enableRequire({ keys: prefix, name, required: checked })
		exportFields.enableRequire({ keys: prefix, name, required: checked })
	})

	const handleEnableEncryption = useMemoizedFn((checked: boolean) => {
		mobxContext.enableRequire({ keys: prefix, name, required: checked })
	})

	useEffect(() => {
		// console.error(
		//   'data change',
		//   JSON.parse(JSON.stringify(data.properties[name])),
		// )
		// @ts-ignore
		setValue({ ...data.properties[name] })
	}, [data, name])

	const prefixArray = [...prefix].concat(name)

	const prefixArrayStr = [...prefixArray].concat("properties").join(JSONPATH_JOIN_CHAR)

	useEffect(() => {
		// console.error(value);
		// console.log('DisabledField', disableFields);
	}, [disableFields])

	/**
	 * 新值与旧值是否相等
	 */
	const judgeIsEqualObject = () => {
		const curKeys = [...getPrefix()]
		const oldValue = _.get(mobxContext.schema, [...curKeys], null)
		// console.log(JSON.parse(JSON.stringify(oldValue)), JSON.parse(JSON.stringify(value)))
		return JSON.stringify(oldValue) === JSON.stringify(value)
	}

	const handleBlur = useMemoizedFn((e: any) => {
		if (showExportCheckbox) return
		e.stopPropagation()
		const curKeys = [...getPrefix()]
		if (judgeIsEqualObject()) return
		mobxContext.changeValue({ keys: curKeys, value })
		exportFields.changeValue({ keys: curKeys, value })
	})

	const handleExpressionValueChange = useMemoizedFn((keys: string[], newValue: any) => {
		const curKeys = [...getPrefix()].concat(keys)
		// if (judgeIsEqualObject()) return
		mobxContext.changeValue({ keys: curKeys, value: newValue })
		exportFields.changeValue({ keys: curKeys, value: newValue })
	})

	// 等待gap计算完才渲染
	const canRender = useMemo(() => {
		return propertiesLength === 0 || leftGap > 0
	}, [leftGap, propertiesLength])

	// 横线
	const { rowSvgLineProps } = useSvgLine({ propertiesLength })

	const showSvgLine = useMemo(() => {
		return propertiesLength > 0 && !isLastSchemaItem
	}, [propertiesLength, isLastSchemaItem])

	const isChecked = useMemo(() => {
		const inExportFields = _.get(exportFields.schema, [...getPrefix()], false)

		return !!inExportFields
	}, [exportFields.schema, getPrefix])

	/** 同步更新其他的属性
	 * 删除时：同步更新required
	 * 新增时：更新required，并且携带上路径相关的schema参数
	 */
	const updateExportFieldsRecursively = useMemoizedFn(
		(keys: string[], type: "add" | "delete", beforeKeys = [] as string[]) => {
			const curKey = keys.shift()
			if (type === "delete" && keys.length === 0) return
			if (curKey) {
				beforeKeys.push(curKey)
				const curFieldSchema = _.get(exportFields.schema, [...beforeKeys], null)
				if (curKey !== "properties") {
					/** 如果不是properties时，需要携带上字段的其他参数 */
					if (!curFieldSchema) {
						const curKeysArguments = _.get(mobxContext.schema, [...beforeKeys], null)
						if (curKeysArguments) {
							/** 路径上的不需要properties，最后一个field需要携带上properties属性 */
							const withoutPropertiesArgs =
								keys.length > 0
									? (_.omit(curKeysArguments, "properties") as any)
									: curKeysArguments
							exportFields.changeValue({
								keys: beforeKeys,
								value: withoutPropertiesArgs,
							})
						}
					}
				} else {
					/** 如果是properties，则需要拿到当前的properties, 变更required属性 */

					// 当前已经存在的properties字段
					const existSchemaKeys = [...Object.keys(curFieldSchema || {})]
					if (keys.length > 0 && type === "add") {
						existSchemaKeys.push(keys[0])
					}

					const parentSchemaKeys = [...beforeKeys].slice(0, -1)
					/** 以实际表单的为参考 */
					const parentRealSchema = _.get(mobxContext.schema, [...parentSchemaKeys], null)
					const parentExportSchema = _.get(
						exportFields.schema,
						[...parentSchemaKeys],
						null,
					)
					/** 将不存在当前需要导出的properties字段的required字段过滤掉 */
					_.set(
						parentExportSchema,
						["required"],
						parentRealSchema?.required?.filter((requiredKey: string) => {
							return existSchemaKeys.includes(requiredKey)
						}),
					)
				}
				updateExportFieldsRecursively(keys, type, beforeKeys)
			}
		},
	)

	const updateExportFields = useMemoizedFn(() => {
		const curKeys = [...getPrefix()]
		const currentExportField = _.get(mobxContext.schema, [...curKeys], null)
		if (isChecked) {
			exportFields.deleteField({ keys: curKeys })
		}
		if (currentExportField) {
			updateExportFieldsRecursively(curKeys, isChecked ? "delete" : "add")
		}
	})

	const { disableEncryption, encryptionTooltips } = useEncryption({ value })

	// render代码
	if (!canRender) {
		return null
	}

	return (
		<SchemaItemWrap onBlur={handleBlur} className="schema-item-wrap">
			<Row
				gutter={11}
				align="middle"
				className="json-schema-item"
				style={{ margin: 0, marginTop: "10px" }}
			>
				<Col span={22}>
					{showSvgLine && <SvgLine {...rowSvgLineProps} className="row-line" />}
					<SchemaItemRow
						gutter={11}
						align="middle"
						leftGap={leftGap}
						showExportCheckbox={showExportCheckbox}
					>
						{showExportCheckbox && (
							<Checkbox
								className="json-schema-field-check"
								checked={isChecked}
								onClick={updateExportFields}
							/>
						)}
						{displayColumns.includes(ShowColumns.Key) && (
							<Col span={5}>
								<Row
									justify="space-around"
									align="middle"
									className="field-name key-col"
								>
									<Col flex="auto">
										<FieldInput
											onChange={handleChangeName}
											value={name}
											disabled={
												disableFields.includes(DisabledField.Name) ||
												!canEditField(parentField)
											}
										/>
									</Col>
								</Row>
							</Col>
						)}

						{displayColumns.includes(ShowColumns.Label) && (
							<Col span={LabelCol} className="label-col">
								<MagicInput
									placeholder={resolveToString(
										i18next.t("flow.pleaseInputSomething", {
											ns: "magicFlow",
										}),
										{
											name: columnNames[ShowColumns.Label],
										},
									)}
									value={value.title}
									onChange={(event: any) =>
										handleChangeValue(["title"], event.target.value)
									}
									disabled={disableFields.includes(DisabledField.Title)}
								/>
							</Col>
						)}

						{displayColumns.includes(ShowColumns.Type) && (
							<Col span={TypeCol} className="type-col">
								<MagicSelect
									style={{ width: "100%" }}
									onChange={handleChangeType}
									value={selectValue}
									disabled={
										disableFields.includes(DisabledField.Type) ||
										!canEditField(parentField)
									}
								>
									{selectOptions.map((item) => {
										return (
											<Option value={item.value} key={item.value}>
												{item.label}
											</Option>
										)
									})}
								</MagicSelect>
							</Col>
						)}

						{displayColumns.includes(ShowColumns.Required) && (
							<Col flex="50px" className="required-col">
								<Tooltip
									placement="top"
									title={i18next.t("common.required", {
										ns: "magicFlow",
									})}
								>
									<Switch
										style={{ paddingLeft: 0 }}
										onChange={(val) => handleEnableRequire(val)}
										disabled={disableFields.includes(DisabledField.Required)}
										checked={
											!data.required
												? false
												: data.required?.indexOf?.(name) !== -1
										}
									/>
								</Tooltip>
							</Col>
						)}
						{displayColumns.includes(ShowColumns.Encryption) && (
							<Col flex="50px" className="encryption-col">
								<Tooltip title={encryptionTooltips}>
									<Switch
										style={{ paddingLeft: 0 }}
										onChange={(val) => {
											handleChangeValue(["encryption"], val)
										}}
										disabled={disableEncryption}
										checked={value.encryption}
									/>
								</Tooltip>
							</Col>
						)}

						{displayColumns.includes(ShowColumns.Value) && (
							<Col span={ValueCol} className="value-col">
								<MagicExpressionWidget
									value={value.value}
									onChange={(val: InputExpressionValue) =>
										handleExpressionValueChange(["value"], val)
									}
									placeholder={resolveToString(
										i18next.t("flow.pleaseInputSomething", {
											ns: "magicFlow",
										}),
										{
											name: columnNames[ShowColumns.Value],
										},
									)}
									dataSource={expressionSourceWithDefaultOptions}
									allowExpression={allowExpression}
									allowModifyField
									onlyExpression={_onlyExpression}
									constantDataSource={_constantDataSource}
									encryption={value?.encryption}
									hasEncryptionValue={!!value?.encryption_value}
								/>
							</Col>
						)}

						{displayColumns.includes(ShowColumns.Description) && (
							<Col span={DescCol}>
								<MagicInput
									suffix={
										<IconEdit
											className="input-icon-editor"
											onClick={() => handleShowEdit("description")}
										/>
									}
									placeholder={i18next.t("common.descPlaceholder", {
										ns: "magicFlow",
									})}
									value={value.description}
									onChange={(event: any) =>
										handleChangeValue(["description"], event.target.value)
									}
									disabled={disableFields.includes(DisabledField.Description)}
								/>
							</Col>
						)}
					</SchemaItemRow>
				</Col>

				{showOperation && (
					<Col flex="70px" className="json-schema-operator">
						{_allowOperation && (
							<>
								{allowAdd && (
									<span
										className="add"
										onClick={() => handleAddField(value.type)}
									>
										{canAddSubFields ? (
											// @ts-ignore
											<DropPlus prefix={prefix} name={name} />
										) : (
											<Tooltip
												placement="top"
												title={i18next.t("jsonSchema.addSiblingField", {
													ns: "magicFlow",
												})}
											>
												<IconCirclePlus
													stroke={1}
													size={20}
													color="#315CEC"
												/>
											</Tooltip>
										)}
									</span>
								)}
								<span className="delete" onClick={handleDeleteItem}>
									<IconCircleMinus stroke={1} size={20} color="#1C1D2399" />
								</span>
							</>
						)}
					</Col>
				)}
			</Row>
			<div>{mapping(prefixArray, value, showEdit, showAdv, true)}</div>
		</SchemaItemWrap>
	)
})

export default SchemaItem
