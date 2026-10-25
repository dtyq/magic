export type AnalyticsServiceReportArgs<
	EventMap extends object,
	EventType extends Extract<keyof EventMap, string>,
> = EventMap[EventType] extends void ? [] : [payload: EventMap[EventType]]

/** Shared service contract; each edition owns only its reporting implementation. */
export abstract class AnalyticsService<EventMap extends object> {
	abstract report<EventType extends Extract<keyof EventMap, string>>(
		eventType: EventType,
		...args: AnalyticsServiceReportArgs<EventMap, EventType>
	): void
}
