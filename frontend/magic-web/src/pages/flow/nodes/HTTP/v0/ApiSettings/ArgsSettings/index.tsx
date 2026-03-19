import { Radio } from "antd"
import { useCreation, useMemoizedFn, useUpdateEffect } from "ahooks"
import { useEffect, useMemo, useState, useRef } from "react"
import type { Widget } from "@/types/flow"
import type { EventEmitter } from "ahooks/lib/useEventEmitter"
import MagicJsonSchemaEditor from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor"
import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import type { ExpressionSource } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { FormItemType } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import { cx } from "antd-style"
import { useFlowNodes } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { cloneDeep, assignIn } from "lodash-es"
import { DisabledField } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { useTranslation } from "react-i18next"
import { ArgsTabType } from "../types"
import styles from "./index.module.less"

interface ArgsSettingsProps {
	onChange: (path: string[], value: any) => void
	value: {
		params_query: Widget<Schema>
		params_path: Widget<Schema>
		body_type: string
		body: Widget<Schema>
		headers: Widget<Schema>
		domain: string
		path: string
		method: string
	}
	paths: {
		query: string[]
		path: string[]
		bodyType: string[]
		body: string[]
		headers: string[]
	}
	/** 参数配置激活的tab栏 */
	activeKey?: string
	pathEventEmitter?: EventEmitter<string[]>
	/** 保存最新settings函数 */
	update: () => void
	/** 数据源 */
	expressionSource: ExpressionSource
	/** 是否有path组件 */
	hasPath?: boolean
}

export default function ArgsSettings({
	value,
	onChange,
	paths,
	update,
	activeKey = ArgsTabType.Query,
	pathEventEmitter,
	hasPath = true,
	expressionSource,
}: ArgsSettingsProps) {
	const { t } = useTranslation()
	const [currentTab, setCurrentTab] = useState(activeKey)
	const { selectedNodeId } = useFlowNodes()

	// 以父组件的为准
	useEffect(() => {
		setCurrentTab(activeKey)
	}, [activeKey])

	const updateFunc = useMemoizedFn((changePath: string[], val: any) => {
		onChange(changePath, val)
	})
	const [bodyType, setBodyType] = useState(value.body_type)

	// console.log(`bodyType: ${value.body_type}`)

	const bodyFormOptions = useMemo(() => {
		if (bodyType === "form-data" || bodyType === "x-www-form-urlencoded") {
			return {
				root: [FormItemType.Object],
				items: [FormItemType.String, FormItemType.Number],
				normal: [FormItemType.String, FormItemType.Number, FormItemType.Array],
			}
		}
		return {
			root: [FormItemType.Object, FormItemType.Array],
			items: [
				FormItemType.String,
				FormItemType.Number,
				FormItemType.Boolean,
				FormItemType.Array,
				FormItemType.Object,
			],
			normal: [
				FormItemType.String,
				FormItemType.Number,
				FormItemType.Boolean,
				FormItemType.Array,
				FormItemType.Object,
			],
		}
	}, [bodyType])

	const queryOptions = useMemo(() => {
		return {
			root: [FormItemType.Object],
			items: [FormItemType.String, FormItemType.Number],
			normal: [FormItemType.String, FormItemType.Number, FormItemType.Array],
		}
	}, [])

	const paramsOptions = useMemo(() => {
		return {
			root: [FormItemType.Object],
			items: [],
			normal: [FormItemType.String, FormItemType.Number],
		}
	}, [])

	const pathEditorRef = useRef({} as any)
	const pathSchema = cloneDeep(value.params_path)

	if (pathEventEmitter)
		pathEventEmitter.useSubscription((pathFieldNames) => {
			// console.log("path -> ", pathFieldNames)
			if (pathEditorRef.current && typeof pathEditorRef.current === "object") {
				// 需要检查这些方法是否存在
				if (typeof pathEditorRef.current.deleteRootChildFieldsNotIn === "function") {
					pathEditorRef.current.deleteRootChildFieldsNotIn(pathFieldNames)
				}

				if (typeof pathEditorRef.current.addRootChildField === "function") {
					pathFieldNames.forEach((fieldName) => {
						pathEditorRef.current.addRootChildField(fieldName)
					})
				}
			}
		})

	const onPathChange = useMemoizedFn((val: Schema) => {
		updateFunc(paths.path, val)
		assignIn(pathSchema, val)
	})

	const ParamsComp = useMemo(() => {
		return (
			<div className="api-settings-params">
				<p className="step-title">Query</p>
				<MagicJsonSchemaEditor
					data={
						value?.params_query?.structure?.properties
							? value?.params_query?.structure
							: undefined
					}
					onChange={(val) => updateFunc(paths.query, val)}
					expressionSource={expressionSource}
					customOptions={queryOptions}
					uniqueFormId={value.params_query.id}
					displayColumns={[ShowColumns.Key, ShowColumns.Value, ShowColumns.Type]}
					allowExpression
				/>
				{hasPath && (
					<>
						<p className="step-title no-first">Path</p>
						<MagicJsonSchemaEditor
							data={value.params_path.structure}
							onChange={(val) => onPathChange(val)}
							expressionSource={expressionSource}
							allowExpression
							customOptions={paramsOptions}
							allowOperation={false}
							oneChildAtLeast={false}
							key={`path-editor-${value.params_query.id}`}
							disableFields={[DisabledField.Name]}
							uniqueFormId={value.params_query.id}
							showAdd={false}
							showImport={false}
						/>
					</>
				)}
			</div>
		)
	}, [
		expressionSource,
		hasPath,
		onPathChange,
		paramsOptions,
		paths.query,
		queryOptions,
		updateFunc,
		value.params_path.structure,
		value.params_query.id,
		value.params_query?.structure,
	])

	const BodyComp = useMemo(() => {
		return (
			<div className={styles.body}>
				<Radio.Group
					onChange={(e) => {
						updateFunc(paths.bodyType, (e.target as HTMLInputElement).value)
						setBodyType((e.target as HTMLInputElement).value)
					}}
					value={bodyType || "form-data"}
				>
					<Radio value="none">none</Radio>
					<Radio value="form-data">form-data</Radio>
					<Radio value="x-www-form-urlencoded">x-www-form-urlencoded</Radio>
					<Radio value="json">json</Radio>
				</Radio.Group>
				{bodyType === "none" && (
					<div className={styles.selectNone}>{t("http.withoutBody", { ns: "flow" })}</div>
				)}
				{bodyType !== "none" && (
					<MagicJsonSchemaEditor
						data={
							value?.body?.structure?.properties ? value?.body?.structure : undefined
						}
						onChange={(val) => updateFunc(paths.body, val)}
						allowExpression
						expressionSource={expressionSource}
						customOptions={bodyFormOptions}
						uniqueFormId={value.body.id}
						displayColumns={[ShowColumns.Key, ShowColumns.Value, ShowColumns.Type]}
					/>
				)}
			</div>
		)
	}, [
		bodyFormOptions,
		bodyType,
		expressionSource,
		paths.body,
		paths.bodyType,
		t,
		updateFunc,
		value.body.id,
		value.body?.structure,
	])

	const customHeaderOptions = useCreation(() => {
		return {
			root: [FormItemType.Object],
			items: [FormItemType.String, FormItemType.Number],
			normal: [FormItemType.String, FormItemType.Number, FormItemType.Array],
		}
	}, [])

	const HeaderComp = useMemo(() => {
		return (
			<div className="api-settings-headers">
				<MagicJsonSchemaEditor
					data={
						value?.headers?.structure?.properties
							? value?.headers?.structure
							: undefined
					}
					onChange={(val) => updateFunc(paths.headers, val)}
					allowExpression
					expressionSource={expressionSource}
					customOptions={customHeaderOptions}
					uniqueFormId={value.headers.id}
					displayColumns={[ShowColumns.Key, ShowColumns.Value, ShowColumns.Type]}
				/>
			</div>
		)
	}, [
		customHeaderOptions,
		expressionSource,
		paths.headers,
		updateFunc,
		value.headers.id,
		value.headers.structure,
	])
	const onTabChange = useMemoizedFn((val: string) => {
		update()
		setCurrentTab(val)
	})

	useUpdateEffect(() => {
		// 节点失去焦点时保存一次，可以进一步判断是否上一个selectedNode是当前HTTP节点id
		if (!selectedNodeId) {
			update()
		}
	}, [selectedNodeId])

	const items = useMemo(() => {
		return [
			{
				key: ArgsTabType.Query,
				label: `Params`,
				onClick: () => onTabChange(ArgsTabType.Query),
				children: ParamsComp,
			},
			{
				key: ArgsTabType.Body,
				label: `Body`,
				onClick: () => onTabChange(ArgsTabType.Body),
				children: BodyComp,
			},
			{
				key: ArgsTabType.Headers,
				label: `Headers`,
				onClick: () => onTabChange(ArgsTabType.Headers),
				children: HeaderComp,
			},
		]
	}, [BodyComp, HeaderComp, ParamsComp, onTabChange])

	const RenderComp = useMemo(() => {
		return items.find((item) => item.key === currentTab)?.children
	}, [currentTab, items])

	return (
		<div className={styles.argsSettings}>
			<Radio.Group defaultValue={currentTab} buttonStyle="solid" className={styles.panelTabs}>
				{items.map((tabItem) => {
					return (
						<Radio.Button
							className={cx(styles.tabItem, {
								[styles.active]: currentTab === tabItem.key,
							})}
							onClick={tabItem.onClick}
							key={tabItem.key}
							value={tabItem.key}
						>
							{tabItem.label}
						</Radio.Button>
					)
				})}
			</Radio.Group>
			{RenderComp}
		</div>
	)
}
