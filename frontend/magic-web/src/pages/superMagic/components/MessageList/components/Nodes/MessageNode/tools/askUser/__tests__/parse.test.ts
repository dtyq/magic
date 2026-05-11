import { describe, expect, it } from "vitest"
import { extractQuestionsField, parseQuestionsXml } from "../parse"

const FULL_MOCK =
	'<question type="input" placeholder="请输入你的姓名">1. 填空题：《红楼梦》、《西游记》、《水浒传》和《_______》。\n' +
	'<question type="select">2. 选择题：太阳系中最大的行星是？\n' +
	"<option>地球</option>\n<option>火星</option></option></option>\n</question>\n\n" +
	'<question type="input" placeholder="请输入答案">3. 简答题：请简述光合作用的过程及其意义。</question>\n\n' +
	'<question type="multi_select" min="1" max="4">4. 多选题：以下哪些是中国的传统节日？（请选择2-4项</option>\n' +
	"<option>圣诞节</option>\n<option>中秋节</option>\n<option>端午节</option>\n<option>感恩节</option>\n</question>\n\n" +
	'<question type="input" placeholder="请输入数字">5. 计算题：如果一个圆的半，请计算它的面积.14）约为_____平方厘米。</question>\n\n' +
	'<question type="select">6. 判断题：水的沸点在标准大气压下是100摄氏度。\n' +
	"<option>正确\n<option>错误</option>\n</question>"

describe("parseQuestionsXml", () => {
	it("returns empty array for empty input", () => {
		expect(parseQuestionsXml("")).toEqual([])
	})

	it("returns empty array for garbage input without <question>", () => {
		expect(parseQuestionsXml("<div>hello</div>")).toEqual([])
	})

	it("parses full malformed mock payload tolerantly", () => {
		const result = parseQuestionsXml(FULL_MOCK)
		expect(result).toHaveLength(6)

		expect(result[0]).toMatchObject({
			type: "input",
			placeholder: "请输入你的姓名",
			isComplete: true,
			options: [],
		})
		expect(result[0].label).toContain("填空题")

		expect(result[1]).toMatchObject({
			type: "select",
			isComplete: true,
		})
		expect(result[1].options).toEqual(["地球", "火星"])

		expect(result[3]).toMatchObject({
			type: "multi_select",
			min: 1,
			max: 4,
			isComplete: true,
		})
		expect(result[3].options).toEqual(["圣诞节", "中秋节", "端午节", "感恩节"])

		expect(result[5].options).toEqual(["正确", "错误"])
	})

	it("marks trailing unclosed question as incomplete", () => {
		const partial = '<question type="select">2. 太阳系<option>地'
		const [q] = parseQuestionsXml(partial)
		expect(q).toBeDefined()
		expect(q.type).toBe("select")
		expect(q.isComplete).toBe(false)
		expect(q.options).toEqual(["地"])
		expect(q.label).toContain("太阳系")
	})

	it("treats missing type as input and trims stray option tags in label", () => {
		const raw = "<question>裸题干</option></question>"
		const [q] = parseQuestionsXml(raw)
		expect(q.type).toBe("input")
		expect(q.label).toBe("裸题干")
		expect(q.isComplete).toBe(true)
	})

	it("parses confirm type without coercing it to input", () => {
		const raw = '<question type="confirm">请确认是否继续</question>'
		const [q] = parseQuestionsXml(raw)
		expect(q.type).toBe("confirm")
		expect(q.label).toBe("请确认是否继续")
		expect(q.options).toEqual([])
		expect(q.isComplete).toBe(true)
	})

	it("reuses references for unchanged questions when prev is provided", () => {
		const first = parseQuestionsXml(FULL_MOCK)
		const second = parseQuestionsXml(FULL_MOCK, first)
		expect(second).toHaveLength(first.length)
		for (let i = 0; i < first.length; i++) {
			expect(second[i]).toBe(first[i])
		}
	})

	it("only changes the streaming tail when new chunk appends", () => {
		const prefix =
			'<question type="input" placeholder="a">Q1</question><question type="select">Q2<option>A</option>'
		const appended = `${prefix}<option>B</option></question>`
		const prev = parseQuestionsXml(prefix)
		const next = parseQuestionsXml(appended, prev)

		expect(next[0]).toBe(prev[0])
		expect(next[1]).not.toBe(prev[1])
		expect(next[1].options).toEqual(["A", "B"])
		expect(next[1].isComplete).toBe(true)
	})

	it("parses numeric min/max and falls back to undefined otherwise", () => {
		const raw =
			'<question type="multi_select" min="2" max="3">题</question><question type="multi_select">无边界</question>'
		const result = parseQuestionsXml(raw)
		expect(result[0].min).toBe(2)
		expect(result[0].max).toBe(3)
		expect(result[1].min).toBeUndefined()
		expect(result[1].max).toBeUndefined()
	})

	it("coerces non-numeric min/max attributes to undefined instead of NaN", () => {
		const raw = '<question type="multi_select" min="abc" max="">题</question>'
		const [q] = parseQuestionsXml(raw)
		expect(q.min).toBeUndefined()
		expect(q.max).toBeUndefined()
	})

	it("truncates oversized input to keep the main thread responsive", () => {
		const prefix = '<question type="input" placeholder="p">'
		const padding = "x".repeat(600 * 1024)
		const huge = `${prefix}${padding}</question>`
		const result = parseQuestionsXml(huge)
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("input")
		expect(result[0].label.length).toBeLessThanOrEqual(600 * 1024)
	})

	it("is idempotent when called repeatedly with identical malformed input", () => {
		const malformed =
			'<question type="select">q<option>A</option><question type="select">q2<option>B'
		const a = parseQuestionsXml(malformed)
		const b = parseQuestionsXml(malformed)
		const c = parseQuestionsXml(malformed, a)
		expect(a).toHaveLength(2)
		expect(b).toHaveLength(2)
		expect(a[0].options).toEqual(b[0].options)
		expect(a[1].options).toEqual(b[1].options)
		expect(c[0]).toBe(a[0])
		expect(c[1]).toBe(a[1])
	})

	it("filters empty options to avoid rendering blank rows", () => {
		const raw = '<question type="select">Q<option></option><option>A</option></question>'
		const [q] = parseQuestionsXml(raw)
		expect(q.options).toEqual(["A"])
	})

	it("parses default values from question attributes", () => {
		const raw =
			'<question type="input" default_value="Alice">Name</question>' +
			'<question type="multi_select" default_value="A,B">Pick<option>A</option><option>B</option></question>'
		const result = parseQuestionsXml(raw)
		expect(result[0].defaultValue).toBe("Alice")
		expect(result[1].defaultValue).toBe("A,B")
	})
})

describe("extractQuestionsField", () => {
	it("returns empty string for empty or missing key", () => {
		expect(extractQuestionsField("")).toBe("")
		expect(extractQuestionsField("{}")).toBe("")
		expect(extractQuestionsField('{"foo":"bar"}')).toBe("")
	})

	it("extracts value from complete JSON", () => {
		const raw = '{"questions": "<question type=\\"input\\">Q1</question>"}'
		expect(extractQuestionsField(raw)).toBe('<question type="input">Q1</question>')
	})

	it("extracts partial value from mid-chunk JSON without throwing", () => {
		const raw = '{"questions": "<question type=\\"input\\" placeholder=\\"foo'
		expect(extractQuestionsField(raw)).toBe('<question type="input" placeholder="foo')
	})

	it("handles all JSON escape forms", () => {
		const raw = String.raw`{"questions":"a\"b\\c\n d\t e\/f\u0041"}`
		expect(extractQuestionsField(raw)).toBe('a"b\\c\n d\t e/fA')
	})

	it("is safe when input ends with a trailing backslash", () => {
		const raw = '{"questions":"abc\\'
		expect(() => extractQuestionsField(raw)).not.toThrow()
		expect(extractQuestionsField(raw)).toBe("abc")
	})

	it("is safe when \\u escape is truncated", () => {
		const raw = '{"questions":"A\\u00'
		expect(() => extractQuestionsField(raw)).not.toThrow()
		expect(extractQuestionsField(raw)).toBe("A")
	})

	it("supports whitespace between key/colon/value", () => {
		const raw = '{\n  "questions"\n:\n  "hello"\n}'
		expect(extractQuestionsField(raw)).toBe("hello")
	})

	it("integrates with parseQuestionsXml on partial chunks", () => {
		const chunk1 = '{"questions":"<question type=\\"input\\" placeholder=\\"name\\">'
		const chunk2 = `${chunk1}1. 填空题:`
		const chunk3 = `${chunk2}</question><question type=\\"select\\">2. 选择<option>A`
		const final = `${chunk3}</option><option>B</option></question>"}`

		const s1 = extractQuestionsField(chunk1)
		const s2 = extractQuestionsField(chunk2)
		const s3 = extractQuestionsField(chunk3)
		const s4 = extractQuestionsField(final)

		expect(parseQuestionsXml(s1)).toHaveLength(1)
		expect(parseQuestionsXml(s1)[0].type).toBe("input")
		expect(parseQuestionsXml(s2)[0].label).toContain("填空题")
		expect(parseQuestionsXml(s3)).toHaveLength(2)
		expect(parseQuestionsXml(s3)[1].options).toEqual(["A"])
		expect(parseQuestionsXml(s4)[1].options).toEqual(["A", "B"])
		expect(parseQuestionsXml(s4)[1].isComplete).toBe(true)
	})
})
