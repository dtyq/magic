import { useFlowNodes, useNodeConfig } from "@/MagicFlow/context/FlowContext/useFlow"
import { useExternalConfig } from "@/MagicFlow/context/ExternalContext/useExternal"
import { useMemoizedFn } from "ahooks"
import { useReactFlow, Edge } from "reactflow"
import _ from "lodash"
import { generateSnowFlake } from "@/common/utils/snowflake"
import {
  generateLoopBody,
  generateNewNode,
  judgeIsLoopBody,
  judgeLoopNode
} from "@/MagicFlow/utils"

interface UseAddItemProps {
  item: any
}

const useAddItem = ({ item }: UseAddItemProps) => {
  const { addNode, selectedNodeId } = useFlowNodes()
  const { nodeConfig } = useNodeConfig()
  const reactflow = useReactFlow()
  const { paramsName } = useExternalConfig()

  const onAddItem = useMemoizedFn(() => {
    // 当添加循环体的时候，实际添加的元素是多个的
    const newNodes = []
    const newEdges = [] as Edge[]
    // 是否在分组内添加节点
    let isAddInGroup = false
    const selectedNode = nodeConfig?.[selectedNodeId!]
    const isLoopBody = judgeIsLoopBody(selectedNode?.[paramsName.nodeType])
    
    if (selectedNodeId) {
      isAddInGroup = isLoopBody || !!selectedNode?.parentId
    }
    
    const id = generateSnowFlake()
    const position = reactflow.screenToFlowPosition({
      x: 400,
      y: 200,
    })

    const currentNodeSchema = _.cloneDeep(item)
    const newNode = generateNewNode(currentNodeSchema, paramsName, id, position)

    if (isAddInGroup) {
      // 用于处理当在分组body新增节点后，继续新增节点应该还是在分组内
      const parentId = isLoopBody ? selectedNodeId || undefined : selectedNode?.parentId
      newNode.parentId = parentId
      newNode.expandParent = true
      newNode.extent = "parent"
      newNode.meta = {
        position: {
          x: 100,
          y: 200,
        },
        parent_id: parentId,
      }
    }

    newNodes.push(newNode)
    const edges = reactflow?.getEdges?.() || []
    // 如果新增的是循环，则需要多新增一个循环体和一条边
    if (judgeLoopNode(newNode[paramsName.nodeType])) {
      const { newNodes: bodyNodes, newEdges: bodyEdges } = generateLoopBody(
        newNode,
        paramsName,
        edges,
      )
      newNodes.push(...bodyNodes)
      newEdges.push(...bodyEdges)
    }

    addNode(newNodes, newEdges)
  })

  return { onAddItem }
}

export default useAddItem 