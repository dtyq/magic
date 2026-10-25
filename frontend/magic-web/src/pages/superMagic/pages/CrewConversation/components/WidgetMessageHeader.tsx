import type { ComponentProps, ReactNode } from "react"
import { useMemoizedFn } from "ahooks"
import { Maximize2, Pin, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MagicWidget } from "@magic-web/widget-sdk"
import { MagicTooltip } from "@/components/base"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import MessageHeader from "@/pages/superMagic/components/MessageHeader"
import {
	isWidgetBuiltinActionVisible,
	isWidgetHeaderActionVisible,
	resolveWidgetHeaderPresentation,
} from "../utils/resolveWidgetHeaderPresentation"

type MessageHeaderShellProps = Omit<
	ComponentProps<typeof MessageHeader>,
	| "titlePresentation"
	| "isBuiltinActionVisible"
	| "onBuiltinAction"
	| "addonActionsBefore"
	| "addonActionsAfter"
>

interface WidgetMessageHeaderProps extends MessageHeaderShellProps {
	header?: MagicWidget.HeaderConfig
	/** Mirrors `window.closable` when the host did not set `header.actions.close`. */
	windowClosable?: boolean
	onHeaderAction: (
		action: MagicWidget.HeaderActionName,
		context?: Omit<MagicWidget.HeaderActionContext, "action">,
	) => Promise<boolean>
}

const headerIconButtonClassName =
	"!size-[var(--conversation-header-button-size,24px)] !min-h-6 !min-w-6 !rounded-md !p-0"

/** Renders the crew widget header by mapping host config onto the shared conversation header. */
function WidgetMessageHeader({
	header,
	windowClosable,
	onHeaderAction,
	...headerProps
}: WidgetMessageHeaderProps) {
	const { t } = useTranslation("super")
	const presentation = resolveWidgetHeaderPresentation({
		header,
		windowClosable,
		fallbackTitle: t("messageHeader.widgetTitle"),
	})
	const requestAction = useMemoizedFn((action: MagicWidget.HeaderActionName) => {
		return notifyWidgetHeaderAction({
			action,
			onHeaderAction,
			topicId: headerProps.topicStore.selectedTopic?.id,
			topicName: headerProps.topicStore.selectedTopic?.topic_name,
			onError: () => magicToast.error(t("messageHeader.headerActionFailed")),
		})
	})

	if (!presentation.visible) return null

	const addonActionsBefore = (
		<>
			{isWidgetHeaderActionVisible(presentation, "fullscreen") ? (
				<WidgetHeaderIconButton
					title={t("messageHeader.fullscreen")}
					testId="message-header-fullscreen-button"
					onClick={() => void requestAction("fullscreen")}
					icon={<Maximize2 size={16} />}
				/>
			) : null}
			{isWidgetHeaderActionVisible(presentation, "pin") ? (
				<WidgetHeaderIconButton
					title={t("messageHeader.pinWindow")}
					testId="message-header-pin-window-button"
					onClick={() => void requestAction("pin")}
					icon={<Pin size={16} />}
				/>
			) : null}
		</>
	)
	const addonActionsAfter =
		presentation.showClose && isWidgetHeaderActionVisible(presentation, "close") ? (
			<WidgetHeaderIconButton
				title={t("messageHeader.closeWidget")}
				testId="message-header-close-button"
				onClick={() => void requestAction("close")}
				icon={<X size={16} />}
			/>
		) : null

	return (
		<MessageHeader
			{...headerProps}
			titlePresentation={presentation.title}
			isBuiltinActionVisible={(action) =>
				isWidgetBuiltinActionVisible(presentation, action) &&
				(action !== "history" || headerProps.showTopicHistory !== false)
			}
			onBuiltinAction={requestAction}
			addonActionsBefore={addonActionsBefore}
			addonActionsAfter={addonActionsAfter}
		/>
	)
}

interface RequestWidgetHeaderActionParams {
	action: MagicWidget.HeaderActionName
	onHeaderAction: WidgetMessageHeaderProps["onHeaderAction"]
	topicId?: string
	topicName?: string
	onError: () => void
}

/**
 * Notifies the host after a header action.
 * `headerActionHandled` is informational; the iframe does not fall back.
 * A thrown or rejected handler is reported and does not undo the action.
 */
async function notifyWidgetHeaderAction({
	action,
	onHeaderAction,
	topicId,
	topicName,
	onError,
}: RequestWidgetHeaderActionParams): Promise<void> {
	try {
		await onHeaderAction(action, {
			topicId,
			topicName,
		})
	} catch {
		onError()
	}
}

interface WidgetHeaderIconButtonProps {
	title: string
	testId: string
	onClick: () => void
	icon: ReactNode
}

/** Matches the shared header icon hit target for host-owned fullscreen, pin, and close. */
function WidgetHeaderIconButton({ title, testId, onClick, icon }: WidgetHeaderIconButtonProps) {
	return (
		<MagicTooltip title={title}>
			<span>
				<Button
					variant="ghost"
					size="icon-sm"
					className={headerIconButtonClassName}
					data-testid={testId}
					onClick={onClick}
				>
					{icon}
				</Button>
			</span>
		</MagicTooltip>
	)
}

export default WidgetMessageHeader
