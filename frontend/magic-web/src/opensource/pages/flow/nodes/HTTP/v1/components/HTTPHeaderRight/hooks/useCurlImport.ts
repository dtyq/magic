import { useState, useCallback } from "react"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { parseCurlCommand } from "@/opensource/pages/flow/utils/curl/curlParser"
import {
	generateComponentId,
	objectToFormStructure,
} from "@/opensource/pages/flow/utils/curl/curlToApiStructure"
import { useTranslation } from "react-i18next"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

// 创建默认的空结构
function createEmptyStructure() {
	return {
		type: "object",
		key: "root",
		sort: 0,
		title: null,
		description: null,
		required: [],
		value: null,
		encryption: false,
		encryption_value: null,
		items: null,
		properties: null,
	}
}

export default function useCurlImport() {
	const { t } = useTranslation()
	const [visible, setVisible] = useState(false)
	const { updateNodeConfig } = useFlow()
	const { currentNode } = useCurrentNode()

	const onCancel = useCallback(() => {
		setVisible(false)
	}, [])

	const showImporter = useCallback(() => {
		setVisible(true)
	}, [])

	const onImport = useCallback(
		(curlCommand: string) => {
			if (!curlCommand.trim()) {
				magicToast.error(t("http.curlImport.emptyError", { ns: "flow" }))
				return
			}

			try {
				const parsedCurl = parseCurlCommand(curlCommand)
				console.log("Parsed curl result:", parsedCurl)

				// 获取当前节点的API配置
				const currentApi = currentNode?.params?.api || {}

				// 创建更新后的API结构 - 完全覆盖式更新
				const updatedApi = {
					...currentApi,
					structure: {
						...currentApi.structure,
						method: parsedCurl.method,
						domain: parsedCurl.domain,
						path: parsedCurl.path,
						url: parsedCurl.url,
						request: {
							...currentApi.structure?.request,
							// 查询参数 - 始终使用新的解析结果
							params_query: {
								id:
									currentApi.structure?.request?.params_query?.id ||
									generateComponentId(),
								version: "1",
								type: "form",
								structure:
									Object.keys(parsedCurl.queryParams).length > 0
										? objectToFormStructure(parsedCurl.queryParams)
										: createEmptyStructure(),
							},
							// 路径参数 - 始终使用新的解析结果
							params_path: {
								id:
									currentApi.structure?.request?.params_path?.id ||
									generateComponentId(),
								version: "1",
								type: "form",
								structure:
									parsedCurl.pathParams.length > 0
										? {
												...createEmptyStructure(),
												properties: parsedCurl.pathParams.reduce(
													(acc, param) => {
														acc[param] = {
															type: "string",
															key: param,
															sort: 0,
															title: null,
															description: null,
															required: [],
															value: "",
															encryption: false,
															encryption_value: null,
															items: null,
															properties: null,
														}
														return acc
													},
													{} as Record<string, any>,
												),
											}
										: createEmptyStructure(),
							},
							// 请求体类型 - 始终使用新的解析结果
							body_type: parsedCurl.bodyType || "none",
							// 请求体 - 始终使用新的解析结果
							body: {
								id:
									currentApi.structure?.request?.body?.id ||
									generateComponentId(),
								version: "1",
								type: "form",
								structure:
									parsedCurl.bodyType !== "none" &&
									Object.keys(parsedCurl.body || {}).length > 0
										? objectToFormStructure(parsedCurl.body)
										: createEmptyStructure(),
							},
							// 请求头 - 始终使用新的解析结果
							headers: {
								id:
									currentApi.structure?.request?.headers?.id ||
									generateComponentId(),
								version: "1",
								type: "form",
								structure:
									Object.keys(parsedCurl.headers).length > 0
										? objectToFormStructure(parsedCurl.headers)
										: createEmptyStructure(),
							},
						},
					},
				}

				// 更新节点配置
				if (currentNode?.id) {
					updateNodeConfig({
						...currentNode,
						params: {
							...currentNode.params,
							api: updatedApi,
						},
					})

					magicToast.success(t("http.curlImport.importSuccess", { ns: "flow" }))
					setVisible(false)
				} else {
					magicToast.error(t("http.curlImport.nodeNotExist", { ns: "flow" }))
				}
			} catch (error) {
				console.error("解析 curl 命令失败", error)
				magicToast.error(t("http.curlImport.parseError", { ns: "flow" }))
			}
		},
		[currentNode, updateNodeConfig, t],
	)

	return {
		visible,
		showImporter,
		onCancel,
		onImport,
	}
}
