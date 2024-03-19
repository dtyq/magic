/* eslint-disable */
/**
 * @description: 生成唯一标识，类似 uuid（从 nanoid库搬下来）
 * @param {*} t 字符串长度
 * @return {*} 唯一id
 */
export const nanoid = (t = 21) =>
	crypto
		.getRandomValues(new Uint8Array(t))
		.reduce(
			(t, e) =>
				(t +=
					(e &= 63) < 36
						? e.toString(36)
						: e < 62
							? (e - 26).toString(36).toUpperCase()
							: e > 62
								? "-"
								: "_"),
			"",
		)
