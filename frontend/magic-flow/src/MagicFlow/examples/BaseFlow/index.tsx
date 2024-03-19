/**
 * magic-flow节点业务组件
 */
import MagicFlow, { MagicFlowInstance } from "@/MagicFlow"
import { ExtraNodeConfigProvider } from "@/MagicFlow/context/ExtraNodeConfigContext/Provider"
import { MaterialSourceProvider } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { NodeChangeListenerProvider } from "@/MagicFlow/context/NodeChangeListenerContext/NodeChangeListenerContext"
import { NodeTestingProvider } from "@/MagicFlow/context/NodeTesingContext/Provider"
import AgentImage from "@/common/assets/agent-avatar.jpg"
import { createI18nNext } from "@/common/locales/create"
import AppearanceProvider from "@/common/provider/AppearanceProvider"
import { Button } from "antd"
import { IconCopyPlus } from "@tabler/icons-react"
import { useEventEmitter, useMemoizedFn, useMount } from "ahooks"
import i18next from "i18next"
import { debounce } from "lodash"
import React, { useMemo, useRef, useState } from "react"
import { NodeMapProvider } from "../../../common/context/NodeMap/Provider"
import { customNodeType } from "./constants"
import useMaterialSource from "./hooks/useMaterialSource"
import useNodesTest from "./hooks/useNodesTest"
import styles from "./index.module.less"
import flow from "./mock/flow"
import useToolbar from "./toolbar"
import { installAllNodes } from "./utils"
import { generateNodeVersionSchema } from "./utils/version"
import magicFlowEnJson from "@/common/locales/en_US/magicFlow.json"
import magicFlowZhJson from "@/common/locales/zh_CN/magicFlow.json"

// const { init, instance } = createI18nNext("en_US")
// init().catch(console.error)

// 确保只初始化一次i18next
if (!i18next.isInitialized) {
	i18next
		.init({
			lng: "zh", // 默认语言
			fallbackLng: "en",
			debug: true,
			resources: {
				en: {
					magicFlow: magicFlowEnJson,
				},
				zh: {
					magicFlow: magicFlowZhJson,
				},
			},
			interpolation: {
				escapeValue: false,
			},
		})
		.then(() => {
			console.log("i18next initialized successfully")
		})
		.catch((error) => {
			console.error("i18next initialization error:", error)
		})
}

// // 导出i18next实例，让下游组件可以导入使用
// export { i18next }

installAllNodes()
export default function BaseFlow() {
	const flowInstance = useRef(null as null | MagicFlowInstance)

	const [serverFlow, setServerFlow] = useState(null)

	const nodeChangeEventListener = useEventEmitter<string>()

	const toolbars = useToolbar()

	const consoleFlow = useMemoizedFn(() => {
		const flow = flowInstance?.current?.getFlow()
		console.log("内部流程", flow)
	})

	const handleNodeConfigChange = useMemoizedFn(
		debounce(() => {
			console.log("节点变更")
		}, 500),
	)

	nodeChangeEventListener?.useSubscription(handleNodeConfigChange)

	useMount(() => {
		setTimeout(() => {
			setServerFlow(flow as any)
		}, 500)
	})

	const Buttons = useMemo(() => {
		return (
			<>
				<Button loading={false} onClick={consoleFlow}>
					试运行
				</Button>
				<Button type="primary" loading={false}>
					发布
				</Button>
				<Button
					ghost
					// @ts-ignore
					theme="light"
					className={styles.copyButton}
				>
					<IconCopyPlus color="#77777b" />
				</Button>
			</>
		)
	}, [])

	const flowHeader = useMemo(() => {
		return {
			buttons: Buttons,
			defaultImage: AgentImage,
		}
	}, [Buttons])

	const { nowTestingNodeIds, testingNodeIds, testingResultMap, position } = useNodesTest()

	const { subFlow, tools } = useMaterialSource()

	const nodeSchemaMap = useMemo(() => {
		return generateNodeVersionSchema()
	}, [])

	return (
		// <AppearanceProvider i18nInstance={instance}>
		<NodeMapProvider nodeMap={nodeSchemaMap}>
			{/* @ts-ignore */}
			<MaterialSourceProvider subFlow={subFlow} tools={tools}>
				<NodeChangeListenerProvider customListener={nodeChangeEventListener}>
					<ExtraNodeConfigProvider
						// nodeStyleMap={{
						// 	[customNodeType.Start]: {
						// 		width: "900px",
						// 	},
						// }}
						customNodeRenderConfig={{
							[customNodeType.Start]: {
								hiddenDesc: true,
							},
						}}
					>
						<NodeTestingProvider
							nowTestingNodeIds={nowTestingNodeIds}
							testingNodeIds={testingNodeIds}
							testingResultMap={testingResultMap}
							position={false}
						>
							<MagicFlow
								ref={flowInstance}
								header={flowHeader}
								// @ts-ignore
								flow={serverFlow}
								nodeToolbar={{
									list: toolbars,
								}}
								customParamsName={{
									params: "params",
									nodeType: "node_type",
								}}
								layoutOnMount={true}
								allowDebug
								omitNodeKeys={[
									"data",
									"expandParent",
									"extent",
									"parentId",
									"deletable",
									"position",
									"step",
									"zIndex",
									"type",
								]}
								showExtraFlowInfo={false}
							/>
						</NodeTestingProvider>
					</ExtraNodeConfigProvider>
				</NodeChangeListenerProvider>
			</MaterialSourceProvider>
		</NodeMapProvider>
		// </AppearanceProvider>
	)
}
