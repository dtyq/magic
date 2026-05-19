import { ChevronLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PORTAL_IDS } from "@/constants"
import { cn } from "@/lib/utils"

interface ProjectDetailHeaderProps {
	title?: string | null
	subtitle?: string | null
	onBackClick?: () => void
	showActions?: boolean
	/**
	 * 右上动作槽位的布局变体，命名直接对齐承载它的路由：
	 *
	 * - "project-entry"：项目入口页（RouteName.SuperWorkspaceProjectState，
	 *   路径 `/super/:projectId`）使用。渲染胶囊容器 + 两个 48×48 槽位
	 *   （COLLABORATION + MORE），分别承载"项目分享"和"更多"。
	 *   两个 portal 都会被消费方 ProjectPage 注入按钮。
	 *
	 * - "project-topic"：项目话题子页（RouteName.SuperWorkspaceProjectTopicState，
	 *   路径 `/super/:projectId/:topicId`）使用。只渲染一个 48×48 圆形按钮槽位
	 *   （仅 MORE），承载话题级"更多"Action Sheet 入口。
	 *   COLLABORATION 槽位故意不渲染，避免胶囊里出现 48px 的空白占位。
	 *
	 * 命名注意：单话题 Chat 路由 SuperChatProjectState 走的是独立的
	 * ChatProjectHeroHeader，不会进入这里，所以本枚举里不会出现 "chat" 类型，
	 * 不要误以为可以靠这个开关切到 chat-mode 的头部布局。
	 *
	 * 实现注意：portal ID 本身是跨页面的稳定契约，不要在页面层判断路由再
	 * 决定是否注入；统一通过这个布局开关声明"壳层会暴露哪些槽位"，由页面
	 * 在合适时机往对应槽位 createPortal。
	 */
	actionsLayout?: "project-entry" | "project-topic"
}

/**
 * 项目详情页头部：与原型 ProjectDetailScreen 顶栏一致（h-14、底圆角、无单独铺色，与页面 background 连成一块）。
 */
export function ProjectDetailHeader({
	title,
	subtitle,
	onBackClick,
	showActions = true,
	actionsLayout = "project-entry",
}: ProjectDetailHeaderProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className={cn(
				"relative z-10 flex h-14 shrink-0 items-center gap-2 rounded-b-[14px] px-[10px]",
				"pb-0 pt-3",
			)}
			data-testid="project-detail-header-root"
		>
			<button
				type="button"
				onClick={onBackClick}
				className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card text-foreground transition-colors"
				aria-label={t("projectDetail.backAria")}
				style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
				data-testid="project-detail-header-back-button"
			>
				<ChevronLeft size={22} strokeWidth={2} />
			</button>
			<div className="pointer-events-none absolute inset-x-0 flex flex-col items-center px-[114px] text-center">
				<p
					className="w-full truncate font-poppins text-[18px] font-medium leading-6 text-foreground"
					data-testid="project-detail-header-title"
				>
					{title || ""}
				</p>
				{subtitle ? (
					<p className="w-full truncate text-[12px] leading-4 text-muted-foreground">
						{subtitle}
					</p>
				) : null}
			</div>
			{showActions && actionsLayout === "project-entry" ? (
				// 项目入口页路由使用胶囊容器，暴露“协作管理 + 更多”两个头部动作槽位。
				<div
					className="ml-auto flex h-12 shrink-0 items-stretch overflow-hidden rounded-full bg-card text-foreground"
					style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
					data-testid="project-detail-header-actions"
				>
					<div
						className="flex h-12 w-12 items-center justify-center"
						id={PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_COLLABORATION_BUTTON}
					/>
					<div
						className="flex h-12 w-12 items-center justify-center"
						id={PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_MORE_BUTTON}
					/>
				</div>
			) : null}
			{showActions && actionsLayout === "project-topic" ? (
				// 项目话题子页路由只暴露一个圆形“更多”槽位，避免空协作槽占位。
				<div
					className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-foreground"
					style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
					data-testid="project-detail-header-actions"
					id={PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_MORE_BUTTON}
				/>
			) : null}
		</div>
	)
}
