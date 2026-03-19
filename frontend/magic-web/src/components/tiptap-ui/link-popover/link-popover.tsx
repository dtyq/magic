"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useIsMobile } from "@/hooks/use-mobile"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { CornerDownLeftIcon } from "@/components/tiptap-icons/corner-down-left-icon"
import { ExternalLinkIcon } from "@/components/tiptap-icons/external-link-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"
import { TrashIcon } from "@/components/tiptap-icons/trash-icon"

// --- Tiptap UI ---
import type { UseLinkPopoverConfig } from "@/components/tiptap-ui/link-popover"
import { useLinkPopover } from "@/components/tiptap-ui/link-popover"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/tiptap-ui-primitive/popover"
import { Card, CardBody, CardItemGroup } from "@/components/tiptap-ui-primitive/card"
import { Input, InputGroup } from "@/components/tiptap-ui-primitive/input"

export interface LinkMainProps {
	/**
	 * The URL to set for the link.
	 */
	url: string
	/**
	 * Function to update the URL state.
	 */
	setUrl: React.Dispatch<React.SetStateAction<string | null>>
	/**
	 * The title to set for the link.
	 */
	title: string
	/**
	 * Function to update the title state.
	 */
	setTitle: React.Dispatch<React.SetStateAction<string | null>>
	/**
	 * Function to set the link in the editor.
	 */
	setLink: () => void
	/**
	 * Function to remove the link from the editor.
	 */
	removeLink: () => void
	/**
	 * Function to open the link.
	 */
	openLink: () => void
	/**
	 * Whether the link is currently active in the editor.
	 */
	isActive: boolean
}

export interface LinkPopoverProps extends Omit<ButtonProps, "type">, UseLinkPopoverConfig {
	/**
	 * Callback for when the popover opens or closes.
	 */
	onOpenChange?: (isOpen: boolean) => void
	/**
	 * Whether to automatically open the popover when a link is active.
	 * @default true
	 */
	autoOpenOnLinkActive?: boolean
}

/**
 * Link button component for triggering the link popover
 */
export const LinkButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, children, ...props }, ref) => {
		const { t } = useTranslation("tiptap")

		return (
			<Button
				type="button"
				className={className}
				data-style="ghost"
				role="button"
				tabIndex={-1}
				aria-label={t("toolbar.link.ariaLabel")}
				tooltip={t("toolbar.link.tooltip")}
				ref={ref}
				{...props}
			>
				{children || <LinkIcon className="tiptap-button-icon" />}
			</Button>
		)
	},
)

/**
 * Main content component for the link popover
 */
const LinkMain: React.FC<LinkMainProps> = ({
	url,
	setUrl,
	title,
	setTitle,
	setLink,
	removeLink,
	openLink,
	isActive,
}) => {
	const isMobile = useIsMobile()
	const { t } = useTranslation("tiptap")

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault()
			setLink()
		}
	}

	return (
		<Card
			style={{
				...(isMobile ? { boxShadow: "none", border: 0 } : {}),
			}}
		>
			<CardBody
				style={{
					...(isMobile ? { padding: 0 } : { padding: "12px" }),
				}}
			>
				<CardItemGroup orientation="vertical" style={{ gap: "8px", alignItems: "stretch" }}>
					<InputGroup style={{ width: "100%" }}>
						<Input
							type="url"
							placeholder={t("toolbar.link.placeholder")}
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							onKeyDown={handleKeyDown}
							autoFocus
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							style={{ width: "100%" }}
						/>
					</InputGroup>
					<InputGroup style={{ width: "100%" }}>
						<Input
							type="text"
							placeholder={t("toolbar.link.titlePlaceholder")}
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							onKeyDown={handleKeyDown}
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							style={{ width: "100%" }}
						/>
					</InputGroup>
					{/* Action Buttons Row */}
					<CardItemGroup
						orientation="horizontal"
						style={{ justifyContent: "flex-end", gap: "4px" }}
					>
						<Button
							type="button"
							onClick={setLink}
							title={t("toolbar.link.apply")}
							disabled={!url && !isActive}
							data-style="ghost"
							style={{ flexShrink: 0 }}
						>
							<CornerDownLeftIcon className="tiptap-button-icon" />
						</Button>
						<Button
							type="button"
							onClick={openLink}
							title={t("toolbar.link.openInNewWindow")}
							disabled={!url && !isActive}
							data-style="ghost"
						>
							<ExternalLinkIcon className="tiptap-button-icon" />
						</Button>
						<Button
							type="button"
							onClick={removeLink}
							title={t("toolbar.link.remove")}
							disabled={!url && !isActive}
							data-style="ghost"
						>
							<TrashIcon className="tiptap-button-icon" />
						</Button>
					</CardItemGroup>
				</CardItemGroup>
			</CardBody>
		</Card>
	)
}

/**
 * Link content component for standalone use
 */
export const LinkContent: React.FC<{
	editor?: Editor | null
}> = ({ editor }) => {
	const linkPopover = useLinkPopover({
		editor,
	})

	return (
		<LinkMain
			url={linkPopover.url}
			setUrl={linkPopover.setUrl}
			title={linkPopover.title}
			setTitle={linkPopover.setTitle}
			setLink={linkPopover.setLink}
			removeLink={linkPopover.removeLink}
			openLink={linkPopover.openLink}
			isActive={linkPopover.isActive}
		/>
	)
}

/**
 * Link popover component for Tiptap editors.
 *
 * For custom popover implementations, use the `useLinkPopover` hook instead.
 */
export const LinkPopover = React.forwardRef<HTMLButtonElement, LinkPopoverProps>(
	(
		{
			editor: providedEditor,
			hideWhenUnavailable = false,
			onSetLink,
			onOpenChange,
			autoOpenOnLinkActive = true,
			onClick,
			children,
			...buttonProps
		},
		ref,
	) => {
		const { editor } = useTiptapEditor(providedEditor)
		const [isOpen, setIsOpen] = React.useState(false)

		const {
			isVisible,
			canSet,
			isActive,
			url,
			setUrl,
			title,
			setTitle,
			setLink,
			removeLink,
			openLink,
			label,
			Icon,
		} = useLinkPopover({
			editor,
			hideWhenUnavailable,
			onSetLink,
		})

		const handleOnOpenChange = React.useCallback(
			(nextIsOpen: boolean) => {
				setIsOpen(nextIsOpen)
				onOpenChange?.(nextIsOpen)
			},
			[onOpenChange],
		)

		const handleSetLink = React.useCallback(() => {
			setLink()
			setIsOpen(false)
		}, [setLink])

		const handleClick = React.useCallback(
			(event: React.MouseEvent<HTMLButtonElement>) => {
				onClick?.(event)
				if (event.defaultPrevented) return
				setIsOpen(!isOpen)
			},
			[onClick, isOpen],
		)

		// Update link state when popover opens
		React.useEffect(() => {
			if (isOpen && editor && isActive) {
				// Force update link state when popover opens and link is active
				const { href, title: linkTitle } = editor.getAttributes("link")
				setUrl(href || "")
				setTitle(linkTitle || "")
			}
		}, [isOpen, editor, isActive, setUrl, setTitle])

		React.useEffect(() => {
			if (autoOpenOnLinkActive && isActive) {
				setIsOpen(true)
			} else if (!autoOpenOnLinkActive && !isActive) {
				// Close popover when link is no longer active (if auto-open is disabled)
				setIsOpen(false)
			}
		}, [autoOpenOnLinkActive, isActive])

		if (!isVisible) {
			return null
		}

		return (
			<Popover open={isOpen} onOpenChange={handleOnOpenChange}>
				<PopoverTrigger asChild>
					<LinkButton
						disabled={!canSet}
						data-active-state={isActive ? "on" : "off"}
						data-disabled={!canSet}
						aria-label={label}
						aria-pressed={isActive}
						onClick={handleClick}
						{...buttonProps}
						ref={ref}
					>
						{children ?? <Icon className="tiptap-button-icon" />}
					</LinkButton>
				</PopoverTrigger>

				<PopoverContent>
					<LinkMain
						url={url}
						setUrl={setUrl}
						title={title}
						setTitle={setTitle}
						setLink={handleSetLink}
						removeLink={removeLink}
						openLink={openLink}
						isActive={isActive}
					/>
				</PopoverContent>
			</Popover>
		)
	},
)

export default LinkPopover
