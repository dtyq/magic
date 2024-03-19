/**
 * 编辑器错误码枚举
 */
export enum EditorErrorCode {
	/** 未知错误 */
	UNKNOWN_ERROR = "UNKNOWN_ERROR",
	/** 请求超时 */
	TIMEOUT = "TIMEOUT",
	/** 无效的选择器 */
	INVALID_SELECTOR = "INVALID_SELECTOR",
	/** 元素未找到 */
	ELEMENT_NOT_FOUND = "ELEMENT_NOT_FOUND",
	/** 无效的样式值 */
	INVALID_STYLE_VALUE = "INVALID_STYLE_VALUE",
	/** 命令执行失败 */
	COMMAND_FAILED = "COMMAND_FAILED",
	/** 内容验证失败 */
	VALIDATION_FAILED = "VALIDATION_FAILED",
	/** 保存失败 */
	SAVE_FAILED = "SAVE_FAILED",
	/** 协议版本不匹配 */
	PROTOCOL_VERSION_MISMATCH = "PROTOCOL_VERSION_MISMATCH",
	/** iframe 未准备就绪 */
	IFRAME_NOT_READY = "IFRAME_NOT_READY",
}

/**
 * 编辑器错误类
 */
export class EditorError extends Error {
	public code: EditorErrorCode
	public details?: any

	constructor(code: EditorErrorCode, message: string, details?: any) {
		super(message)
		this.name = "EditorError"
		this.code = code
		this.details = details

		// 维护原型链
		Object.setPrototypeOf(this, EditorError.prototype)
	}

	/**
	 * 转换为普通对象（用于序列化）
	 */
	toJSON() {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			details: this.details,
		}
	}

	/**
	 * 从普通对象创建错误实例
	 */
	static fromJSON(obj: any): EditorError {
		return new EditorError(obj.code || EditorErrorCode.UNKNOWN_ERROR, obj.message, obj.details)
	}
}
