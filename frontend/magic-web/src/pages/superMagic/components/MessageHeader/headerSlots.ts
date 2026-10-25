/** Built-in actions already rendered by the shared conversation header. */
export type MessageHeaderBuiltinAction = "newTopic" | "history" | "share" | "more"

/**
 * Optional title model for callers that need a second line.
 * The shared header keeps its single-line topic title when this is omitted.
 */
export interface MessageHeaderTitlePresentation {
	primary: string
	/** False omits the first line. Omitted keeps that line visible. */
	primaryVisible?: boolean
	/** `live` shows the current topic title; `fixed` shows `secondaryText`, which may be empty. */
	secondaryMode: "live" | "fixed"
	secondaryText?: string
	/** Static or hidden labels must not enter the Magic topic rename flow. */
	renameEnabled: boolean
}
