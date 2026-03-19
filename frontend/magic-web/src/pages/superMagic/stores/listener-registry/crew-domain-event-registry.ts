export interface CrewDomainEventPayload<TMessage, TMessageNode = unknown> {
	type: "crew_detail_refresh_requested"
	crewCode: string
	topicId: string
	toolName: string
	message: TMessage
	messageNode: TMessageNode
}
