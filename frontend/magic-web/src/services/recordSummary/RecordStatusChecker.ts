/**
 * Record status checker for checking the status of the recording
 * 录制状态检查器，用于检查录制状态
 */
class RecordStatusChecker {
	timer: NodeJS.Timeout | null = null

	INTERVAL_MS = 5000 // 5 seconds

	checkFunction: () => boolean

	constructor(checkFunction: () => boolean) {
		this.checkFunction = checkFunction
		this.start()
	}

	get isRunning() {
		return this.timer !== null
	}

	start() {
		if (this.timer) {
			clearInterval(this.timer)
		}
		this.timer = setInterval(() => {
			const result = this.checkFunction()
			if (result) {
				this.stop()
			}
		}, this.INTERVAL_MS)
	}

	stop() {
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
	}
}

export default RecordStatusChecker
