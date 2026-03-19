import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import { useMemo, useRef, useState } from "react"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { MonacoEditor } from "@/lib/monacoEditor"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { cloneDeep, set } from "lodash-es"
import { Form, Modal } from "antd"
import MagicJSONSchemaEditorWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicJsonSchemaEditorWrap"
import {
	useFlowData,
	useNodeConfigActions,
} from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import MagicExpressionWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicExpressionWrap"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"
import usePrevious from "../../../common/hooks/usePrevious"
import LanguageSelect from "./components/LanguageSelect/LanguageSelect"
import useMode, { CodeMode } from "./hooks/useMode"
import useCode from "./hooks/useCode"
import { v0Template } from "./template"

export default function Code() {
	const { t } = useTranslation()
	const [form] = Form.useForm()
	const { currentNode } = useCurrentNode()
	const { expressionDataSource } = usePrevious()
	const { flow } = useFlowData()

	const [codeString, setCodeString] = useState("")

	const { updateNodeConfig } = useNodeConfigActions()

	const { ModeChanger } = useMode()

	const { checkIsDefaultCode, updateCode } = useCode({ form })

	const initialValues = useMemo(() => {
		const currentNodeParams = currentNode?.params || {}
		const cloneTemplateParams = cloneDeep(v0Template.params)
		const mergeParams = {
			...cloneTemplateParams,
			...currentNodeParams,
		}
		// 回显给表单换成boolean
		// @ts-ignore
		mergeParams.mode = mergeParams.mode === CodeMode.Normal
		return {
			...mergeParams,
			input: currentNode?.input?.form,
			output: currentNode?.output?.form,
		}
	}, [currentNode?.input, currentNode?.output, currentNode?.params])

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return
		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			if (changeKey === "input" || changeKey === "output") {
				set(currentNode, [changeKey, "form"], changeValue)
				// 将boolean转化成实际值
			} else if (changeKey === "mode") {
				set(
					currentNode,
					["params", changeKey],
					changeValue ? CodeMode.Normal : CodeMode.Expression,
				)
			} else {
				if (changeKey === "language") {
					if (checkIsDefaultCode()) {
						updateCode(changeValue as string)
					} else {
						Modal.confirm({
							title: t("code.checkToUseTemplate", { ns: "flow" }),
							content: t("code.useTemplateDesc", { ns: "flow" }),
							onOk: () => {
								updateCode(changeValue as string)
							},
						})
					}
				}
				set(currentNode, ["params", changeKey], changeValue)
			}
		})
		updateNodeConfig({ ...currentNode })
	})

	useUpdateEffect(() => {
		form.setFieldsValue({
			...currentNode?.params,
			input: currentNode?.input?.form,
			output: currentNode?.output?.form,
			mode: currentNode?.params?.mode === CodeMode.Normal,
		})
	}, [flow, currentNode])

	const [isEditorFocused, setIsEditorFocused] = useState(false)
	const editorRef = useRef()

	// 编辑器挂载时设置焦点事件监听
	const handleEditorMount = (editor: any) => {
		editorRef.current = editor

		editor.onDidFocusEditorWidget(() => setIsEditorFocused(true))
		editor.onDidBlurEditorWidget(() => setIsEditorFocused(false))
	}

	// 覆盖层点击时聚焦编辑器
	const handleOverlayClick = () => {
		// @ts-ignore
		editorRef.current?.focus?.()
	}

	return (
		<Form
			form={form}
			className={styles.code}
			initialValues={initialValues}
			onValuesChange={onValuesChange}
		>
			<div className={styles.input}>
				<DropdownCard title={t("common.input", { ns: "flow" })} height="auto">
					<Form.Item name="input">
						<MagicJSONSchemaEditorWrap
							allowExpression
							expressionSource={expressionDataSource}
							displayColumns={[ShowColumns.Key, ShowColumns.Value, ShowColumns.Type]}
						/>
					</Form.Item>
				</DropdownCard>
			</div>
			<div className={styles.codeEditor}>
				<DropdownCard
					title={t("common.code", { ns: "flow" })}
					height="auto"
					suffixIcon={ModeChanger}
				>
					<LanguageSelect />
					{(!currentNode?.params?.mode ||
						currentNode?.params?.mode === CodeMode.Normal) && (
							<>
								{/* 透明覆盖层，未聚焦时拦截事件 */}
								{!isEditorFocused && (
									<div
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											right: 0,
											bottom: 0,
											zIndex: 10,
											cursor: "grab",
										}}
										onClick={handleOverlayClick}
										onMouseDown={(e) => e.stopPropagation()} // 防止节点拖动
									/>
								)}
								<Form.Item name="code">
									<MonacoEditor
										theme="vs-dark"
										language="php"
										value={codeString}
										height="400px"
										onChange={(value) => setCodeString(value!)}
										className="nodrag"
										onMount={handleEditorMount}
										options={{
											// 根据焦点状态调整编辑器交互
											readOnly: !isEditorFocused,
											contextmenu: isEditorFocused,
										}}
									/>
								</Form.Item>
							</>
						)}
					{currentNode?.params?.mode === CodeMode.Expression && (
						<Form.Item name={["import_code"]}>
							<MagicExpressionWrap
								onlyExpression
								dataSource={expressionDataSource}
								mode={ExpressionMode.TextArea}
								placeholder={t("common.allowExpressionPlaceholder", { ns: "flow" })}
							/>
						</Form.Item>
					)}
				</DropdownCard>
			</div>

			<div className={styles.output}>
				<DropdownCard title={t("common.output", { ns: "flow" })} height="auto">
					<Form.Item name="output">
						<MagicJSONSchemaEditorWrap
							allowExpression
							expressionSource={expressionDataSource}
							displayColumns={[ShowColumns.Key, ShowColumns.Label, ShowColumns.Type]}
						/>
					</Form.Item>
				</DropdownCard>
			</div>
		</Form>
	)
}
