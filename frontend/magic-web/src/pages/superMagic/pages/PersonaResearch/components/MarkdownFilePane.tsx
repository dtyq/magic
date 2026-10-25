import { useEffect, useState, type ComponentProps, type ElementType } from "react"
import { Copy } from "lucide-react"
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown"
import remarkGfm from "remark-gfm"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/shadcn-ui/button"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import { clipboard } from "@/utils/clipboard-helpers"
import { useOptionalPersonaResearchStore } from "../context"
import { attachmentVersionKey } from "../services/researchFiles"

// The app has no Tailwind typography plugin, so Markdown elements get explicit compact styles.
type MarkdownTag = "h1" | "h2" | "h3" | "p" | "ul" | "ol" | "blockquote" | "code" | "th" | "td"

/** Drops react-markdown's `node` prop so it never reaches the DOM element. */
function styled<T extends MarkdownTag>(Tag: T, className: string) {
	return function MarkdownElement({ node, ...props }: ComponentProps<T> & ExtraProps) {
		void node
		const Element = Tag as ElementType
		return <Element className={className} {...props} />
	}
}

const MARKDOWN_COMPONENTS: Components = {
	h1: styled("h1", "mb-3 mt-4 text-lg font-semibold first:mt-0"),
	h2: styled("h2", "mb-2 mt-4 text-base font-semibold first:mt-0"),
	h3: styled("h3", "mb-2 mt-3 text-sm font-semibold"),
	p: styled("p", "my-2 leading-6"),
	ul: styled("ul", "my-2 list-disc space-y-1 pl-5"),
	ol: styled("ol", "my-2 list-decimal space-y-1 pl-5"),
	blockquote: styled("blockquote", "my-2 border-l-2 border-border pl-3 text-muted-foreground"),
	code: styled("code", "rounded bg-muted px-1 py-0.5 text-xs"),
	th: styled("th", "border border-border bg-muted/50 px-2 py-1 text-left"),
	td: styled("td", "border border-border px-2 py-1"),
	a: ({ node, ...props }) => {
		void node
		return (
			<a
				className="text-primary underline"
				target="_blank"
				rel="noreferrer noopener"
				{...props}
			/>
		)
	},
	table: ({ node, ...props }) => {
		void node
		return (
			<div className="my-2 overflow-x-auto">
				<table className="w-full border-collapse text-xs" {...props} />
			</div>
		)
	},
}

interface MarkdownFilePaneProps {
	file: AttachmentItem
	copyable?: boolean
}

/**
 * Renders a Markdown output (questionnaire, plan) as text. The previous content stays visible
 * while a newer version loads; a request for an older version never overwrites a newer one.
 */
export default function MarkdownFilePane({ file, copyable = false }: MarkdownFilePaneProps) {
	const { t } = useTranslation("personaResearch")
	const versionKey = attachmentVersionKey(file)
	const [content, setContent] = useState<string | null>(null)
	const [failed, setFailed] = useState(false)
	// Share pages read files with the share token instead of the signed-in session.
	const access = useOptionalPersonaResearchStore()?.fileAccess

	useEffect(() => {
		const controller = new AbortController()
		setFailed(false)
		getFileContentById(String(file.file_id), {
			responseType: "text",
			forceRefresh: true,
			signal: controller.signal,
			access,
		})
			.then((value) => {
				if (!controller.signal.aborted && typeof value === "string") setContent(value)
			})
			.catch(() => {
				if (!controller.signal.aborted) setFailed(true)
			})
		return () => controller.abort()
		// versionKey covers file_id and in-place rewrites by the agent.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [versionKey])

	const handleCopy = async () => {
		if (!content) return
		try {
			await clipboard.writeText(content)
			toast.success(t("common.copied"))
		} catch {
			toast.error(t("common.copyFailed"))
		}
	}

	if (failed && content === null) {
		return <p className="p-4 text-sm text-muted-foreground">{t("state.fileLoadFailed")}</p>
	}
	if (content === null) {
		return <p className="p-4 text-sm text-muted-foreground">{t("state.fileLoading")}</p>
	}

	return (
		<div className="flex flex-col gap-3">
			{copyable ? (
				<div className="flex justify-end">
					<Button variant="outline" size="sm" onClick={() => void handleCopy()}>
						<Copy className="size-4" />
						{t("validation.copy")}
					</Button>
				</div>
			) : null}
			<div className="break-words text-sm text-foreground">
				<ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
					{content}
				</ReactMarkdown>
			</div>
		</div>
	)
}
