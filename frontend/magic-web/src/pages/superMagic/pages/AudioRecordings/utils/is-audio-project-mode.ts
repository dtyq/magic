/** Backend audio-projects list uses project_mode "audio", distinct from legacy TopicMode.RecordSummary */
export const AUDIO_PROJECT_MODE = "audio"

/** Returns true when the project is an audio recording project */
export function isAudioProjectMode(projectMode?: string | null): boolean {
	return projectMode === AUDIO_PROJECT_MODE
}
