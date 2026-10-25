export type ScrollOwner = "user" | "virtuoso" | "history-anchor" | "follow-output" | "explicit"

export interface ScrollOwnershipState {
	owner: ScrollOwner | "idle"
	generation: number
	userIntent: "none" | "forward" | "backward"
	isNearBottom: boolean
	suppressUntil: number
}

export function initialScrollOwnership(now = Date.now()): ScrollOwnershipState {
	return {
		owner: "idle",
		generation: 0,
		userIntent: "none",
		isNearBottom: true,
		suppressUntil: now,
	}
}

export function beginUserScroll(
	state: ScrollOwnershipState,
	direction: "forward" | "backward",
	isNearBottom: boolean,
): ScrollOwnershipState {
	return {
		...state,
		owner: "user",
		userIntent: direction,
		isNearBottom,
		generation: state.generation + 1,
	}
}

export function beginHistoryAnchor(
	state: ScrollOwnershipState,
	generation: number,
): ScrollOwnershipState {
	return {
		...state,
		owner: "history-anchor",
		generation,
		userIntent: "none",
	}
}

export function beginExplicitScroll(state: ScrollOwnershipState): ScrollOwnershipState {
	return {
		...state,
		owner: "explicit",
		generation: state.generation + 1,
		userIntent: "none",
	}
}

export function beginVirtuosoMeasurement(state: ScrollOwnershipState): ScrollOwnershipState {
	return {
		...state,
		owner: "virtuoso",
	}
}

export function beginFollowOutput(state: ScrollOwnershipState): ScrollOwnershipState {
	return {
		...state,
		owner: "follow-output",
		userIntent: "none",
	}
}

export function canFollowOutput(
	state: ScrollOwnershipState,
	input: { totalSizeIncreased: boolean; nearBottom: boolean; now?: number },
): boolean {
	const now = input.now ?? Date.now()
	return (
		input.totalSizeIncreased &&
		input.nearBottom &&
		state.owner !== "history-anchor" &&
		state.owner !== "explicit" &&
		state.userIntent !== "backward" &&
		now >= state.suppressUntil
	)
}

export function finishCorrection(
	state: ScrollOwnershipState,
	owner: Exclude<ScrollOwner, "user" | "virtuoso">,
): ScrollOwnershipState {
	return {
		...state,
		owner: owner === "explicit" ? "idle" : "idle",
	}
}
