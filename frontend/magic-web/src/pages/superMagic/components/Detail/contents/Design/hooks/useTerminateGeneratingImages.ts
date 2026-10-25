import { useEffect } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { CanvasDesignRef } from "@/components/CanvasDesign/public/props"
import { terminateGeneratingImages } from "@/components/CanvasDesign/runtime/generation/terminateGeneratingImages"

/**
 * 终止任务后把画布上仍在生成的图片节点收敛为终止态。
 *
 * 由中断服务广播事件，Design 侧自己管理自己的元素，避免把画布实例透传到中断按钮。
 * 画布未挂载时事件自然丢失——此时也没有需要收敛的节点。
 */
export function useTerminateGeneratingImages(
	canvasDesignRef: React.RefObject<CanvasDesignRef | null>,
): void {
	useEffect(() => {
		const handleTerminate = () => {
			const canvas = canvasDesignRef.current?.getCanvasInstance()
			if (!canvas) return
			terminateGeneratingImages(canvas)
		}

		pubsub.subscribe(PubSubEvents.Terminate_Generating_Images, handleTerminate)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Terminate_Generating_Images, handleTerminate)
		}
	}, [canvasDesignRef])
}
