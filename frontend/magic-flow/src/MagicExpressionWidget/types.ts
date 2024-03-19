/* eslint-disable @typescript-eslint/naming-convention */

import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference";
import type { ExpressionMode } from "./constant"
import { ReactElement, ReactNode } from "react";
import { MemberSelectProps } from "./components/nodes/LabelMember/MemberSelect/Select";
import { MultipleSelectProps } from "./components/nodes/LabelMultiple/MultipleSelect/Select";
import { TimeSelectProps } from "./components/nodes/LabelDatetime/TimeSelect/type";
import { CheckboxSelectProps } from "./components/nodes/LabelCheckbox/ExpressionCheckbox/types";
import { SingleSelectProps } from "./components/nodes/LabelSelect/SingleSelect/SingleSelect";
import { Department } from "./components/nodes/LabelDepartmentNames/LabelDepartmentNames";
import { NameValue } from "./components/nodes/LabelNames/LabelNames";

// 参数值类型
export const enum VALUE_TYPE {
    CONST = 'const',
    EXPRESSION = 'expression',
}

  // 参数值类型对应的字段名称
export const FIELDS_NAME = {
    [VALUE_TYPE.CONST]: 'const_value',
    [VALUE_TYPE.EXPRESSION]: 'expression_value',
};

export interface CommonField {
	label: string
	value: string
}
export interface ExpressionFields extends CommonField {
	desc?: string
	children?: CommonField[]
}
export interface MethodArgsItem {
	name?: string
	type?: string
	desc?: string
}
export interface MethodsItem extends CommonField {
	return_type?: string
	desc?: string
	arg?: MethodArgsItem[]
}
export interface ExpressionMethods extends CommonField {
	desc: string
	children: MethodsItem[]
}
export declare type ExpressionSourceItem = ExpressionFields & ExpressionMethods
export declare type ExpressionSource = DataSourceOption[]

export const enum ExpressionItemType {
	normal = "fields",
	input = "input",
	func = "methods",
}

export interface EXPRESSION_ITEM {
	type: LabelTypeMap
	value: string
	uniqueId: string
	name?: string
	schemaType?: string
	trans?: string
	[key: string]: any
}

export interface EXPRESSION_VALUE extends EXPRESSION_ITEM {
	args?: InputExpressionValue[]
}

/** 表达式值类型 */
export type InputExpressionValue = {
	type: VALUE_TYPE
	const_value: EXPRESSION_VALUE[]
	expression_value: EXPRESSION_VALUE[]
    [key: string]: any
}

export type NodeBaseInfo = {
    icon: ReactNode,
    name: string
    id: string
}

export type BaseRenderConfig = {
    showExpressionSource?: boolean
}

export interface MemberRenderConfig extends BaseRenderConfig {
	type: LabelTypeMap.LabelMember
	props: MemberSelectProps
}

export interface MultipleRenderConfig extends BaseRenderConfig {
	type: LabelTypeMap.LabelMultiple
	props: MultipleSelectProps
}

export interface DateTimeRenderConfig extends BaseRenderConfig {
	type: LabelTypeMap.LabelDateTime
	props: TimeSelectProps
}

export interface CheckboxRenderConfig extends BaseRenderConfig {
	type: LabelTypeMap.LabelCheckbox
	props: CheckboxSelectProps
}


export interface SelectRenderConfig extends BaseRenderConfig {
	type: LabelTypeMap.LabelSelect
	props: SingleSelectProps
}


export interface DepartmentNamesRenderConfig extends BaseRenderConfig {
	type: LabelTypeMap.LabelDepartmentNames
	props: {
		editComponent: React.FC<{
			isOpen: boolean
			closeModal: () => void
			onChange: (departmentNames: Department[]) => void
            [key: string]: any
		}>
	}
}

export interface NamesRenderConfig extends BaseRenderConfig  {
    type: LabelTypeMap.LabelNames
    props: {
        suffix?: React.FC<NameValue>
        options: MultipleSelectProps['options']
        value: NameValue[]
    }
}


export type RenderConfig = MemberRenderConfig | MultipleRenderConfig | DateTimeRenderConfig | CheckboxRenderConfig | SelectRenderConfig | DepartmentNamesRenderConfig | NamesRenderConfig


/** 表达式组件Props */
export interface InputExpressionProps {
	onChange?: (value: InputExpressionValue) => void
	disabled?: boolean
	dataSource?: ExpressionSource
	/** 常量的数据源 */
	constantDataSource?: ExpressionSource
    /** 优先级最高 */
	placeholder?: string
    /** 为固定值时的占位符 */
    inputPlaceholder?: string
    /** 为表达式时的占位符 */
    referencePlaceholder?: string
	bordered?: boolean
	allowExpression?: boolean
	value?: InputExpressionValue
	mode?: ExpressionMode
    allowModifyField?: boolean

	/** 业务组件可以指定值类型 */
	pointedValueType?: "const_value" | "expression_value",

    /** 是否只支持表达式组件 */
    onlyExpression?: boolean

    /** 是否支持多选 */
    multiple?: boolean

    /** 最小高度 */
    minHeight?: string
    /** 最大高度 */
    maxHeight?: string

	/** 是否携带选项的schema类型，如字符串、数组、布尔值等 */
	withSchemaType?: boolean

	/** 最外层的类名 */
	wrapperClassName?: string

	/** 是否支持打开弹窗编辑 */
	allowOpenModal?: boolean

	/** 是否显示多行 */
	showMultipleLine?: boolean

	renderConfig?: RenderConfig

	/** 是否需要进行加密，需配合MagicJSONSchemaEditor使用 */
	encryption?: boolean
	hasEncryptionValue?: boolean

    /** 是否显示放大视图按钮 */
    showExpand?: boolean

    /** 当前表达式组件是否处于流程内 */
    isInFlow?: boolean
}

export enum LabelTypeMap {
	LabelNode = "fields",
	LabelFunc = "methods",
	LabelText = "input",
	LabelMember = "member", // 成员
	LabelDateTime = 'datetime', // 日期
	LabelMultiple = 'multiple', // 多选
	LabelSelect = "select", // 单选
	LabelCheckbox = "checkbox", // checkbox
	LabelPassword = "password", // 密码
	LabelDepartmentNames = "department_names",
    LabelNames = "names", // 文本块通用类型
}

export interface ChangeRef {
	handleChange: (value: any) => void
	hiddenPlaceholder: () => void
	getDataSource: () => any
}

// 鼠标实例
export interface CursorRef {
	id: string
	type: string
	offset: number
	prevId?: string
	nextId?: string
}

// 编辑实例
export interface EditRef {
	updateDisplayValue: (val: any) => void
	getDisplayValue: () => any
	getCursor: () => CursorRef
	setCursor: (value: CursorRef) => void
	setCurrentNode: (uniqueId: string) => void
	getCurrentNode: () => any
}

/** 验证码Ref */
export interface InputExpressionInstance {}

// 单个项类型
export enum FormItemType {
    // 字符串
    String= 'string',
    // 数值
    Number= 'number',
    // 整数
    Integer = 'integer',
    // 数组
    Array = 'array',
    // 对象
    Object = 'object',
    // 布尔
    Boolean = 'boolean',
}

export type MethodOption = {
	label: string
	value: string
	desc: string
	children: MethodOption[]
	arg: MethodArgsItem[]
    return_type: string
}

export type WithReference<T> = EXPRESSION_ITEM | T