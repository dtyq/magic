import { memo, useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import AICardIframe from "./AICardIframe"
import type { AICardHistoryEntry } from "../types"

interface AICardHistoryProps {
	entries: AICardHistoryEntry[]
	cardName: string
	attachmentList?: any[]
	onBack: () => void
}

function AICardHistory({ entries, cardName, attachmentList, onBack }: AICardHistoryProps) {
	const { t } = useTranslation("super")
	const [selectedEntry, setSelectedEntry] = useState<AICardHistoryEntry | null>(null)

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.25 }}
			className="flex h-full flex-col"
		>
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={onBack}
						className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						data-testid="on-back"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M10 12L6 8L10 4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						返回
					</button>
					<div className="h-4 w-px bg-border" />
					<h2 className="text-sm font-semibold text-foreground">{cardName} — 历史版本</h2>
				</div>
			</div>

			{/* Content: timeline + preview */}
			<div className="flex flex-1 overflow-hidden">
				{/* Timeline sidebar */}
				<div className="w-64 flex-shrink-0 overflow-y-auto border-r border-border p-3">
					{entries.length === 0 ? (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							{t("detail.aiCard.history.empty")}
						</div>
					) : (
						<div className="space-y-1">
							{entries.map((entry, index) => (
								<motion.button
									key={entry.fileId}
									type="button"
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: index * 0.03 }}
									onClick={() => setSelectedEntry(entry)}
									className={cn(
										"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
										selectedEntry?.fileId === entry.fileId
											? "bg-primary/10 text-primary"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
								>
									<div className="relative flex-shrink-0">
										<div
											className={cn(
												"h-2.5 w-2.5 rounded-full",
												selectedEntry?.fileId === entry.fileId
													? "bg-primary"
													: "bg-border",
											)}
										/>
										{index < entries.length - 1 && (
											<div className="absolute left-1/2 top-full h-6 w-px -translate-x-1/2 bg-border" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate text-xs font-medium">
											{entry.displayTime}
										</div>
									</div>
								</motion.button>
							))}
						</div>
					)}
				</div>

				{/* Preview area */}
				<div className="flex-1 overflow-auto">
					<AnimatePresence mode="wait">
						{selectedEntry ? (
							<motion.div
								key={selectedEntry.fileId}
								initial={{ opacity: 0, scale: 0.98 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.98 }}
								transition={{ duration: 0.2 }}
								className="h-full"
							>
								<AICardIframe
									fileId={selectedEntry.fileId}
									attachmentList={attachmentList}
									className="h-full w-full"
									style={{ height: "100%" }}
								/>
							</motion.div>
						) : (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="flex h-full items-center justify-center text-sm text-muted-foreground"
							>
								{t("detail.aiCard.history.selectHint")}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</motion.div>
	)
}

export default memo(AICardHistory)
