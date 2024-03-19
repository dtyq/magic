
import { MagicFlow } from '@/MagicFlow/types/flow'
import { useMemoizedFn } from 'ahooks'

export default function useLoopBodyClick() {

	const elevateBodyEdgesLevel = useMemoizedFn((node: MagicFlow.Node) => {
		// const relationNodesIds = nodes.filter((n) => n.meta.parent_id === node.id).map((n) => n.id)
		// const relationEdges = edges.filter(
		// 	(e) => relationNodesIds.includes(e.source) || relationNodesIds.includes(e.target),
		// )
		// relationEdges.forEach((e) => {
		// 	e.zIndex = 2001
		// })
		// setEdges([...edges])
	})

	const resetEdgesLevels = useMemoizedFn((node: MagicFlow.Node) => {
		
		// // 点击的是普通节点
		// const relationNodeIds = [node.id]

		// // 如果点击的是循环体内的节点, 则循环体内的边都应该是最高层级


		// const relationEdgesIds = edges.filter(
		// 	(e) => node.id === e.source ||  node.id === e.target,
		// ).map(e => e.id)
		// edges.forEach(e => {
		// 	if(!relationEdgesIds.includes(e.id)) {
		// 		e.zIndex = 0
		// 	}
		// })
		// setEdges([...edges])
	})

	return {
		elevateBodyEdgesLevel,
		resetEdgesLevels
	}
}
