import { FormItemType } from "@/MagicExpressionWidget/types";
import i18next, { TFunction } from "i18next";

export const JSONPATH_JOIN_CHAR = '.';

export const STRING_FORMATS = [
  { name: 'date-time' },
  { name: 'date' },
  { name: 'email' },
  { name: 'hostname' },
  { name: 'ipv4' },
  { name: 'ipv6' },
  { name: 'uri' },
];

export const MOCK_SOURCE = [
  { name: i18next.t("jsonSchema.mockString", { ns: "magicFlow", defaultValue: '字符串' }), mock: '@string' },
  { name: i18next.t("jsonSchema.mockNatural", { ns: "magicFlow", defaultValue: '自然数' }), mock: '@natural' },
  { name: i18next.t("jsonSchema.mockFloat", { ns: "magicFlow", defaultValue: '浮点数' }), mock: '@float' },
  { name: i18next.t("jsonSchema.mockCharacter", { ns: "magicFlow", defaultValue: '字符' }), mock: '@character' },
  { name: i18next.t("jsonSchema.mockBoolean", { ns: "magicFlow", defaultValue: '布尔' }), mock: '@boolean' },
  { name: i18next.t("jsonSchema.mockUrl", { ns: "magicFlow", defaultValue: 'url' }), mock: '@url' },
  { name: i18next.t("jsonSchema.mockDomain", { ns: "magicFlow", defaultValue: '域名' }), mock: '@domain' },
  { name: i18next.t("jsonSchema.mockIp", { ns: "magicFlow", defaultValue: 'ip地址' }), mock: '@ip' },
  { name: i18next.t("jsonSchema.mockId", { ns: "magicFlow", defaultValue: 'id' }), mock: '@id' },
  { name: i18next.t("jsonSchema.mockGuid", { ns: "magicFlow", defaultValue: 'guid' }), mock: '@guid' },
  { name: i18next.t("jsonSchema.mockNow", { ns: "magicFlow", defaultValue: '当前时间' }), mock: '@now' },
  { name: i18next.t("jsonSchema.mockTimestamp", { ns: "magicFlow", defaultValue: '时间戳' }), mock: '@timestamp' },
  { name: i18next.t("jsonSchema.mockDate", { ns: "magicFlow", defaultValue: '日期' }), mock: '@date' },
  { name: i18next.t("jsonSchema.mockTime", { ns: "magicFlow", defaultValue: '时间' }), mock: '@time' },
  { name: i18next.t("jsonSchema.mockDatetime", { ns: "magicFlow", defaultValue: '日期时间' }), mock: '@datetime' },
  { name: i18next.t("jsonSchema.mockImage", { ns: "magicFlow", defaultValue: '图片连接' }), mock: '@image' },
  { name: i18next.t("jsonSchema.mockImageData", { ns: "magicFlow", defaultValue: '图片data' }), mock: '@imageData' },
  { name: i18next.t("jsonSchema.mockColor", { ns: "magicFlow", defaultValue: '颜色' }), mock: '@color' },
  { name: i18next.t("jsonSchema.mockHex", { ns: "magicFlow", defaultValue: '颜色hex' }), mock: '@hex' },
  { name: i18next.t("jsonSchema.mockRgba", { ns: "magicFlow", defaultValue: '颜色rgba' }), mock: '@rgba' },
  { name: i18next.t("jsonSchema.mockRgb", { ns: "magicFlow", defaultValue: '颜色rgb' }), mock: '@rgb' },
  { name: i18next.t("jsonSchema.mockHsl", { ns: "magicFlow", defaultValue: '颜色hsl' }), mock: '@hsl' },
  { name: i18next.t("jsonSchema.mockInteger", { ns: "magicFlow", defaultValue: '整数' }), mock: '@integer' },
  { name: i18next.t("jsonSchema.mockEmail", { ns: "magicFlow", defaultValue: 'email' }), mock: '@email' },
  { name: i18next.t("jsonSchema.mockParagraph", { ns: "magicFlow", defaultValue: '大段文本' }), mock: '@paragraph' },
  { name: i18next.t("jsonSchema.mockSentence", { ns: "magicFlow", defaultValue: '句子' }), mock: '@sentence' },
  { name: i18next.t("jsonSchema.mockWord", { ns: "magicFlow", defaultValue: '单词' }), mock: '@word' },
  { name: i18next.t("jsonSchema.mockCparagraph", { ns: "magicFlow", defaultValue: '大段中文文本' }), mock: '@cparagraph' },
  { name: i18next.t("jsonSchema.mockCtitle", { ns: "magicFlow", defaultValue: '中文标题' }), mock: '@ctitle' },
  { name: i18next.t("jsonSchema.mockTitle", { ns: "magicFlow", defaultValue: '标题' }), mock: '@title' },
  { name: i18next.t("jsonSchema.mockName", { ns: "magicFlow", defaultValue: '姓名' }), mock: '@name' },
  { name: i18next.t("jsonSchema.mockCname", { ns: "magicFlow", defaultValue: '中文姓名' }), mock: '@cname' },
  { name: i18next.t("jsonSchema.mockCfirst", { ns: "magicFlow", defaultValue: '中文姓' }), mock: '@cfirst' },
  { name: i18next.t("jsonSchema.mockClast", { ns: "magicFlow", defaultValue: '中文名' }), mock: '@clast' },
  { name: i18next.t("jsonSchema.mockFirst", { ns: "magicFlow", defaultValue: '英文姓' }), mock: '@first' },
  { name: i18next.t("jsonSchema.mockLast", { ns: "magicFlow", defaultValue: '英文名' }), mock: '@last' },
  { name: i18next.t("jsonSchema.mockCsentence", { ns: "magicFlow", defaultValue: '中文句子' }), mock: '@csentence' },
  { name: i18next.t("jsonSchema.mockCword", { ns: "magicFlow", defaultValue: '中文词组' }), mock: '@cword' },
  { name: i18next.t("jsonSchema.mockRegion", { ns: "magicFlow", defaultValue: '地址' }), mock: '@region' },
  { name: i18next.t("jsonSchema.mockProvince", { ns: "magicFlow", defaultValue: '省份' }), mock: '@province' },
  { name: i18next.t("jsonSchema.mockCity", { ns: "magicFlow", defaultValue: '城市' }), mock: '@city' },
  { name: i18next.t("jsonSchema.mockCounty", { ns: "magicFlow", defaultValue: '地区' }), mock: '@county' },
  { name: i18next.t("jsonSchema.mockUpper", { ns: "magicFlow", defaultValue: '转换为大写' }), mock: '@upper' },
  { name: i18next.t("jsonSchema.mockLower", { ns: "magicFlow", defaultValue: '转换为小写' }), mock: '@lower' },
  { name: i18next.t("jsonSchema.mockPick", { ns: "magicFlow", defaultValue: '挑选（枚举）' }), mock: '@pick' },
  { name: i18next.t("jsonSchema.mockShuffle", { ns: "magicFlow", defaultValue: '打乱数组' }), mock: '@shuffle' },
  { name: i18next.t("jsonSchema.mockProtocol", { ns: "magicFlow", defaultValue: '协议' }), mock: '@protocol' },
];

export const SCHEMA_TYPE = [
    FormItemType.String,
    FormItemType.Number,
    FormItemType.Boolean,
    FormItemType.Integer,
    FormItemType.Object,
    FormItemType.Array,
];

export const ONLY_JSON_ROOT = [
    FormItemType.Object, 
    FormItemType.Array
];

// 键盘按键keyCode对照
export const KEY_CODE_MAP = {
  ENTER: 13,
  TAB: 9,
  C: 67,
  V: 86,
  D: 68,
  F: 70,
  X: 88,
  A: 65,
  S: 83,
  UP: 38,
  Z: 90,
  Y: 89,
  RIGHT: 39,
  DOWN: 40,
  LEFT: 37,
  COMMAND: 91,
  DELETE: 46,
  BACKSPACE: 8,
  ESC: 27,
};

/**
 * 新字段的添加位置
 */
export enum AppendPosition {
  /** 当前字段的下一个字段 */
  Next = 'next',
  /** 末尾字段 */
  Tail = 'tail',
}


/** 对象与子字段的间隔 */
export const childFieldGap = 24

/** 数组与items的类型分割器 */
export const SchemaValueSplitor = "$$"


export interface SchemaOption {
    label: string
    value: string
}

// schema到可渲染的类型映射
export const getSchemaToOptionsMap: () => Record<FormItemType, SchemaOption[]> = () => ({

    
    [FormItemType.String]: [{
        label: i18next.t("jsonSchema.typeString", { ns: "magicFlow", defaultValue: "字符串" }),
        value: FormItemType.String
    }],

    [FormItemType.Boolean]: [{
        label: i18next.t("jsonSchema.typeBoolean", { ns: "magicFlow", defaultValue: "布尔值" }),
        value: FormItemType.Boolean
    }],

    
    [FormItemType.Number]: [{
        label: i18next.t("jsonSchema.typeNumber", { ns: "magicFlow", defaultValue: "数值" }),
        value: FormItemType.Number
    }],

    
    [FormItemType.Integer]: [{
        label: i18next.t("jsonSchema.typeInteger", { ns: "magicFlow", defaultValue: "整数" }),
        value: FormItemType.Integer
    }],

    
    [FormItemType.Object]: [{
        label: i18next.t("jsonSchema.typeObject", { ns: "magicFlow", defaultValue: "对象" }),
        value: FormItemType.Object
    }],

    
    [FormItemType.Array]: [{
        label: i18next.t("jsonSchema.typeStringArray", { ns: "magicFlow", defaultValue: "字符串数组" }),
        value: `${FormItemType.Array}${SchemaValueSplitor}${FormItemType.String}`
    },{
        label: i18next.t("jsonSchema.typeNumberArray", { ns: "magicFlow", defaultValue: "整数数组" }),
        value: `${FormItemType.Array}${SchemaValueSplitor}${FormItemType.Number}`
    },{
        label: i18next.t("jsonSchema.typeBooleanArray", { ns: "magicFlow", defaultValue: "布尔数组" }),
        value: `${FormItemType.Array}${SchemaValueSplitor}${FormItemType.Boolean}`
    },{
        label: i18next.t("jsonSchema.typeIntegerArray", { ns: "magicFlow", defaultValue: "数值数组" }),
        value: `${FormItemType.Array}${SchemaValueSplitor}${FormItemType.Integer}`
    },{
        label: i18next.t("jsonSchema.typeObjectArray", { ns: "magicFlow", defaultValue: "对象数组" }),
        value: `${FormItemType.Array}${SchemaValueSplitor}${FormItemType.Object}`
    },{
        label: i18next.t("jsonSchema.typeArray", { ns: "magicFlow", defaultValue: "数组" }),
        value: FormItemType.Array
    }],
})


/**
 * {
 *  [string]: '字符串',
 *  [array_string]: '字符串数组,
 *  ....
 * }
 */
export const getFormTypeToTitle = () => Object.values(getSchemaToOptionsMap()).reduce((acc, curTypeList) => {
    curTypeList.forEach(curType => {
        acc[curType.value] = curType.label
    })
    return acc
}, {} as Record<string, string>)



export enum ShowColumns {
    /** 变量名 */
    Key = 1,
    /** 显示名称 */
    Label = 2,
    /** 变量类型 */
    Type = 3,
    /** 变量值 */
    Value = 4,
	/** 变量描述 */
	Description = 5,
	/** 加密 */
	Encryption = 6,
    /** 是否必填 */
    Required = 7
}

// 除了是否加密，其他都默认展示
export const DefaultDisplayColumns = Object.values(ShowColumns).filter(value => value !== ShowColumns.Encryption && value !== ShowColumns.Required) as ShowColumns[]

export const DefaultColumnNames = () => ({
	[ShowColumns.Key]: i18next.t("jsonSchema.columnKeyName", { ns: "magicFlow", defaultValue: "参数名" }),
	[ShowColumns.Label]: i18next.t("jsonSchema.columnLabelName", { ns: "magicFlow", defaultValue: "显示名称" }),
	[ShowColumns.Type]: i18next.t("jsonSchema.columnTypeName", { ns: "magicFlow", defaultValue: "参数类型" }),
	[ShowColumns.Value]: i18next.t("jsonSchema.columnValueName", { ns: "magicFlow", defaultValue: "参数值" }),
	[ShowColumns.Description]: i18next.t("jsonSchema.columnDescName", { ns: "magicFlow", defaultValue: "参数描述" }),
	[ShowColumns.Encryption]: i18next.t("jsonSchema.columnEncryptionName", { ns: "magicFlow", defaultValue: "是否加密" }),
	[ShowColumns.Required]: i18next.t("jsonSchema.columnRequiredName", { ns: "magicFlow", defaultValue: "是否必填" })
})

