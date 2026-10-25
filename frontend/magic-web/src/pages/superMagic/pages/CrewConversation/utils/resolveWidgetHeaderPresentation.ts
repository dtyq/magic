import type { MagicWidget } from "@magic-web/widget-sdk"

/** Display order for header buttons. Kept local so the iframe does not import the SDK field validator. */
const WIDGET_HEADER_ACTION_NAMES: MagicWidget.HeaderActionName[] = [
	"fullscreen",
	"pin",
	"newTopic",
	"history",
	"share",
	"more",
	"close",
]
import type {
	MessageHeaderBuiltinAction,
	MessageHeaderTitlePresentation,
} from "@/pages/superMagic/components/MessageHeader/headerSlots"

export interface WidgetHeaderPresentation {
	visible: boolean
	showClose: boolean
	title: MessageHeaderTitlePresentation
	visibleActions: ReadonlySet<MagicWidget.HeaderActionName>
}

interface ResolveWidgetHeaderPresentationParams {
	header?: MagicWidget.HeaderConfig
	/** Mirrors `window.closable`. Omitted means the host window can close. */
	windowClosable?: boolean
	fallbackTitle: string
}

/** Maps host header config into shell slots without reading stores, i18n, or the DOM. */
export function resolveWidgetHeaderPresentation({
	header,
	windowClosable,
	fallbackTitle,
}: ResolveWidgetHeaderPresentationParams): WidgetHeaderPresentation {
	const actions = header?.actions
	const titleLine = resolveHeaderTitleLine(header?.title, fallbackTitle)

	return {
		visible: header?.visible !== false,
		// `false` hides close, `true` forces it, and omission follows window.closable.
		showClose: actions?.close ?? windowClosable !== false,
		title: resolveTitlePresentation(header?.topicName, titleLine),
		visibleActions: resolveVisibleActions(actions),
	}
}

interface HeaderTitleLine {
	text: string
	visible: boolean
}

/** Resolves the first line. Hidden mode drops it; a missing string still uses the shell label. */
function resolveHeaderTitleLine(
	title: MagicWidget.HeaderConfig["title"],
	fallbackTitle: string,
): HeaderTitleLine {
	if (title && typeof title === "object") {
		if (title.mode === "hidden") return { text: "", visible: false }
		return { text: title.text?.trim() || fallbackTitle, visible: true }
	}
	return { text: title?.trim() || fallbackTitle, visible: true }
}

/** Reports whether a host-configured action should stay available to the shell or adapter. */
export function isWidgetHeaderActionVisible(
	presentation: WidgetHeaderPresentation,
	action: MagicWidget.HeaderActionName,
): boolean {
	return presentation.visibleActions.has(action)
}

/** Reports visibility for actions the shared shell already owns. */
export function isWidgetBuiltinActionVisible(
	presentation: WidgetHeaderPresentation,
	action: MessageHeaderBuiltinAction,
): boolean {
	return presentation.visibleActions.has(action)
}

/** Resolves the topic line. Static and hidden labels are display-only. */
function resolveTitlePresentation(
	topicName: MagicWidget.HeaderConfig["topicName"],
	titleLine: HeaderTitleLine,
): MessageHeaderTitlePresentation {
	const mode = topicName?.mode ?? "current"
	const primaryFields = {
		primary: titleLine.text,
		...(titleLine.visible ? {} : { primaryVisible: false as const }),
	}
	if (mode === "hidden") {
		return {
			...primaryFields,
			secondaryMode: "fixed",
			secondaryText: "",
			renameEnabled: false,
		}
	}
	if (mode === "static") {
		return {
			...primaryFields,
			secondaryMode: "fixed",
			secondaryText: topicName?.text ?? "",
			renameEnabled: false,
		}
	}
	return {
		...primaryFields,
		secondaryMode: "live",
		renameEnabled: true,
	}
}

/** Treats an omitted action flag as visible. Only an explicit `false` hides it. */
function resolveVisibleActions(
	actions: MagicWidget.HeaderConfig["actions"],
): Set<MagicWidget.HeaderActionName> {
	return new Set(WIDGET_HEADER_ACTION_NAMES.filter((action) => actions?.[action] !== false))
}
