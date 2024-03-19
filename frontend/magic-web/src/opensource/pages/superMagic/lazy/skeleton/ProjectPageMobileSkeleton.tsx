import { Skeleton } from "@/opensource/components/shadcn-ui/skeleton"
import { Files, Timer } from "lucide-react"
import ProjectSider from "../../components/ProjectSider"
import { NormalModeHeader } from "../../components/TopicFilesButton/components"
import { cn } from "@/opensource/lib/tiptap-utils"
import EmptyState from "../../components/TopicFilesButton/components/EmptyState"

/**
 * ProjectPage Mobile Skeleton Component
 * Skeleton screen for: src/opensource/pages/superMagicMobile/pages/ProjectPage/index.tsx
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
										onRefresh={() => {}}
										onSearch={() => {}}
										onAddFile={() => {}}
										onAddDesign={() => {}}
										onAddFolder={() => {}}
										onUploadFile={() => {}}
										onUploadFolder={() => {}}
										onEnterSelectMode={() => {}}
									/>
									<EmptyState onUploadFile={() => {}} />
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

			{/* Bottom Input Panel */}
			<div
				className={cn(
					"flex shrink-0 flex-col items-start justify-end gap-1.5 rounded-tl-[14px] rounded-tr-[14px] bg-white p-2.5",
					`pb-safe-bottom`,
				)}
			>
				{/* Input Header Bar */}
				<div className="flex w-full items-start gap-2">
					<Skeleton className="h-6 w-20 rounded-md" />
					<Skeleton className="h-6 w-20 rounded-md" />
					<Skeleton className="h-6 w-20 rounded-md" />
					<Skeleton className="h-6 w-16 rounded-md" />
				</div>

				{/* Input Container */}
				<div className="flex w-full flex-col items-start gap-2 rounded-[14px] border border-[var(--base/muted-foreground,#737373)] bg-white p-2 shadow-xs">
					<Skeleton className="h-6 w-6 rounded-md" />
					<Skeleton className="h-8 w-full rounded-md" />
					<div className="flex w-full items-start justify-between">
						<div className="flex items-center gap-1">
							<Skeleton className="size-8 rounded-md" />
							<Skeleton className="size-8 rounded-md" />
							<Skeleton className="size-8 rounded-md" />
						</div>
						<div className="flex items-center gap-1">
							<Skeleton className="size-8 rounded-md" />
							<Skeleton className="size-8 rounded-md bg-[var(--base/foreground,#0a0a0a)]" />
						</div>
					</div>
				</div>

				{/* Input Footer Bar */}
				<div className="flex w-full items-start gap-2">
					<Skeleton className="h-7 w-24 rounded-md" />
					<Skeleton className="h-7 w-32 rounded-md" />
				</div>
			</div>
		</div>
	)
}
