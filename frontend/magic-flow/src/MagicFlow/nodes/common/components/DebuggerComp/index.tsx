import { DefaultNodeVersion } from "@/MagicFlow/constants"
import { useFlowData, useSingleNodeConfig } from "@/MagicFlow/context/FlowContext/useFlow"
import { copyToClipboard } from "@/MagicFlow/utils"
import { message } from "antd"
import { useCallback, memo } from "react"
import i18next from "i18next"
import { useCurrentNode } from "../../context/CurrentNode/useCurrentNode"
import "./index.less"

type DebuggerCompProps = {
	id: string
}

// 使用memo包装组件以防止不必要的重渲染
const DebuggerComp = memo(
	function DebuggerComp({ id }: DebuggerCompProps) {
		// 使用单节点配置钩子，只订阅当前节点配置变化
		const nodeConfig = useSingleNodeConfig(id)
		const { debuggerMode } = useFlowData()
		const { currentNode } = useCurrentNode()

		// 使用useCallback替代useMemoizedFn，减少依赖
		const clickNode = useCallback(() => {
			console.log("debug node", nodeConfig)
			copyToClipboard(id)
			message.success(i18next.t("common.copySuccess", { ns: "magicFlow" }))
		}, [id, nodeConfig])

		// 如果不是调试模式，直接返回null避免渲染
		if (!debuggerMode) {
			return null
		}

		// 提取节点版本，避免在JSX中计算
		const nodeVersion = currentNode?.node_version || DefaultNodeVersion

		return (
			<p className="debugger-id" onClick={clickNode}>
				<span>
					{i18next.t("flow.nodeId", { ns: "magicFlow" })}：{id}
				</span>
				<br />
				<span>
					{i18next.t("flow.nodeVersion", { ns: "magicFlow" })}：{nodeVersion}
				</span>

				{/* <br />
			<span>{width + "," + height}</span>
			<br />
			<span>{x + "," + y}</span> */}
			</p>
		)
	},
	(prevProps, nextProps) => {
		// 自定义比较函数，只有当id变化时才重新渲染
		return prevProps.id === nextProps.id
	},
)

export default DebuggerComp
