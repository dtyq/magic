import { Skeleton } from "@magic-admin-v2/components/ui/skeleton";
import { cn } from "@magic-admin-v2/utils/cn";

type ListPageSkeletonProps = {
  minWidth?: number;
  columns?: number;
  rows?: number;
  testId?: string;
  /**
   * @deprecated 搜索/筛选区不再使用骨架屏，保留此参数仅兼容旧调用。
   */
  filters?: number;
};

export function ListPageSkeleton({
  minWidth = 1140,
  columns = 8,
  rows = 6,
  testId,
}: ListPageSkeletonProps) {
  const gridTemplateColumns = createGridTemplateColumns(columns);

  return (
    <div className="space-y-4" data-testid={testId}>
      <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
        <div style={{ minWidth }}>
          <div className="grid border-b" style={{ gridTemplateColumns }}>
            {Array.from({ length: columns }).map((_, index) => (
              <div className="px-4 py-3" key={index}>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              className="grid border-b last:border-b-0"
              key={rowIndex}
              style={{ gridTemplateColumns }}
            >
              {Array.from({ length: columns }).map((__, columnIndex) => (
                <div className="px-4 py-3" key={columnIndex}>
                  <Skeleton className={cn("h-5", columnIndex === 0 ? "w-40" : "w-20")} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

function createGridTemplateColumns(columns: number) {
  if (columns <= 1) {
    return "1fr";
  }

  return `minmax(220px, 1.8fr) repeat(${columns - 1}, minmax(120px, 1fr))`;
}
