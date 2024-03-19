import { isNaN } from "lodash-es"

/**
 * Compares two time strings and determines if the first time is earlier than the second.
 * @param time1 - The first time string in the format "YYYY-MM-DD HH:mm:ss".
 * @param time2 - The second time string in the format "YYYY-MM-DD HH:mm:ss".
 * @returns - true if time1 is earlier than time2, false otherwise.
 */
export function compareTimes(time1: string, time2: string): boolean {
	// Parse the time strings into Date objects
	const date1 = new Date(time1)
	const date2 = new Date(time2)

	// Validate if the parsed dates are valid
	if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
		console.error("Invalid time format. Please use 'YYYY-MM-DD HH:mm:ss'.")
	}

	// Return true if date1 is earlier than date2, false otherwise
	return date1 < date2
}
