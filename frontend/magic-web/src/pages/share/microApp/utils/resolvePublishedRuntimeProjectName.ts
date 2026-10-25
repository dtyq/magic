/** Backend stores the special key as project_name when the runtime project has no title. */
const RUNTIME_PROJECT_KEY_PREFIX = "micro-app-runtime_"

export function resolvePublishedRuntimeProjectName(name?: string | null): string | undefined {
	const trimmed = name?.trim()
	if (!trimmed || trimmed.startsWith(RUNTIME_PROJECT_KEY_PREFIX)) return undefined
	return trimmed
}
