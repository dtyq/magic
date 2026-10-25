import { CircleX, ImageOff, LoaderCircle } from "lucide-react"
import styles from "./index.module.css"

export type ContentVersionPlaceholderKind = "loading" | "failed" | "empty"

interface ContentVersionStatusPlaceholderProps {
	kind: ContentVersionPlaceholderKind
	label: string
}

/** Shared status surface for every media version card. */
export default function ContentVersionStatusPlaceholder({
	kind,
	label,
}: ContentVersionStatusPlaceholderProps) {
	const Icon = kind === "loading" ? LoaderCircle : kind === "failed" ? CircleX : ImageOff

	return (
		<div
			className={styles.statusPlaceholder}
			data-kind={kind}
			role={kind === "failed" ? "alert" : "status"}
		>
			<Icon
				size={16}
				className={
					kind === "loading"
						? styles.spinner
						: kind === "failed"
							? styles.failed
							: styles.mutedIcon
				}
				aria-hidden
			/>
			<span className={styles.statusLabel}>{label}</span>
		</div>
	)
}
