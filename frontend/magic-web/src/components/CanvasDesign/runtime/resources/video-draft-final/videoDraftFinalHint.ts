/** 样片转正片的固定有效期。截止时间由完成时间按日历日顺延，不写死某一天。 */
export const VIDEO_DRAFT_FINAL_VALID_DAYS = 7

export interface VideoDraftFinalHint {
	/** 本地时间，格式 YYYY/MM/DD HH:mm。完成时间缺失时不给出截止时间。 */
	deadlineText?: string
	expired: boolean
}

export function resolveVideoDraftFinalHint(
	finishedAt: string | null | undefined,
	now = Date.now(),
): VideoDraftFinalHint {
	const finishedAtMs = parseFinishedAt(finishedAt)
	if (finishedAtMs === null) return { expired: false }

	const deadline = new Date(finishedAtMs)
	deadline.setDate(deadline.getDate() + VIDEO_DRAFT_FINAL_VALID_DAYS)
	return {
		deadlineText: formatDeadline(deadline),
		expired: now >= deadline.getTime(),
	}
}

function parseFinishedAt(value?: string | null): number | null {
	if (!value) return null
	const trimmed = value.trim()
	if (!trimmed) return null
	const matched = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|T)(\d{2}):(\d{2})(?::(\d{2}))?/)
	if (matched) {
		const [, year, month, day, hour, minute, second] = matched
		return new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second ?? 0),
		).getTime()
	}
	const timestamp = Date.parse(trimmed)
	return Number.isFinite(timestamp) ? timestamp : null
}

function formatDeadline(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0")
	return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
