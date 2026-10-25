import { Skeleton } from "@magic-admin-v2/components/ui/skeleton";

/**
 * 二级页面代码分包加载时的页面级骨架。
 *
 * DashboardLayout 已经渲染完成后，子路由只需要占位内容区域，因此这里
 * 复用新版页面最常见的「页头 + 分隔线 + 筛选/Tab + 内容卡片」布局。
 * 列表接口加载阶段仍由各页面自行使用 ListPageSkeleton 或更具体的骨架。
 */
export function SecondaryPageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="-m-4 min-h-[calc(100vh-4rem)] px-4 py-6 lg:px-6"
      data-testid="secondary-page-loading"
    >
      <SecondaryPageHeaderSkeleton />

      <div className="my-4 h-px bg-border lg:my-6" aria-hidden="true" />

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>

        <div className="flex flex-wrap items-end gap-2" aria-hidden="true">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-56 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>

        <SecondaryPageContentSkeleton />
      </div>
    </div>
  );
}

function SecondaryPageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-3" aria-hidden="true">
        <Skeleton className="h-7 w-36 rounded-md" />
        <Skeleton className="h-4 w-72 max-w-full rounded-md" />
      </div>
      <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

function SecondaryPageContentSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
      <div className="min-w-[940px]" aria-hidden="true">
        <div className="grid grid-cols-[minmax(220px,1.8fr)_repeat(5,minmax(120px,1fr))] border-b">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="px-4 py-3" key={index}>
              <Skeleton className={index === 0 ? "h-4 w-24" : "h-4 w-16"} />
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div
            className="grid grid-cols-[minmax(220px,1.8fr)_repeat(5,minmax(120px,1fr))] border-b last:border-b-0"
            key={rowIndex}
          >
            {Array.from({ length: 6 }).map((__, columnIndex) => (
              <div className="px-4 py-3" key={columnIndex}>
                <Skeleton
                  className={columnIndex === 0 ? "h-5 w-40 rounded-md" : "h-5 w-20 rounded-md"}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}
