// 定义语言类型
type LanguageCode = "en" // 支持的语言代码

// 定义语言映射对象的结构
interface Language {
	months: string[] // 月份数组
	format: (month: string, day: number) => string // 格式化日期的函数
}

// 语言映射对象
const languages: Record<LanguageCode, Language> = {
	en: {
		// 英文
		months: [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		],
		format: (month, day) => `${month} ${day}`,
	},
	//   th: { // 泰语
	//     months: [
	//       "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
	//       "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
	//     ],
	//     format: (month, day) => `${day} ${month}`
	//   },
	//   vi: { // 越南语
	//     months: [
	//       "Tháng một", "Tháng hai", "Tháng ba", "Tháng tư", "Tháng năm", "Tháng sáu",
	//       "Tháng bảy", "Tháng tám", "Tháng chín", "Tháng mười", "Tháng mười một", "Tháng mười hai"
	//     ],
	//     format: (month, day) => `${month} ${day}`
	//   }
	// 可以根据需要继续添加更多语言...
}

// 定义转换日期的函数，接受中文日期和目标语言代码，返回对应语言格式的日期
export function getTranslatedDate(chineseDate: string, language: LanguageCode = "en"): string {
	// 从日期字符串中提取月份和日期
	const match = chineseDate.match(/(\d{1,2})月(\d{1,2})日/)

	if (match) {
		const month = parseInt(match[1], 10) // 获取月份
		const day = parseInt(match[2], 10) // 获取日期

		// 获取选择的语言对象，如果没有指定语言，默认选择英语
		const selectedLanguage = languages[language]

		// 使用语言对应的月份和格式
		return selectedLanguage.format(selectedLanguage.months[month - 1], day)
	}
	return "Invalid date format"
}
