import { useEffect } from "react"
import { compareStreamRecordsForDisplay, DynamicDatabase } from "@/pages/superMagic/stores/storage"

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
						.slice()
						.sort(compareStreamRecordsForDisplay)
						.map((o) => o?.value)

					/** keep-console */
					console.log("流水：", messages)
					/** keep-console */
					console.groupEnd()
				})
				.catch(console.error)
		}
	}, [])
}
