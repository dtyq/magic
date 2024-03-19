/**
 * magic-flow节点业务组件
 */
import { MagicFlowInstance } from "@/MagicFlow"
import MagicFlowModal from "@/MagicFlow/modal/MagicFlowModal"
import { Button } from "antd"
import { IconCopyPlus } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import React, { useMemo, useRef } from "react"
import { NodeMapProvider } from "../../../common/context/NodeMap/Provider"
import { nodeSchemaMap } from "./constants"
import styles from "./index.module.less"
import flow from "./mock/flow"
import useToolbar from "./toolbar"
import { installAllNodes } from "./utils"

type FlowProps = { open?: boolean; onClose?: () => void }

export default function BaseFlow({ open, onClose }: FlowProps) {
	installAllNodes()
	const flowInstance = useRef(null as null | MagicFlowInstance)

	const toolbars = useToolbar()

	const consoleFlow = useMemoizedFn(() => {
		const flow = flowInstance?.current?.getFlow()
		console.log("内部流程", flow)
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
		}
	}, [Buttons])

	return (
		// @ts-ignore
		<NodeMapProvider nodeMap={nodeSchemaMap}>
			<MagicFlowModal
				ref={flowInstance}
				header={flowHeader}
				// @ts-ignore
				flow={flow}
				nodeToolbar={{
					list: toolbars,
				}}
				open={open}
				onClose={onClose}
			/>
		</NodeMapProvider>
	)
}
