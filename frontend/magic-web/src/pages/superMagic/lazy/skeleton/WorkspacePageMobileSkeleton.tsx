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

			{/* 底部：对齐 MobileComposer（MobileComposerHeader + 圆角主卡片 + 编辑区 + 底栏） */}
			<div className="shrink-0 bg-gradient-to-t from-sidebar to-transparent px-2 pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
				<div className="flex w-full flex-col gap-2 pt-2">
					{/* MobileComposerHeader：模式选择器 + 场景/技能条 */}
					<div className="flex min-h-8 items-center gap-2">
						<Skeleton.Title
							animated
							style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }}
						/>
						<Skeleton.Title
							animated
							style={{ flex: 1, height: 32, borderRadius: 8, minWidth: 0 }}
						/>
					</div>

					{/* mobile-composer-card：rounded-3xl + 投影，与真实输入卡片一致 */}
					<div className="overflow-hidden rounded-3xl bg-background shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]">
						{/* 编辑器区域（对应 EditorContent 外层的 px-4 pb-2 pt-3） */}
						<div className="flex flex-col gap-2 px-4 pb-2 pt-3">
							<Skeleton.Title
								animated
								style={{ width: "100%", height: 14, borderRadius: 4 }}
							/>
							<Skeleton.Title
								animated
								style={{ width: "92%", height: 14, borderRadius: 4 }}
							/>
						</div>

						{/* 底栏：左侧「添加」+ 右侧 语音 + 发送 */}
						<div className="flex items-center justify-between gap-2 px-1.5 py-1.5">
							<Skeleton.Title
								animated
								style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }}
							/>
							<div className="flex items-center gap-1">
								<Skeleton.Title
									animated
									style={{
										width: 40,
										height: 40,
										borderRadius: 9999,
										flexShrink: 0,
									}}
								/>
								<Skeleton.Title
									animated
									style={{
										width: 40,
										height: 40,
										borderRadius: 9999,
										flexShrink: 0,
									}}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default WorkspacePageMobileSkeleton
