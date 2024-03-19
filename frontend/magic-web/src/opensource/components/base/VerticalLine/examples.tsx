/**
 * VerticalLine 组件使用示例
 */

import VerticalLine from "@/opensource/components/base/VerticalLine"

export function VerticalLineExamples() {
	return (
		<div className="space-y-8 p-8">
			<h2 className="text-2xl font-bold">VerticalLine 使用示例</h2>

			{/* 基础用法 */}
			<div>
				<h3 className="mb-2 text-lg font-semibold">基础用法</h3>
				<div className="flex items-center gap-4">
					<span>左侧内容</span>
					<VerticalLine height={24} />
					<span>右侧内容</span>
				</div>
			</div>

			{/* 不同高度 */}
			<div>
				<h3 className="mb-2 text-lg font-semibold">不同高度</h3>
				<div className="flex items-center gap-4">
					<VerticalLine height={16} />
					<VerticalLine height={24} />
					<VerticalLine height={32} />
					<VerticalLine height={48} />
				</div>
			</div>

			{/* 使用 Tailwind 颜色 */}
			<div>
				<h3 className="mb-2 text-lg font-semibold">使用 Tailwind 颜色</h3>
				<div className="flex items-center gap-4">
					<VerticalLine height={24} className="text-border" />
					<VerticalLine height={24} className="text-muted-foreground" />
					<VerticalLine height={24} className="text-primary" />
					<VerticalLine height={24} className="text-destructive" />
				</div>
			</div>

			{/* 自定义颜色 */}
			<div>
				<h3 className="mb-2 text-lg font-semibold">自定义颜色</h3>
				<div className="flex items-center gap-4">
					<VerticalLine height={24} color="#ff0000" />
					<VerticalLine height={24} color="#00ff00" />
					<VerticalLine height={24} color="#0000ff" />
					<VerticalLine height={24} color="rgba(255, 0, 0, 0.5)" />
				</div>
			</div>

			{/* 透明度 */}
			<div>
				<h3 className="mb-2 text-lg font-semibold">透明度控制</h3>
				<div className="flex items-center gap-4">
					<VerticalLine height={24} opacity={1} />
					<VerticalLine height={24} opacity={0.7} />
					<VerticalLine height={24} opacity={0.5} />
					<VerticalLine height={24} opacity={0.3} />
				</div>
			</div>

			{/* 在导航栏中 */}
			<div>
				<h3 className="mb-2 text-lg font-semibold">导航栏示例</h3>
				<div className="flex h-[40px] items-center rounded bg-gray-100 px-4">
					<button className="rounded px-3 py-1 hover:bg-gray-200">首页</button>
					<VerticalLine height={20} className="mx-2 text-border" />
					<button className="rounded px-3 py-1 hover:bg-gray-200">文档</button>
					<VerticalLine height={20} className="mx-2 text-border" />
					<button className="rounded px-3 py-1 hover:bg-gray-200">关于</button>
				</div>
			</div>

			{/* 在卡片头部 */}
			<div>
				<h3 className="mb-2 text-lg font-semibold">卡片头部示例</h3>
				<div className="rounded-lg border p-4">
					<div className="flex h-[32px] items-center">
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
							A
						</div>
						<VerticalLine height={24} className="mx-3 text-muted-foreground" />
						<span className="text-sm">用户名称</span>
						<VerticalLine height={24} className="mx-3 text-muted-foreground" />
						<span className="text-xs text-muted-foreground">2024-02-03 12:00</span>
					</div>
				</div>
			</div>

			{/* 使用百分比高度 */}
			<div>
				<h3 className="mb-2 text-lg font-semibold">使用百分比高度</h3>
				<div className="flex h-[60px] items-stretch rounded border">
					<div className="flex flex-1 items-center justify-center">左侧</div>
					<VerticalLine height="100%" className="text-border" />
					<div className="flex flex-1 items-center justify-center">右侧</div>
				</div>
			</div>
		</div>
	)
}
