/* eslint-disable import/extensions */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { createContext, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"
import { ConfigProvider, message } from "antd"
import "antd/dist/reset.css"
import { reaction } from "mobx"
import { observer } from "mobx-react"
import { ExpressionSource } from "@/MagicExpressionWidget/types"
import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference"
import ErrorContent from "@/common/BaseUI/ErrorComponent/ErrorComponent"
import Editor from "./components/editor"
import { AppendPosition, DefaultColumnNames, DefaultDisplayColumns, ShowColumns } from "./constants"
import { ExportFieldsProvider } from "./context/ExportFieldsContext/Provider"
import { GlobalProvider } from "./context/GlobalContext/Provider"
import { GlobalStyle } from "./global.style"
import useExpressionSource from "./hooks/useExpressionSource"
import "./index.less"
import { Common } from "./types/Common"
import Schema, { CustomFieldsConfig, CustomOptions } from "./types/Schema"
import SchemaDescription from "./types/SchemaDescription"
import { genRootField } from "./utils/helpers"
import { CLASSNAME_PREFIX } from "@/common/constants"

/**
 * @title JsonSchemaEditor
 */
export interface JsonSchemaEditorProps {
	/**
	 * @zh 是否开启 mock
	 */
	mock?: boolean
	/**
	 * @zh 是否展示 json 编辑器
	 */
	jsonEditor?: boolean
	/**
	 * @zh Schema 变更的回调
	 */
	onChange?: (schema: Schema) => void
	/**
	 * @zh 初始化 Schema
	 */
	data?: Schema | string
	/**
	 * @zh 是否允许表达式
	 */
	allowExpression?: boolean
	/**
	 * @zh 是否根节点只允许json格式
	 */
	onlyJson?: boolean
	/**
	 * @zh 自定义参数类型可选项(可设置items, root, normal)
	 */
	customOptions?: CustomOptions
	/**
	 * @zh 表达式数据源
	 */
	expressionSource?: DataSourceOption[]
	/**
	 * @zh 是否开启 import json 功能
	 */
	jsonImport?: boolean
	/**
	 * @zh 是否开启 import json 功能
	 */
	debuggerMode?: boolean
	/**
	 * @zh 开发者自用，默认值编辑模式
	 */
	valueEdit?: boolean
	/**
	 * @zh 失去焦点事件
	 */
	onBlur?: (schema: Schema) => void
	/**
	 * 是否可以做添加删除操作
	 */
	allowOperation?: boolean
	/**
	 * 是否最少有一个子节点
	 */
	oneChildAtLeast?: boolean
	/**
	 * 默认生成的子节点的key
	 */
	firstChildKey?: string
	/**
	 * 全局禁用的field列表，对应的field不可编辑
	 */
	disableFields?: string[]
	/**
	 * 添加相邻节点时，新字段的位置，默认为当前字段的下一个字段，可选择默认添加到末尾
	 */
	relativeAppendPosition?: AppendPosition
	/**
	 * TODO 是否允许使用当前表单字段作为表达式数据源，暂时不要使用
	 */
	allowSourceInjectBySelf?: boolean
	/**
	 * 当前表单组件唯一id
	 */
	uniqueFormId?: string
	/**
	 * 上文表单数据源
	 */
	contextExpressionSource?: ExpressionSource
	/**
	 * 当前表单数据源变更函数
	 */
	onInnerSourceMapChange?: (innerSource: Record<string, Common.Options>) => void

	/**
	 * 当前显示列
	 */
	displayColumns?: ShowColumns[]

	/**
	 * 自定义参数列名称显示
	 */
	columnNames?: Record<ShowColumns, string>

	/**
	 * 是否允许添加字段
	 */
	allowAdd?: boolean

	/**
	 * 是否所有值设置只能通过表达式
	 */
	onlyExpression?: boolean

	/**
	 * 自定义某些字段的配置
	 */
	customFieldsConfig?: CustomFieldsConfig

	/**
	 * 是否显示导入
	 */
	showImport?: boolean

	/**
	 * 是否显示第一行（root层）
	 */
	showTopRow?: boolean

	/**
	 * 是否显示全局的添加参数
	 */
	showAdd?: boolean

	/**
	 * 是否显示操作栏
	 */
	showOperation?: boolean

	/**
	 * 是否初次加载就触发更新
	 */
	fireImmediately?: boolean
}

export const SchemaMobxContext = createContext<SchemaDescription>(new SchemaDescription())

const JsonSchemaObserverEditor = observer(
	React.forwardRef<any, JsonSchemaEditorProps>(
		(
			{
				allowOperation = true,
				oneChildAtLeast = false,
				allowSourceInjectBySelf = false,
				firstChildKey = "field_0",
				disableFields = [],
				allowAdd = true,
				showAdd = true,
				onlyExpression = false,
				showImport = true,
				showTopRow = false,
				showOperation = true,
				relativeAppendPosition = AppendPosition.Tail,
				contextExpressionSource,
				uniqueFormId,
				displayColumns = DefaultDisplayColumns,
				columnNames,
				customFieldsConfig,
				fireImmediately = false,
				onChange,
				onInnerSourceMapChange,
				data,
				...props
			},
			ref,
		) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { t: translate } = useTranslation()
			const [contextVal] = useState<SchemaDescription>(new SchemaDescription())
			const { innerExpressionSourceMap, updateInnerSourceMap } = useExpressionSource({
				allowSourceInjectBySelf,
				uniqueFormId,
			})

			useEffect(() => {
				// 默认有一个字段
				let defaultSchema = genRootField(oneChildAtLeast, firstChildKey)
				if (data) {
					if (typeof data === "string") {
						try {
							defaultSchema = JSON.parse(data)
						} catch (e) {
							message.error("传入的字符串非 json 格式!")
						}
					} else if (Object.prototype.toString.call(data) === "[object Object]") {
						// fix data是空对象首行没有加号的bug
						if (Object.keys(data).length > 0) {
							defaultSchema = data as typeof defaultSchema
						}
						// fix php的properties是空数组
						if (Array.isArray(data?.properties)) {
							defaultSchema.properties = {}
						}
					} else {
						message.error("json数据只支持字符串和对象")
					}
				}
				contextVal.changeSchema(defaultSchema)
			}, [JSON.stringify(data), oneChildAtLeast, firstChildKey])

			// 单独处理reaction，确保只创建一次，并在组件卸载时清理
			useEffect(() => {
				// 创建reaction实例
				const disposer = reaction(
					() => contextVal.schema,
					(schema) => {
						if (onChange) {
							onChange(JSON.parse(JSON.stringify(schema)))
						}
					},
					{ fireImmediately },
				)

				// 返回清理函数，在组件卸载或依赖项变化时执行
				return () => {
					disposer()
				}
			}, [contextVal, onChange, fireImmediately])

			useEffect(() => {
				const newInnerSourceMap = updateInnerSourceMap(contextVal.schema)
				if (onInnerSourceMapChange) {
					onInnerSourceMapChange(newInnerSourceMap)
				}
			}, [uniqueFormId, contextVal.schema, updateInnerSourceMap, onInnerSourceMapChange])

			// 暴露给外部的 API
			useImperativeHandle(
				ref,
				() => ({
					/** 在root节点下新增子节点 */
					addRootChildField: (fieldName: string) => {
						const allKeys = Object.keys(contextVal.schema.properties || {})
						// 已存在则不新增
						if (!allKeys.includes(fieldName)) {
							contextVal.addChildField({
								keys: ["properties"],
								customFieldName: fieldName,
							})
						}
					},
					/** 删除root节点的子节点 */
					deleteRootChildField: (fieldName: string) => {
						contextVal.deleteField({
							keys: ["properties", fieldName],
						})
					},
					/** 删除不在fieldNames范围内的子节点 */
					deleteRootChildFieldsNotIn: (fieldNames: string[]) => {
						const allKeys = Object.keys(contextVal.schema.properties || {})
						let delKeys = [] as string[]
						if (allKeys.length > 0) {
							delKeys = allKeys.filter((key) => !fieldNames.includes(key)) as string[]
						}
						delKeys.forEach((delKey) => {
							contextVal.deleteField({
								keys: ["properties", delKey],
							})
						})
					},
				}),
				[contextVal],
			)

			const mergedColumnNames = useMemo(() => {
				return {
					...DefaultColumnNames(),
					...(columnNames || {}),
				}
			}, [columnNames])

			return (
				<ErrorBoundary
					fallbackRender={({ error }) => {
						// eslint-disable-next-line no-console
						console.log("error", error)
						return <ErrorContent />
					}}
				>
					<ConfigProvider prefixCls={CLASSNAME_PREFIX}>
						<div>
							<GlobalStyle />
							<GlobalProvider
								allowOperation={allowOperation}
								allowAdd={allowAdd}
								showAdd={showAdd}
								disableFields={disableFields}
								relativeAppendPosition={relativeAppendPosition}
								innerExpressionSourceMap={innerExpressionSourceMap}
								allowSourceInjectBySelf={allowSourceInjectBySelf}
								contextExpressionSource={contextExpressionSource}
								uniqueFormId={uniqueFormId}
								displayColumns={displayColumns}
								showOperation={showOperation}
								columnNames={mergedColumnNames}
								customFieldsConfig={customFieldsConfig}
								onlyExpression={onlyExpression}
								showImport={showImport}
								showTopRow={showTopRow}
							>
								<ExportFieldsProvider defaultExportFields={contextVal.schema}>
									<SchemaMobxContext.Provider value={contextVal}>
										<Editor {...props} />
									</SchemaMobxContext.Provider>
								</ExportFieldsProvider>
							</GlobalProvider>
						</div>
					</ConfigProvider>
				</ErrorBoundary>
			)
		},
	),
)

export default JsonSchemaObserverEditor as React.ComponentType<JsonSchemaEditorProps>
