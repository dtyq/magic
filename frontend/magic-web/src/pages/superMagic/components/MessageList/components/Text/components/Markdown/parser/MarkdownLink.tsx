import { observer } from "mobx-react-lite"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import projectFilesStore from "@/stores/projectFiles"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { findAttachmentByPath } from "./helper"

interface ParsedDomElement {
	attribs?: Record<string, string>
}

export interface MarkdownLinkProps {
	children?: ReactNode
	className?: unknown
	href?: unknown
	rel?: unknown
	target?: unknown
	title?: unknown
	domNode?: ParsedDomElement
}

export const MarkdownLink = observer((props: MarkdownLinkProps) => {
	const { children, className, href, rel, target, title } = props
	const normalizedHref = typeof href === "string" ? href : ""
	const normalizedRel = typeof rel === "string" ? rel : undefined
	const normalizedTarget = typeof target === "string" ? target : undefined
	const normalizedTitle = typeof title === "string" ? title : undefined
	const attachments = projectFilesStore.workspaceFilesList
	const fileInfo = findAttachmentByPath(attachments, normalizedHref)

	const onClick = () => {
		if (!fileInfo) return

		pubsub.publish(PubSubEvents.Open_File_Tab, {
			fileId: fileInfo.file_id,
			fileData: fileInfo,
		})
	}

	if (fileInfo) {
		return (
			<span
				className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded bg-[#f0f6ff] px-1.5 py-0.5 text-xs font-normal leading-5 text-[#315cec] hover:bg-[#e0ecff]"
				onClick={onClick}
				title={typeof children === "string" ? children : normalizedHref}
			>
				{children}
			</span>
		)
	}

	return (
		<a
			href={normalizedHref}
			rel={normalizedRel}
			target={normalizedTarget}
			className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded bg-[#f0f6ff] px-1.5 py-0.5 text-xs font-normal leading-5 !text-[#315cec] hover:bg-[#e0ecff]"
			title={normalizedTitle ?? `File does not exist @${normalizedHref}`}
			{...(props.domNode?.attribs as AnchorHTMLAttributes<HTMLAnchorElement>)}
		>
			{children}
		</a>
	)
})
