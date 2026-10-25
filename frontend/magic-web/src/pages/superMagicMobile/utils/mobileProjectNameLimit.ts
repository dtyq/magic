/**
 * Maximum character length allowed for project, conversation, or workspace names on mobile H5.
 * Strictly aligned with backend DTO constraints (max: 100 for MoveProjectRequestDTO / ForkProjectRequestDTO).
 */
export const MAX_PROJECT_NAME_LENGTH = 100

/**
 * Maximum character length allowed for workspace names on mobile H5.
 * Strictly aligned with backend SaveWorkspaceRequestDTO constraints (max: 50).
 */
export const MAX_WORKSPACE_NAME_LENGTH = 50

/**
 * Checks whether the project name exceeds the allowed maximum character length.
 *
 * @param name - Candidate project or conversation name
 * @param maxLength - Maximum permitted character count (default 100)
 * @returns True if name character count exceeds maxLength, false otherwise
 */
export function isProjectNameOverLimit(
	name?: string | null,
	maxLength = MAX_PROJECT_NAME_LENGTH,
): boolean {
	if (!name) return false
	return name.length > maxLength
}

/**
 * Checks whether the project name has reached the exact maximum character length limit.
 *
 * @param name - Candidate project or conversation name
 * @param maxLength - Maximum permitted character count (default 100)
 * @returns True if name character count exactly equals maxLength, false otherwise
 */
export function isProjectNameAtLimit(
	name?: string | null,
	maxLength = MAX_PROJECT_NAME_LENGTH,
): boolean {
	if (!name) return false
	return name.length === maxLength
}

/**
 * Defensively clamps a project name to the maximum allowed length.
 * Trims leading/trailing whitespace and truncates string to maxLength.
 *
 * @param name - Raw candidate name string
 * @param maxLength - Maximum permitted character count (default 100)
 * @returns Clamped name string within the limit
 */
export function clampProjectName(
	name?: string | null,
	maxLength = MAX_PROJECT_NAME_LENGTH,
): string {
	if (!name) return ""
	return name.trim().slice(0, maxLength)
}
