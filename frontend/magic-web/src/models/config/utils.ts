/** 语言辅助器 */
export const languageHelper = {
	/**
	 * @description 国际化语言标识转换：其他规范 => magic 规范 (zzZZ/zz-ZZ 统一转 zz_ZZ，其中不限大小写字母长度)
	 * @param {string} lang
	 * @return zh_CN
	 */
	transform: (lang: string): string => {
		return lang.replace(/([a-z]{2})([-]?)([A-Z]{2})/g, "$1_$3")
	},
	/**
	 * @description 国际化语言标识转换：magic规范 => 其他规范 (zz_ZZ/zz-ZZ 统一转 zzZZ，其中不限大小写字母长度)
	 * @param {string} lang
	 * @return zhCN
	 */
	unTransform: (lang: string): string => {
		return lang.replace(/([a-z]{2})([_/-]?)([A-Z]{2})/g, "$1$3")
	},
}
