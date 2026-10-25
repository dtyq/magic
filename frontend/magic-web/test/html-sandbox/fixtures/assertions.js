// Shared assertions run INSIDE the real sandbox, never in Node/jsdom.
window.Fixture = (() => {
	const results = []
	function post(type, payload) {
		parent.postMessage({ type, ...payload }, "*")
	}
	return {
		equal(actual, expected) {
			if (JSON.stringify(actual) !== JSON.stringify(expected))
				throw Error(
					"Expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual),
				)
		},
		async test(name, run) {
			let timer
			try {
				await Promise.race([
					run(),
					new Promise((_, reject) => {
						timer = setTimeout(() => reject(Error("Case timed out (8s)")), 8000)
					}),
				])
				results.push({ name, passed: true })
			} catch (error) {
				results.push({ name, passed: false, error: String(error) })
			} finally {
				clearTimeout(timer)
			}
			post("FIXTURE_RESULT", results[results.length - 1])
		},
		waitFor(predicate) {
			return new Promise((resolve, reject) => {
				const start = Date.now()
				const poll = () => {
					try {
						if (predicate()) return resolve()
						if (Date.now() - start > 5000) return reject(Error("Condition timed out"))
						setTimeout(poll, 20)
					} catch (error) {
						reject(error)
					}
				}
				poll()
			})
		},
		done() {
			post("FIXTURE_DONE", { results })
		},
	}
})()
