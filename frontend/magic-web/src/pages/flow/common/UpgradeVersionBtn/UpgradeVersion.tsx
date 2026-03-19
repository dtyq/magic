import { IconCircleArrowUp } from "@tabler/icons-react"
import { Popconfirm, Tooltip } from "antd"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemo } from "react"
import { getLatestNodeVersion } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { cloneDeep } from "lodash-es"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { customNodeType } from "../../constants"
import { useStyles } from "./styles"
import { getNodeSchema } from "../../utils/helpers"
import { compareNodeVersion } from "./helpers"
import { useCommercial } from "../../context/CommercialContext"

export default function UpgradeVersionBtn() {
	const { currentNode } = useCurrentNode()
	const commercialData = useCommercial()

	const { updateNodeConfig } = useFlow()

	const { t } = useTranslation()

	const { styles } = useStyles()

	const currentNodeLatestVersion = useMemo(() => {
		return getLatestNodeVersion(currentNode?.node_type)
	}, [currentNode])

	const isOldVersion = useMemo(() => {
		const currentNodeVersion = currentNode?.node_version ?? "v0"
		return compareNodeVersion(currentNodeLatestVersion || "v0", currentNodeVersion)
		// return true
	}, [currentNode?.node_version, currentNodeLatestVersion])

	const updateAllBranchOutput = useMemoizedFn(() => {
		const branches = currentNode?.params?.branches || []
		const latestBranches = getNodeSchema(currentNode?.node_type)?.params?.branches || []

		if (branches?.length === 0 || latestBranches?.length === 0) return
		branches.forEach((branch: any) => {
			const targetNewBranch = latestBranches.find(
				// @ts-ignore
				(latestBranch) => latestBranch?.trigger_type === branch?.trigger_type,
			)
			const latestOutput = targetNewBranch?.output
			if (latestOutput) {
				branch.output = cloneDeep(latestOutput)
			}
		})
	})

	const onlyUpdateSystemOutput = useMemoizedFn(() => {
		const latestNodeTemplate = getNodeSchema(currentNode?.node_type)
		if (!latestNodeTemplate || !currentNode) return
		currentNode.system_output = cloneDeep(latestNodeTemplate?.system_output)
	})

	const updateOutputAndSystemOutput = useMemoizedFn(() => {
		const latestNodeTemplate = getNodeSchema(currentNode?.node_type)
		if (!latestNodeTemplate || !currentNode) return
		currentNode.output = cloneDeep(latestNodeTemplate?.output)
		currentNode.system_output = cloneDeep(latestNodeTemplate?.system_output)
	})

	const updateNodeVersion = useMemoizedFn(() => {
		currentNode!.node_version = currentNodeLatestVersion
	})

	const onNodeVersionUpdate = useMemoizedFn(() => {
		if (!currentNode) return
		switch (currentNode?.node_type?.toString?.()) {
			case customNodeType.Start:
				updateAllBranchOutput()
				break
			case customNodeType.HTTP:
				onlyUpdateSystemOutput()
				break
			case customNodeType.WaitForReply:
			case customNodeType.SearchUsers:
			case commercialData?.enterpriseNodeTypes.KnowledgeSearch:
			case customNodeType.LLM:
			case customNodeType.VectorSearch:
			case customNodeType.Loader:
			case customNodeType.CacheGetter:
				updateOutputAndSystemOutput()
				break
			default:
				break
		}
		updateNodeVersion()

		updateNodeConfig({
			...currentNode,
		})
	})

	const UpgradeVersionComponent = useMemo(() => {
		return isOldVersion ? (
			<Popconfirm
				title={t("common.confirmToUpdateVersion", { ns: "flow" })}
				onConfirm={onNodeVersionUpdate}
			>
				<Tooltip title="当前节点处于旧版本，点击升级节点版本" placement="bottom">
					<IconCircleArrowUp className={styles.arrowUp} size={20} />
				</Tooltip>
			</Popconfirm>
		) : null
	}, [isOldVersion, onNodeVersionUpdate, styles.arrowUp, t])

	return UpgradeVersionComponent
}
