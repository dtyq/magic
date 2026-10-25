import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { FileHelpContext } from "../utils/magic-system-folder"
import type { AttachmentItem } from "../hooks/types"
import { getFilePresentationIndex, resolveFilePresentation } from "../utils/file-presentation"
import { FileDirectoryRow } from "./FileDirectoryRow"

export interface FileDirectoryExampleProps {
	mode: "example"
	items: AttachmentItem[]
	rootName: string
	fileHelpContext: FileHelpContext
	descriptions?: Readonly<Record<string, string>>
}

export function FileDirectoryView({
	items,
	rootName,
	fileHelpContext,
	descriptions,
}: FileDirectoryExampleProps) {
	const { t } = useTranslation("super")
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
	const index = getFilePresentationIndex(items)
	const entries = [...index.attachments.entriesByKey.values()].filter(
		(entry) =>
			!index.attachments
				.getPathKeys(entry.key)
				.slice(0, -1)
				.some((key) => collapsed.has(key)),
	)
	return (
		<div className="overflow-hidden rounded-lg border bg-background">
			<div className="border-b px-4 py-2 text-xs text-muted-foreground">{rootName}</div>
			<div className="px-2 py-1">
				{entries.map(({ key, item, level }) => (
					<FileDirectoryRow
						key={key}
						mode="example"
						presentation={resolveFilePresentation(item, {
							context: fileHelpContext,
							index,
						})}
						depth={level}
						description={descriptions?.[index.skills.paths.get(key) ?? ""]}
						expanded={!collapsed.has(key)}
						onExpand={() =>
							setCollapsed((previous) => {
								const next = new Set(previous)
								if (next.has(key)) next.delete(key)
								else next.add(key)
								return next
							})
						}
					/>
				))}
			</div>
			<div className="border-t px-4 py-2 text-xs text-muted-foreground">
				{t("userSpace.itemCount", { count: entries.length })}
			</div>
		</div>
	)
}
