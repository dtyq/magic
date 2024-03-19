interface JsErrorConfig {
	/** 与error message匹配，忽略能匹配的JS错误。 */
	ignoreErrors: (string | RegExp)[]
	/** 是否开启全局onerror监听。如果业务本身是三方组件或者SDK，可以设置为false，表示不开启全局onerror监听，此时需要使用captureException手动上报JS错误。 */
	onerror: boolean
	/** 是否开启全局 onunhandledrejetion 监听。如果业务本身是三方组件或者SDK，可以设置为false，表示不开启全局 onunhandlerejection 监听，此时需要使用captureException手动上报JS错误。 */
	onunhandledrejection: boolean
	/** 是否hook全局异步API。异常API内的错误，比如setTimeout，因为自身限制抛到全局后往往没有完整堆栈，如果将此字段设置为true，那么可以获得更多信息，例如错误是从哪个API被抛出的。 */
	captureGlobalAsync?: boolean
	/** 当前发生的JS错误会和上一个错误比较，如果是同一个错误，是否不再上报。为了避免循环上报，默认开启了去重。如果业务场景希望相同的错误能够重复上报，需要将此字段设置为false。 */
	dedupe?: boolean
}

/**
 * @description 插件说明文档 https://www.volcengine.com/docs/6431/104889
 */
export const plugin = (): Partial<JsErrorConfig> => {
	return {
		ignoreErrors: [],
		onerror: true,
		onunhandledrejection: true,
		captureGlobalAsync: false,
		dedupe: true,
	}
}
