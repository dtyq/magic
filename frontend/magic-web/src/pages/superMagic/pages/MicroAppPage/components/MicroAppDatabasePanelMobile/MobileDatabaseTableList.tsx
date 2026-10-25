import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, Loader2, Search, Table2 } from "lucide-react"

import type { MagicBaseTable } from "@/apis/modules/magicBase"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { getMagicBaseTableDisplayName, getMagicBaseTableName } from "../MicroAppDatabasePanel/utils"

interface MobileDatabaseTableListProps {
	tables: MagicBaseTable[]
	loading: boolean
	error?: unknown
	onSelect: (tableId: string) => void
	onRetry: () => void
}

/** Show the table directory first so table data does not compete for space on narrow screens. */
export default function MobileDatabaseTableList({
	tables,
	loading,
	error,
	onSelect,
	onRetry,
}: MobileDatabaseTableListProps) {
	const { t } = useTranslation("super")
	const [keyword, setKeyword] = useState("")
	const filteredTables = useMemo(() => {
		const normalizedKeyword = keyword.trim().toLowerCase()
		if (!normalizedKeyword) return tables
		return tables.filter((table) =>
			[table.table_name, table.table_key, table.description]
				.filter(Boolean)
				.some((value) => value?.toLowerCase().includes(normalizedKeyword)),
		)
	}, [keyword, tables])

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="shrink-0 p-3">
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={keyword}
						onChange={(event) => setKeyword(event.target.value)}
						placeholder={t("microAppPage.databasePanel.searchTables")}
						className="h-10 rounded-xl bg-background pl-9"
					/>
				</div>
			</div>

			{/* Preserve full-height loading and empty states below the fixed search field. */}
			<ScrollArea
				className="grid min-h-0 flex-1"
				viewportClassName="h-auto min-h-0 px-3 pb-5 [&>div]:!block [&>div]:h-full"
			>
				{loading ? (
					<div className="flex h-full items-center justify-center">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : null}

				{!loading && error ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
						<p className="text-sm text-destructive">
							{t("microAppPage.databasePanel.loadTablesFailed")}
						</p>
						<Button type="button" variant="outline" onClick={onRetry}>
							{t("microAppPage.databasePanel.retry")}
						</Button>
					</div>
				) : null}

				{!loading && !error && filteredTables.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
						<div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
							<Table2 className="size-5" aria-hidden />
						</div>
						<p className="text-sm text-muted-foreground">
							{keyword
								? t("microAppPage.databasePanel.noMatchedTables")
								: t("microAppPage.databasePanel.noTables")}
						</p>
					</div>
				) : null}

				<div className="flex flex-col gap-1" data-testid="mobile-magicbase-table-list">
					{filteredTables.map((table) => {
						const displayName = getMagicBaseTableDisplayName(table)
						const tableName = getMagicBaseTableName(table)
						return (
							<button
								key={table.id}
								type="button"
								className="flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-opacity active:opacity-70"
								onClick={() => onSelect(table.id)}
								data-testid={`mobile-magicbase-table-${table.id}`}
							>
								<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<Table2 className="size-[18px]" aria-hidden />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-base font-medium leading-6 text-foreground">
										{displayName}
									</p>
									{tableName && tableName !== displayName ? (
										<p className="truncate text-xs leading-5 text-muted-foreground">
											{tableName}
										</p>
									) : null}
								</div>
								<ChevronRight
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
							</button>
						)
					})}
				</div>
			</ScrollArea>
		</div>
	)
}
