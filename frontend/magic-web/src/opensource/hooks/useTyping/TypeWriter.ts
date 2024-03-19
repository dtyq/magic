// 打字机队列
export class Typewriter {
	private queue: string[] = []

	public consuming = false

	private timer: NodeJS.Timeout | undefined

	constructor(private onConsume: (str: string) => void) {}

	// 输出速度动态控制
	dynamicSpeed() {
		const speed = 2000 / this.queue.length
		if (speed > 200) {
			return 200
		}
		return speed
	}

	// 快速输出模式的速度控制
	fastSpeed() {
		const speed = 500 / this.queue.length
		if (speed > 50) {
			return 50
		}
		return speed < 10 ? 10 : speed // 确保至少有10ms的延迟
	}

	// 添加字符串到队列
	add(str: string) {
		if (!str) return
		this.queue.push(...str.split(""))
	}

	// 消费
	consume() {
		if (this.queue.length > 0) {
			const str = this.queue.shift()
			if (str) {
				this.onConsume(str)
			}
		}
	}

	// 消费下一个
	next(fast = false) {
		this.consume()
		if (this.queue.length === 0) {
			this.consuming = false
			clearTimeout(this.timer)
			return
		}
		// 根据队列中字符的数量来设置消耗每一帧的速度，用定时器消耗
		this.timer = setTimeout(
			() => {
				this.consume()
				if (this.consuming) {
					this.next(fast)
				}
			},
			fast ? this.fastSpeed() : this.dynamicSpeed(),
		)
	}

	// 开始消费队列
	start() {
		this.consuming = true
		this.next()
	}

	// 结束消费队列
	done() {
		this.consuming = true
		clearTimeout(this.timer)
		// 不再一次性消费，而是以更快的速度逐个消费
		this.next(true)
	}

	// 暂停
	stop() {
		this.consuming = false
		clearTimeout(this.timer)
	}

	// 恢复
	resume() {
		this.consuming = true
		this.next()
	}
}
