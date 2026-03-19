import { useEffect } from "react"
import { DynamicDatabase } from "@/pages/superMagic/stores/storage"

export function useStreamRecordsCollect() {
	useEffect(() => {
		const url = new URL(window.location.href)
		const streamRecordsId = url.searchParams.get("streamRecordsId")
		const db = new DynamicDatabase()
		if (streamRecordsId) {
			// 获取数据库中的流水
			db.queryAllFromTable(streamRecordsId)
				.then((res) => {
					/** keep-console */
					console.groupCollapsed(
						`%c超麦话题流式记录 ${streamRecordsId}: ${res.length} 条`,
						"background: green;color: #fff;padding: 0 4px",
					)
					const messages = res
						.map((o) => o?.value)
						.sort((a: any, b: any) => {
							const aa = a?.message?.send_time || a?.send_time
							const bb = b?.message?.send_time || b?.send_time
							return aa - bb
						})

					/** keep-console */
					console.log("流水：", messages)
					/** keep-console */
					console.groupEnd()
				})
				.catch(console.error)
		}
	}, [])
}
