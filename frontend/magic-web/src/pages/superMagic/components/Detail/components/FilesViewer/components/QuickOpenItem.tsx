import type { ReactNode } from "react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { getFileTreeIconType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { DropdownMenuItem } from "@/components/shadcn-ui/dropdown-menu"
import type { FileItem, WebsitePreset } from "../types"

export interface QuickOpenRowProps {
	ariaLabel: string
	description?: string
	icon: ReactNode
	onClick: () => void
	title: string
}

export function getFileTitle(file: FileItem) {
	return file.display_filename || file.file_name || file.filename || file.file_id
}

export function getFileDescription(file: FileItem) {
	const parts = (file.relative_file_path || "").split("/")
	parts.pop()
	return parts.filter(Boolean).join(" / ")
}

export function flattenFiles(items: FileItem[]) {
	const result: FileItem[] = []
	const visit = (children: FileItem[]) => {
		children.forEach((item) => {
			// A hidden directory hides its entire subtree, not just its own row.
			if (item.is_hidden) return
			if (!item.is_directory) result.push(item)
			if (item.children?.length) visit(item.children)
		})
	}
	visit(items)
	return result
}

export function looksLikeUrl(value: string) {
	const trimmed = value.trim()
	return (
		/^https?:\/\//i.test(trimmed) ||
		/^localhost(?::\d+)?(?:\/|$)/i.test(trimmed) ||
		/^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/i.test(trimmed)
	)
}

export function WebsitePresetIcon({ iconSrc, presetId }: { iconSrc?: string; presetId: string }) {
	if (!iconSrc) return null

	return (
		<img
			data-testid={`website-preset-icon-${presetId}`}
			className="size-7 shrink-0 rounded-md object-cover outline outline-1 outline-black/10"
			src={iconSrc}
			alt=""
			aria-hidden="true"
		/>
	)
}

export function FilePresetIcon({ file }: { file: FileItem }) {
	return (
		<MagicFileIcon
			type={getFileTreeIconType(file) || file.file_extension}
			size={28}
			className="shrink-0"
		/>
	)
}

export function CommonWebsiteIcon({ title, id }: Pick<WebsitePreset, "title" | "id">) {
	return (
		<span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
			{(title || id).slice(0, 1).toUpperCase()}
		</span>
	)
}

export function QuickOpenRow({ ariaLabel, description, icon, onClick, title }: QuickOpenRowProps) {
	return (
		<DropdownMenuItem
			aria-label={ariaLabel}
			className="group flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md px-2 py-2"
			onClick={onClick}
		>
			{icon}
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm leading-5 text-foreground">{title}</span>
				{description ? (
					<span className="block truncate text-xs leading-4 text-muted-foreground">
						{description}
					</span>
				) : null}
			</span>
		</DropdownMenuItem>
	)
}
