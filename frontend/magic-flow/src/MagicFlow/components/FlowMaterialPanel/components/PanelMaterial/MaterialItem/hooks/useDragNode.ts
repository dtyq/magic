import { useMemoizedFn } from "ahooks"

interface UseDragNodeProps {
  item: any
}

const useDragNode = ({ item }: UseDragNodeProps) => {
  const onDragStart = useMemoizedFn((event: React.DragEvent) => {
    event.dataTransfer.setData("node-data", JSON.stringify(item))
    event.dataTransfer.effectAllowed = "move"
  })

  return { onDragStart }
}

export default useDragNode 