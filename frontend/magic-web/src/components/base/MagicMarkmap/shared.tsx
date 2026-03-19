import eventBus from "@/utils/bridge/eventBus"
import type { BridgeEventData } from "@/utils/bridge/types"
import { BridgeCallNativeEvent, BridgeEventType } from "@/utils/bridge/types"
import { memo, useEffect, useState } from "react"
import { getJSBridge } from "@/utils/bridge/utils"
import { createStyles } from "antd-style"
import type { IMarkmapOptions } from "markmap-common"
import { exportMarkmapToPng } from "./utils"
import MarkmapBase from "./components/MarkmapBase"

const useStyles = createStyles(({ css }) => ({
	mindMap: css`
		width: 100vw;
		height: 100vh;
	`,
}))

const MagicMarkmapShared = memo(() => {
	const [mindMapData, setMindMapData] = useState<string>("")
	const { styles } = useStyles()
	const [options] = useState<Partial<IMarkmapOptions>>({})

	useEffect(() => {
		const callback = (event: BridgeEventData[BridgeEventType.InjectMindMapData]) => {
			setMindMapData(event.data)
		}
		eventBus.on(BridgeEventType.InjectMindMapData, callback)
		return () => {
			eventBus.off(BridgeEventType.InjectMindMapData, callback)
		}
	}, [])

	useEffect(() => {
		const callback = async (event: BridgeEventData[BridgeEventType.GetMindMapImage]) => {
			const blob = await exportMarkmapToPng(event.data, event.width, event.height)

			// 将 blob 转换为 base64
			const reader = new FileReader()
			reader.onloadend = () => {
				const base64data = reader.result as string
				getJSBridge()?.callNative(BridgeCallNativeEvent.getMindMapImage, base64data)
			}
			reader.readAsDataURL(blob)
		}

		eventBus.on(BridgeEventType.GetMindMapImage, callback)
		return () => {
			eventBus.off(BridgeEventType.GetMindMapImage, callback)
		}
	}, [])

	if (!mindMapData) return null

	return <MarkmapBase options={options} data={mindMapData} className={styles.mindMap} />
})

export default MagicMarkmapShared
