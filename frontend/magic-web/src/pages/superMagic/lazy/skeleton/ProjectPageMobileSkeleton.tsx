import { Skeleton } from "@/components/base/Skeleton"
import { Files, Timer } from "lucide-react"
import ProjectSider from "../../components/ProjectSider"
import { NormalModeHeader } from "../../components/TopicFilesButton/components"
import EmptyState from "../../components/TopicFilesButton/components/EmptyState"

const noop = () => undefined

/**
 * ProjectPage Mobile Skeleton Component
 * Skeleton screen for: src/pages/superMagicMobile/pages/ProjectPage/index.tsx
 */
export default function ProjectPageMobileSkeleton() {
	return (
		<div className="flex h-full flex-col">
			{/* Main Content */}
			<div className="flex flex-1 flex-col items-start gap-1.5 overflow-hidden">
				{/* Tabs */}
				<ProjectSider
					width="100%"
					items={[
						{
							key: "topicFiles",
							title: "Topic Files",
							icon: <Files size={16} />,
							content: (
								<div className="flex h-full w-full flex-1 flex-col items-center gap-1.5 overflow-hidden pb-3">
									<NormalModeHeader
										isShareRoute={false}
										refreshLoading={false}
										allowEdit={true}
										onRefresh={noop}
										onSearch={noop}
										onAddFile={noop}
										onAddDesign={noop}
										onAddFolder={noop}
										onUploadFile={noop}
										onUploadFolder={noop}
										onEnterSelectMode={noop}
									/>
									<EmptyState onUploadFile={noop} />
								</div>
							),
						},
						{
							key: "task",
							title: "Task",
							icon: <Timer size={16} />,
							content: null,
						},
					]}
					className="w-full flex-1 overflow-y-auto"
				/>
			</div>

			{/* Bottom Input Panel：对齐 MobileComposer（MobileComposerHeader + 圆角主卡片 + 编辑区 + 底栏） */}
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
