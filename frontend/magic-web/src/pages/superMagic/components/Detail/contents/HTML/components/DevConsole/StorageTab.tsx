import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Cookie, Database, HardDrive, RefreshCw, ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StorageSnapshot } from "./types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateValue(value: string, maxLen = 200): string {
	if (value.length <= maxLen) return value
	return value.slice(0, maxLen) + "…"
}

// ─── Storage Section ─────────────────────────────────────────────────────────

interface StorageSectionProps {
	title: string
	icon: React.ReactNode
	data: Record<string, string>
	emptyText: string
}

function StorageSection({ title, icon, data, emptyText }: StorageSectionProps) {
	const [expanded, setExpanded] = useState(true)
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
	const entries = Object.entries(data)

	const toggleKey = (key: string) => {
		setExpandedKeys((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	return (
		<div className="border-b border-border/50">
			<button
				className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-medium hover:bg-accent/50"
				onClick={() => setExpanded(!expanded)}
			>
				{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
				{icon}
				<span>{title}</span>
				<Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">
					{entries.length}
				</Badge>
			</button>
			{expanded && (
				<div className="pb-1">
					{entries.length === 0 ? (
						<div className="px-4 py-1 text-[10px] text-muted-foreground">
							{emptyText}
						</div>
					) : (
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b border-border/30 text-left text-[10px] text-muted-foreground">
									<th className="w-1/3 px-2 py-0.5 font-medium">Key</th>
									<th className="px-2 py-0.5 font-medium">Value</th>
								</tr>
							</thead>
							<tbody>
								{entries.map(([key, value]) => {
									const isLong = value.length > 200
									const isExpanded = expandedKeys.has(key)
									return (
										<tr
											key={key}
											className="group border-b border-border/20 hover:bg-accent/30"
										>
											<td className="break-all px-2 py-0.5 align-top font-mono text-[11px]">
												{key}
											</td>
											<td className="px-2 py-0.5 align-top font-mono text-[11px] text-muted-foreground">
												{isLong ? (
													<div>
														<span className="whitespace-pre-wrap break-all">
															{isExpanded
																? value
																: truncateValue(value)}
														</span>
														<button
															className="ml-1 text-[10px] text-blue-500 hover:underline"
															onClick={() => toggleKey(key)}
														>
															{isExpanded ? "收起" : "展开"}
														</button>
													</div>
												) : (
													<span className="break-all">{value}</span>
												)}
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					)}
				</div>
			)}
		</div>
	)
}

// ─── IndexedDB Section ───────────────────────────────────────────────────────

interface IndexedDBSectionProps {
	data: StorageSnapshot["indexedDB"]
	emptyText: string
}

function IndexedDBSection({ data, emptyText }: IndexedDBSectionProps) {
	const [expanded, setExpanded] = useState(true)

	return (
		<div className="border-b border-border/50">
			<button
				className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-medium hover:bg-accent/50"
				onClick={() => setExpanded(!expanded)}
			>
				{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
				<Database size={12} className="text-purple-500" />
				<span>IndexedDB</span>
				<Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">
					{data.length}
				</Badge>
			</button>
			{expanded && (
				<div className="pb-1">
					{data.length === 0 ? (
						<div className="px-4 py-1 text-[10px] text-muted-foreground">
							{emptyText}
						</div>
					) : (
						<div className="space-y-0.5 px-2">
							{data.map((db) => (
								<div
									key={db.name}
									className="flex items-center gap-2 rounded px-2 py-0.5 text-xs hover:bg-accent/30"
								>
									<Database size={10} className="text-muted-foreground" />
									<span className="font-mono">{db.name}</span>
									<Badge variant="outline" className="h-4 px-1 text-[10px]">
										v{db.version}
									</Badge>
									{db.objectStores.length > 0 && (
										<span className="text-[10px] text-muted-foreground">
											{db.objectStores.join(", ")}
										</span>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// ─── StorageTab ──────────────────────────────────────────────────────────────

interface StorageTabProps {
	data: StorageSnapshot | null
	onRefresh: () => void
	loading?: boolean
}

export function StorageTab({ data, onRefresh, loading }: StorageTabProps) {
	const { t } = useTranslation("super")

	const emptyText = t("stylePanel.devConsole.storageEmpty")

	if (!data) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
				<span>{t("stylePanel.devConsole.storageNotLoaded")}</span>
				<button
					onClick={onRefresh}
					className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-xs hover:bg-accent/80"
				>
					<RefreshCw size={12} />
					{t("stylePanel.devConsole.storageRefresh")}
				</button>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
			<div className="flex flex-shrink-0 items-center gap-1 border-b border-border/50 px-2 py-1">
				<button
					onClick={onRefresh}
					disabled={loading}
					className={cn(
						"flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-accent",
						loading && "opacity-50",
					)}
				>
					<RefreshCw size={12} className={loading ? "animate-spin" : ""} />
					{t("stylePanel.devConsole.storageRefresh")}
				</button>
			</div>

			{/* Content */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				<StorageSection
					title="Cookies"
					icon={<Cookie size={12} className="text-amber-500" />}
					data={data.cookies}
					emptyText={emptyText}
				/>
				<StorageSection
					title="Local Storage"
					icon={<HardDrive size={12} className="text-blue-500" />}
					data={data.localStorage}
					emptyText={emptyText}
				/>
				<StorageSection
					title="Session Storage"
					icon={<HardDrive size={12} className="text-green-500" />}
					data={data.sessionStorage}
					emptyText={emptyText}
				/>
				<IndexedDBSection data={data.indexedDB} emptyText={emptyText} />
			</div>
		</div>
	)
}
