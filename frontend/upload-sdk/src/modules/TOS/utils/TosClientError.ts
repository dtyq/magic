class TosClientError extends Error {
	constructor(message: string) {
		super(message)

		// https://www.dannyguo.com/blog/how-to-fix-instanceof-not-working-for-custom-errors-in-typescript/
		Object.setPrototypeOf(this, TosClientError.prototype)
	}
}

export default TosClientError
