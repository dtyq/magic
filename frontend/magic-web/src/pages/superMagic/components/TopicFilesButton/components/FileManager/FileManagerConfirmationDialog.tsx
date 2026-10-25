import { useTranslation } from "react-i18next"
import { useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Folder, FileText } from "lucide-react"
import { Input } from "@/components/shadcn-ui/input"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import type { useFileManagerConfirmation } from "../../hooks/useFileManagerConfirmation"

export function FileManagerConfirmationDialog({
	controller,
	title,
	description,
	confirmText,
}: {
	controller: ReturnType<typeof useFileManagerConfirmation>
	title?: string
	description?: string
	confirmText?: string
}) {
	const { t } = useTranslation("super")
	const [text, setText] = useState("")
	const cancel = useRef<HTMLButtonElement>(null)
	const state = controller.state
	const items = state?.items ?? []
	const deleting = state?.operation === "delete"
	const folders = items.filter((item) => item.folder).length
	const required =
		deleting && (folders > 0 || (state?.selectedCount ?? 0) > 1)
			? t("fileManager.confirmation.deletePhrase", { count: items.length })
			: ""
	const titles = {
		move: t("fileManager.confirmation.move"),
		copy: t("fileManager.confirmation.copy"),
		import: t("fileManager.confirmation.import"),
		delete: t("fileManager.confirmation.delete"),
		upload: t("fileManager.confirmation.upload"),
		replace: t("fileManager.confirmation.replace"),
		create: t("fileManager.confirmation.create"),
	}
	return (
		<Dialog
			open={Boolean(state)}
			onOpenChange={(open) => {
				if (!open) controller.cancel()
			}}
		>
			<DialogContent
				className="gap-4 rounded-2xl sm:max-w-lg"
				onOpenAutoFocus={(event) => {
					event.preventDefault()
					setText("")
					cancel.current?.focus()
				}}
			>
				<DialogHeader>
					<DialogTitle>{title ?? (state && titles[state.operation])}</DialogTitle>
					<DialogDescription>
						{t("fileManager.confirmation.scope", {
							selected: state?.selectedCount ?? 0,
							files: items.length - folders,
							folders,
						})}
					</DialogDescription>
				</DialogHeader>
				{description && <p className="text-sm leading-relaxed">{description}</p>}
				<div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs">
					<div className="break-words">
						<span className="text-muted-foreground">
							{t("fileManager.confirmation.source")}{" "}
						</span>
						{state?.source}
					</div>
					{!deleting && (
						<div className="break-words">
							<span className="text-muted-foreground">
								{t("fileManager.confirmation.target")}{" "}
							</span>
							{state?.target}
						</div>
					)}
				</div>
				{items.length * 52 <= 260 ? (
					<div className="space-y-1">
						{items.map((item) => (
							<ConfirmationFileRow key={item.id} item={item} />
						))}
					</div>
				) : (
					<VirtualConfirmationFiles items={items} />
				)}
				{Boolean(state?.skippedCount) && (
					<p className="text-xs text-muted-foreground">
						{t("fileManager.confirmation.skipped", { count: state?.skippedCount })}
					</p>
				)}
				<p className="text-xs leading-relaxed text-muted-foreground">
					{state?.warning ||
						(deleting
							? t("fileManager.confirmation.deleteWarning")
							: state?.operation === "move"
								? t("fileManager.confirmation.moveWarning")
								: state?.operation === "replace"
									? t("fileManager.confirmation.replaceWarning")
									: t("fileManager.confirmation.writeWarning"))}
				</p>
				{required && (
					<label className="space-y-2 text-sm">
						<span>
							{t("fileManager.confirmation.typePhrase", { phrase: required })}
						</span>
						<Input
							value={text}
							onChange={(event) => setText(event.target.value)}
							autoComplete="off"
						/>
					</label>
				)}
				<DialogFooter>
					<Button ref={cancel} variant="outline" onClick={controller.cancel}>
						{t("common.cancel")}
					</Button>
					<Button
						variant={deleting ? "destructive" : "default"}
						disabled={Boolean(required && text !== required)}
						onClick={controller.accept}
					>
						{confirmText ?? (state && titles[state.operation])}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

type ConfirmationItem = NonNullable<
	ReturnType<typeof useFileManagerConfirmation>["state"]
>["items"][number]

function ConfirmationFileRow({ item }: { item: ConfirmationItem }) {
	const { t } = useTranslation("super")
	const Icon = item.folder ? Folder : FileText
	return (
		<div className="flex min-h-[52px] items-center gap-2 px-3 py-2 text-xs">
			<Icon size={16} className="shrink-0 text-muted-foreground" />
			<div className="min-w-0 flex-1">
				<div className="truncate" title={item.name}>
					{item.name}
					{item.dependency && (
						<span className="ml-2 text-muted-foreground">
							{t("fileManager.confirmation.dependency")}
						</span>
					)}
				</div>
				<div className="truncate text-[11px] text-muted-foreground" title={item.path}>
					{item.path}
				</div>
			</div>
		</div>
	)
}

/** 短清单直接显示；长清单的 ref 和虚拟器随 Portal 内容一起挂载，避免零尺寸空白。 */
function VirtualConfirmationFiles({ items }: { items: ConfirmationItem[] }) {
	const viewport = useRef<HTMLDivElement>(null)
	const rows = useVirtualizer({
		count: items.length,
		getScrollElement: () => viewport.current,
		estimateSize: () => 52,
		overscan: 4,
	})
	return (
		<div ref={viewport} className="h-[260px] overflow-y-auto rounded-md border">
			<div className="relative" style={{ height: rows.getTotalSize() }}>
				{rows.getVirtualItems().map((row) => (
					<div
						key={items[row.index].id}
						className="absolute left-0 top-0 w-full"
						style={{ transform: `translateY(${row.start}px)`, height: row.size }}
					>
						<ConfirmationFileRow item={items[row.index]} />
					</div>
				))}
			</div>
		</div>
	)
}
