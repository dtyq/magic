import { useState } from "react"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"

/**
 * MagicPullToRefresh 使用示例
 */
function MagicPullToRefreshExample() {
	const [data, setData] = useState<string[]>([])
	const [loading, setLoading] = useState(false)

	// 模拟数据获取
	const fetchData = async () => {
		setLoading(true)
		try {
			// 模拟 API 请求
			await new Promise((resolve) => setTimeout(resolve, 1500))
			const newData = Array.from({ length: 10 }, (_, i) => `项目 ${Date.now()}-${i}`)
			setData(newData)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div style={{ height: "100vh", padding: "20px" }}>
			<h1>MagicPullToRefresh 示例</h1>

			{/* 基础用法 */}
			<MagicPullToRefresh
				onRefresh={fetchData}
				height={600}
				successText="数据已更新"
				onRefreshSuccess={() => {
					console.log("刷新成功")
				}}
				onRefreshError={(error) => {
					console.error("刷新失败:", error)
				}}
			>
				<div style={{ padding: "20px" }}>
					<h2>项目列表</h2>
					{loading ? (
						<div>加载中...</div>
					) : data.length > 0 ? (
						data.map((item, index) => (
							<div
								key={index}
								style={{
									padding: "15px",
									margin: "10px 0",
									background: "#f5f5f5",
									borderRadius: "8px",
								}}
							>
								{item}
							</div>
						))
					) : (
						<div>暂无数据，下拉刷新获取</div>
					)}
				</div>
			</MagicPullToRefresh>
		</div>
	)
}

export default MagicPullToRefreshExample
