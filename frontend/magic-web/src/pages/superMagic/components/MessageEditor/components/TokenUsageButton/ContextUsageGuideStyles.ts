/** 对话正文使用项目 Tailwind 与主题变量；窄正文按帮助面板的容器宽度换行。 */
export const CONTEXT_USAGE_GUIDE_STYLES = {
	article:
		"text-[13px] leading-[1.75] [&_h3]:mb-2.5 [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground",
	"article-intro":
		"-mt-3 mb-[22px] text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground",
	visual: "rounded-[15px] border bg-muted/30 p-4",
	"visual-title":
		"mb-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground [&_span:last-child]:text-[10px]",
	flow: "grid grid-cols-[1fr_16px_1fr] items-center gap-2.5 [@container_help-article_(max-width:420px)]:grid-cols-1",
	"flow-arrow":
		"text-muted-foreground [@container_help-article_(max-width:420px)]:m-auto [@container_help-article_(max-width:420px)]:rotate-90",
	paper: "rounded-[11px] border bg-background p-[11px]",
	"paper-title": "mb-2 flex items-center gap-1.5 text-xs font-medium",
	"history-lines": "flex flex-col gap-1",
	"history-line":
		"rounded-[5px] bg-muted px-1.5 py-0.5 text-[10px] leading-normal text-muted-foreground",
	"history-line-short":
		"w-3/4 rounded-[5px] bg-muted px-1.5 py-0.5 text-[10px] leading-normal text-muted-foreground",
	"summary-pills":
		"grid grid-cols-2 gap-1.5 [&_span]:rounded-md [&_span]:bg-emerald-50 [&_span]:p-1.5 [&_span]:text-center [&_span]:text-[10px] [&_span]:text-emerald-700 dark:[&_span]:bg-emerald-950/40 dark:[&_span]:text-emerald-300",
	recent: "mt-2 border-t pt-1.5 text-[10px] text-muted-foreground",
	"visual-caption": "mt-2.5 text-[11px] text-muted-foreground",
	"short-grid":
		"mt-5 grid grid-cols-2 gap-[15px] [@container_help-article_(max-width:420px)]:grid-cols-1",
	"short-item":
		"flex items-start gap-2 [&_svg]:mt-0.5 [&_svg]:shrink-0 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400 [&_strong]:text-xs [&_strong]:font-medium [&_p]:mt-1 [&_p]:text-[11px] [&_p]:leading-[1.75] [&_p]:text-muted-foreground",
	"simple-note": "mt-5 flex items-center gap-2 border-t pt-3 text-[11px] text-muted-foreground",
	"budget-track": "relative mb-2.5 mt-3 flex h-5 gap-px overflow-hidden rounded-md bg-muted",
	"budget-marker": "absolute inset-y-0 left-[90%] w-0.5 bg-foreground/60",
	"budget-labels": "flex justify-between gap-3 text-[11px]",
	"capacity-inputs":
		"mt-3.5 grid grid-cols-2 gap-2.5 [@container_help-article_(max-width:420px)]:grid-cols-1",
	"capacity-input":
		"flex items-center gap-2.5 rounded-[10px] border bg-background p-3 [&_svg]:shrink-0 [&_strong]:text-[11px] [&_strong]:font-medium [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-muted-foreground",
	related: "mt-[30px] border-t pt-5",
	"reading-heading":
		"mb-3 flex items-center gap-2 text-[13px] font-medium text-foreground [&_svg]:text-muted-foreground",
	"reading-grid":
		"grid grid-cols-2 gap-3 [@container_help-article_(max-width:520px)]:grid-cols-1",
	"reading-card":
		"group/reading h-auto w-full min-w-0 justify-start gap-3 whitespace-normal rounded-xl bg-background p-[15px] text-left hover:border-[var(--help-accent)] hover:bg-[var(--help-soft)] only:col-span-full",
	"reading-icon":
		"flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-muted/65 text-[var(--help-accent)]",
	"reading-copy": "flex min-w-0 flex-1 flex-col gap-1",
	"reading-title": "text-xs font-medium leading-relaxed",
	"reading-description": "text-[11px] font-normal leading-[1.7] text-muted-foreground",
	"reading-arrow":
		"shrink-0 text-muted-foreground transition-transform group-hover/reading:translate-x-0.5 group-hover/reading:text-[var(--help-accent)] motion-reduce:transition-none",
	lesson: "mt-[30px] border-t pt-0.5 [&_section]:mt-7 [&_h3]:mb-3 [&_h3]:mt-0 [&_h3]:text-[15px] [&_h3]:leading-relaxed [&_p]:my-2.5 [&_p]:text-[13px] [&_p]:leading-[1.95] [&_p]:text-muted-foreground",
	"lesson-example": "my-4 rounded-xl border bg-muted/25 px-[18px] py-4",
	"lesson-label": "mb-3 text-[11px] text-muted-foreground",
	"lesson-table":
		"my-4 overflow-hidden rounded-xl border [&>div]:grid [&>div]:grid-cols-[112px_1fr] [&>div]:gap-3.5 [&>div]:px-4 [&>div]:py-3 [&>div]:text-xs [&>div]:leading-[1.85] [&>div+div]:border-t [&_strong]:font-medium [&_span:last-child]:text-muted-foreground [@container_help-article_(max-width:420px)]:[&>div]:grid-cols-[88px_1fr] [@container_help-article_(max-width:420px)]:[&>div]:gap-2 [@container_help-article_(max-width:420px)]:[&>div]:px-3",
	"lesson-table-head": "bg-muted/35 text-[11px]",
} as const
