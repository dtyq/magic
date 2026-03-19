/**
 * 节点变更监听
 */

import { useEventEmitter, useMemoizedFn } from "ahooks"
import { debounce } from "lodash-es"

type UseChangeListener = {
	saveDraft: () => Promise<void>
}

export default function useChangeListener({ saveDraft }: UseChangeListener) {
	const nodeChangeEventListener = useEventEmitter<string>()

	const handleNodeConfigChange = useMemoizedFn(
		debounce(() => {
			// console.log("配置变更，触发保存")
			saveDraft()
		}, 2500),
	)

	nodeChangeEventListener?.useSubscription(handleNodeConfigChange)

	return {
		nodeChangeEventListener,
	}
}
