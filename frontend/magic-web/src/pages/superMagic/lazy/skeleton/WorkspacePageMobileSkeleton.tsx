import { Skeleton } from "@/components/base/Skeleton"

/**
 * WorkspacePage Mobile Skeleton Component
 */
export function WorkspacePageMobileSkeleton() {
	return (
		<div className="relative flex h-full flex-col bg-sidebar">
			{/* HeaderContainer：白底 + 底部圆角 xl + shadow */}
			<div className="flex min-h-12 shrink-0 items-center gap-2 rounded-b-xl bg-background px-2.5 pb-2 pt-[max(8px,env(safe-area-inset-top))] shadow-xs">
				{/* Logo 骨架 */}
				<Skeleton.Title
					animated
					style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0 }}
				/>

				{/* 标题文字骨架 */}
				<Skeleton.Title animated style={{ flex: 1, height: 18, borderRadius: 6 }} />

				{/* 右侧按钮组骨架 */}
				<div className="flex shrink-0 items-center gap-1">
					<Skeleton.Title animated style={{ width: 32, height: 32, borderRadius: 8 }} />
					<Skeleton.Title animated style={{ width: 32, height: 32, borderRadius: 8 }} />
				</div>
			</div>

			{/* AppContainer：flex-1，垂直居中 */}
			<div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden">
				{/* SloganContainer */}
				<div className="flex w-full flex-col items-center gap-3">
					{/* 第一行 slogan */}
					<Skeleton.Title animated style={{ width: 220, height: 24, borderRadius: 6 }} />
					{/* 第二行 slogan */}
					<Skeleton.Title animated style={{ width: 260, height: 20, borderRadius: 6 }} />
				</div>

				{/* Crew 选择网格：2列 × 3行，gap-2，px-5 */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
						gap: 8,
						width: "100%",
						paddingLeft: 20,
						paddingRight: 20,
					}}
				>
					{Array.from({ length: 6 }).map((_, index) => (
						<Skeleton.Title
							key={index}
							animated
							style={{ width: "100%", height: 36, borderRadius: 9999 }}
						/>
					))}
				</div>
			</div>

			{/* 底部渐变遮罩 + 浮动输入框 */}
			<div className="shrink-0 bg-gradient-to-t from-sidebar to-transparent px-2 pb-6 pt-10">
				{/* 输入框容器：rounded-3xl，border，bg-background */}
				<div className="flex h-12 w-full items-center gap-1 overflow-hidden rounded-[24px] border border-border bg-background px-1 shadow-xs">
					{/* 左侧角色选择器：图标 + chevron */}
					<div className="flex h-10 shrink-0 items-center gap-1 rounded-full px-2.5">
						<Skeleton.Title
							animated
							style={{ width: 16, height: 16, borderRadius: 4 }}
						/>
						<Skeleton.Title
							animated
							style={{ width: 16, height: 16, borderRadius: 4 }}
						/>
					</div>

					{/* 文本占位 */}
					<Skeleton.Title animated style={{ width: 200, height: 16, borderRadius: 4 }} />

					{/* 右侧 Mic 按钮 */}
					{/* <Skeleton.Title
						animated
						style={{ width: 40, height: 40, borderRadius: 9999, flexShrink: 0 }}
					/> */}
				</div>
			</div>
		</div>
	)
}

export default WorkspacePageMobileSkeleton
