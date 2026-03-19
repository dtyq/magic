/**
 * 格式化时长显示 - 始终显示时分秒格式
 */
export const formatDuration = (milliseconds: number): string => {
	const seconds = Math.floor(milliseconds / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)

	const displayMinutes = minutes % 60
	const displaySeconds = seconds % 60

	return `${hours.toString().padStart(2, "0")}:${displayMinutes
		.toString()
		.padStart(2, "0")}:${displaySeconds.toString().padStart(2, "0")}`
}
