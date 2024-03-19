// Throttle configuration
const THROTTLE_WINDOW = 60 * 1000 // Time window of 1 minute
const THROTTLE_LIMIT = 1000 // Handle at most 1000 requests per minute
let requestCount = 0
let windowStartTime = Date.now()

// Throttle middleware
const throttleMiddleware = (req, res, next) => {
	const currentTime = Date.now()
	// If time window has passed, reset request count and window start time
	if (currentTime - windowStartTime > THROTTLE_WINDOW) {
		requestCount = 0
		windowStartTime = currentTime
	}
	// If request count exceeds limit, return 429 status code
	if (requestCount >= THROTTLE_LIMIT) {
		return res.status(200).json({
			code: 1000,
			message: "Too many requests, please try again later.",
		})
	}
	// 请求数量加 1
	requestCount++
	next()
}

module.exports = throttleMiddleware
