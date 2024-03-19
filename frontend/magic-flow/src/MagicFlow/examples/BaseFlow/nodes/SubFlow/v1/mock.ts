export const mockServerMethodsSource = [
    {
        "label": "函数",
        "value": "methods_676fb47d34048",
        "desc": "",
        "children": [
            {
                "label": "日期/时间",
                "value": "35dc24eb922fca0aaf91d2c9884c0163",
                "desc": "",
                "children": [
                    {
                        "label": "获取ISO 8601格式的日期（仅日期部分）",
                        "value": "get_iso8601_date",
                        "desc": "获取ISO 8601格式的日期（仅日期部分）;如：2021-01-01",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "time",
                                "type": "int",
                                "desc": "要计算的时间戳。默认当前时间"
                            }
                        ]
                    },
                    {
                        "label": "获取ISO 8601格式的日期和时间",
                        "value": "get_iso8601_date_time",
                        "desc": "获取ISO 8601格式的日期和时间;如：2021-01-01T00:00:00",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "time",
                                "type": "int",
                                "desc": "要计算的时间戳。默认当前时间"
                            }
                        ]
                    },
                    {
                        "label": "获取带时区偏移的ISO 8601格式的日期和时间",
                        "value": "get_iso8601_date_time_with_offset",
                        "desc": "获取带时区偏移的ISO 8601格式的日期和时间;如：2021-01-01T00:00:00+08:00",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "time",
                                "type": "int",
                                "desc": "要计算的时间戳。默认当前时间"
                            }
                        ]
                    },
                    {
                        "label": "获取RFC 1123格式的日期和时间",
                        "value": "get_rfc1123_date_time",
                        "desc": "获取RFC 1123格式的日期和时间;如：Sat, 21 Oct 2021 07:28:00 GMT",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "time",
                                "type": "int",
                                "desc": "要计算的时间戳。默认当前时间"
                            }
                        ]
                    }
                ]
            },
            {
                "label": "内置函数",
                "value": "78162069390d96b9230a2f222f902b54",
                "desc": "",
                "children": [
                    {
                        "label": "计算字符串的 MD5 散列值",
                        "value": "md5",
                        "desc": "计算字符串的 MD5 散列值",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "type": "string",
                                "desc": "要计算的字符串。"
                            },
                            {
                                "name": "binary",
                                "type": "boolean",
                                "desc": "如果可选的 binary 被设置为 true，那么 md5 摘要将以 16 字符长度的原始二进制格式返回。"
                            }
                        ]
                    },
                    {
                        "label": "mt_rand",
                        "value": "mt_rand",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "min",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "max",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "round",
                        "value": "round",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "int|float"
                            },
                            {
                                "name": "precision",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "mode",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "确定字符串是否包含指定子串",
                        "value": "str_contains",
                        "desc": "执行大小写区分的检查，表明 needle 是否包含在 haystack 中。",
                        "return_type": "boolean",
                        "arg": [
                            {
                                "name": "haystack",
                                "type": "string",
                                "desc": "在其中搜索的字符串。"
                            },
                            {
                                "name": "needle",
                                "type": "string",
                                "desc": "要在 haystack 中搜索的子串。"
                            }
                        ]
                    },
                    {
                        "label": "time",
                        "value": "time",
                        "desc": "",
                        "return_type": "int",
                        "arg": []
                    },
                    {
                        "label": "生成一个唯一 ID",
                        "value": "uniqid",
                        "desc": "生成一个唯一 ID",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "prefix",
                                "desc": "有用的参数。例如：如果在多台主机上可能在同一微秒生成唯一ID。\\n prefix为空，则返回的字符串长度为 13。more_entropy 为 true，则返回的字符串长度为 23。",
                                "type": "string"
                            },
                            {
                                "name": "more_entropy",
                                "desc": "如果设置为 true，uniqid() 会在返回的字符串结尾增加额外的熵（使用线性同余组合发生器）。 使得唯一ID更具唯一性。",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "str_replace",
                        "value": "str_replace",
                        "desc": "",
                        "return_type": "array|string",
                        "arg": [
                            {
                                "name": "search",
                                "desc": "",
                                "type": "array|string"
                            },
                            {
                                "name": "replace",
                                "desc": "",
                                "type": "array|string"
                            },
                            {
                                "name": "subject",
                                "desc": "",
                                "type": "array|string"
                            },
                            {
                                "name": "count",
                                "desc": ""
                            }
                        ]
                    },
                    {
                        "label": "mb_strlen",
                        "value": "mb_strlen",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "encoding",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "mb_str_pad",
                        "value": "mb_str_pad",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "pad_string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "pad_type",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "encoding",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "array_rand",
                        "value": "array_rand",
                        "desc": "",
                        "return_type": "array|string|int",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "num",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "is_array",
                        "value": "is_array",
                        "desc": "",
                        "return_type": "bool",
                        "arg": [
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "explode",
                        "value": "explode",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "separator",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "limit",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "json_encode",
                        "value": "json_encode",
                        "desc": "",
                        "return_type": "string|false",
                        "arg": [
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "depth",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "json_decode",
                        "value": "json_decode",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "json",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "associative",
                                "desc": "",
                                "type": "bool"
                            },
                            {
                                "name": "depth",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "mb_substr",
                        "value": "mb_substr",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "start",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "encoding",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "preg_match",
                        "value": "preg_match",
                        "desc": "",
                        "return_type": "int|false",
                        "arg": [
                            {
                                "name": "pattern",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "subject",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "matches",
                                "desc": ""
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "offset",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "preg_replace",
                        "value": "preg_replace",
                        "desc": "",
                        "return_type": "array|string|null",
                        "arg": [
                            {
                                "name": "pattern",
                                "desc": "",
                                "type": "array|string"
                            },
                            {
                                "name": "replacement",
                                "desc": "",
                                "type": "array|string"
                            },
                            {
                                "name": "subject",
                                "desc": "",
                                "type": "array|string"
                            },
                            {
                                "name": "limit",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "count",
                                "desc": ""
                            }
                        ]
                    },
                    {
                        "label": "preg_match_all",
                        "value": "preg_match_all",
                        "desc": "",
                        "return_type": "int|false",
                        "arg": [
                            {
                                "name": "pattern",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "subject",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "matches",
                                "desc": ""
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "offset",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "preg_split",
                        "value": "preg_split",
                        "desc": "",
                        "return_type": "array|false",
                        "arg": [
                            {
                                "name": "pattern",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "subject",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "limit",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "str_repeat",
                        "value": "str_repeat",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "times",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "str_split",
                        "value": "str_split",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "array_column",
                        "value": "array_column",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "column_key",
                                "desc": "",
                                "type": "string|int|null"
                            },
                            {
                                "name": "index_key",
                                "desc": "",
                                "type": "string|int|null"
                            }
                        ]
                    },
                    {
                        "label": "array_keys",
                        "value": "array_keys",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "filter_value",
                                "desc": "",
                                "type": "mixed"
                            },
                            {
                                "name": "strict",
                                "desc": "",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "array_values",
                        "value": "array_values",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_merge",
                        "value": "array_merge",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "arrays",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_diff",
                        "value": "array_diff",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "arrays",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_intersect",
                        "value": "array_intersect",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "arrays",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_unique",
                        "value": "array_unique",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "implode",
                        "value": "implode",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "separator",
                                "desc": "",
                                "type": "array|string"
                            },
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "count",
                        "value": "count",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "value",
                                "desc": "",
                                "type": "Countable|array"
                            },
                            {
                                "name": "mode",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "in_array",
                        "value": "in_array",
                        "desc": "",
                        "return_type": "bool",
                        "arg": [
                            {
                                "name": "needle",
                                "desc": "",
                                "type": "mixed"
                            },
                            {
                                "name": "haystack",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "strict",
                                "desc": "",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "array_search",
                        "value": "array_search",
                        "desc": "",
                        "return_type": "string|int|false",
                        "arg": [
                            {
                                "name": "needle",
                                "desc": "",
                                "type": "mixed"
                            },
                            {
                                "name": "haystack",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "strict",
                                "desc": "",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "array_flip",
                        "value": "array_flip",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_reverse",
                        "value": "array_reverse",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "preserve_keys",
                                "desc": "",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "array_slice",
                        "value": "array_slice",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "offset",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "preserve_keys",
                                "desc": "",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "array_splice",
                        "value": "array_splice",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "offset",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "replacement",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "date",
                        "value": "date",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "format",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "timestamp",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "strtotime",
                        "value": "strtotime",
                        "desc": "",
                        "return_type": "int|false",
                        "arg": [
                            {
                                "name": "datetime",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "baseTimestamp",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "microtime",
                        "value": "microtime",
                        "desc": "",
                        "return_type": "string|float",
                        "arg": [
                            {
                                "name": "as_float",
                                "desc": "",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "strpos",
                        "value": "strpos",
                        "desc": "",
                        "return_type": "int|false",
                        "arg": [
                            {
                                "name": "haystack",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "needle",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "offset",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "strlen",
                        "value": "strlen",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "substr",
                        "value": "substr",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "offset",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "ltrim",
                        "value": "ltrim",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "characters",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "rtrim",
                        "value": "rtrim",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "characters",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "trim",
                        "value": "trim",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "characters",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "strtolower",
                        "value": "strtolower",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "strtoupper",
                        "value": "strtoupper",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "str_starts_with",
                        "value": "str_starts_with",
                        "desc": "",
                        "return_type": "bool",
                        "arg": [
                            {
                                "name": "haystack",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "needle",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "str_ends_with",
                        "value": "str_ends_with",
                        "desc": "",
                        "return_type": "bool",
                        "arg": [
                            {
                                "name": "haystack",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "needle",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "str_pad",
                        "value": "str_pad",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "pad_string",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "pad_type",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "is_numeric",
                        "value": "is_numeric",
                        "desc": "",
                        "return_type": "bool",
                        "arg": [
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "is_string",
                        "value": "is_string",
                        "desc": "",
                        "return_type": "bool",
                        "arg": [
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "sprintf",
                        "value": "sprintf",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "format",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "values",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "array_count_values",
                        "value": "array_count_values",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_fill",
                        "value": "array_fill",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "start_index",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "count",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "array_fill_keys",
                        "value": "array_fill_keys",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "keys",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "array_filter",
                        "value": "array_filter",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "callback",
                                "desc": "",
                                "type": "callable"
                            },
                            {
                                "name": "mode",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "array_map",
                        "value": "array_map",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "callback",
                                "desc": "",
                                "type": "callable"
                            },
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "arrays",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_reduce",
                        "value": "array_reduce",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "callback",
                                "desc": "",
                                "type": "callable"
                            },
                            {
                                "name": "initial",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "array_replace",
                        "value": "array_replace",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "replacements",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_replace_recursive",
                        "value": "array_replace_recursive",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "replacements",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_shift",
                        "value": "array_shift",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_unshift",
                        "value": "array_unshift",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "values",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "array_walk_recursive",
                        "value": "array_walk_recursive",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "object|array"
                            },
                            {
                                "name": "callback",
                                "desc": "",
                                "type": "callable"
                            },
                            {
                                "name": "arg",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "shuffle",
                        "value": "shuffle",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "sort",
                        "value": "sort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "rsort",
                        "value": "rsort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "asort",
                        "value": "asort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "arsort",
                        "value": "arsort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "ksort",
                        "value": "ksort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "krsort",
                        "value": "krsort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "uasort",
                        "value": "uasort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "callback",
                                "desc": "",
                                "type": "callable"
                            }
                        ]
                    },
                    {
                        "label": "uksort",
                        "value": "uksort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "callback",
                                "desc": "",
                                "type": "callable"
                            }
                        ]
                    },
                    {
                        "label": "usort",
                        "value": "usort",
                        "desc": "",
                        "return_type": "true",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "callback",
                                "desc": "",
                                "type": "callable"
                            }
                        ]
                    },
                    {
                        "label": "reset",
                        "value": "reset",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "object|array"
                            }
                        ]
                    },
                    {
                        "label": "end",
                        "value": "end",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "object|array"
                            }
                        ]
                    },
                    {
                        "label": "next",
                        "value": "next",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "object|array"
                            }
                        ]
                    },
                    {
                        "label": "prev",
                        "value": "prev",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "object|array"
                            }
                        ]
                    },
                    {
                        "label": "current",
                        "value": "current",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "object|array"
                            }
                        ]
                    },
                    {
                        "label": "key",
                        "value": "key",
                        "desc": "",
                        "return_type": "string|int|null",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "object|array"
                            }
                        ]
                    },
                    {
                        "label": "extract",
                        "value": "extract",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "flags",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "prefix",
                                "desc": "",
                                "type": "string"
                            }
                        ]
                    },
                    {
                        "label": "compact",
                        "value": "compact",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "var_name",
                                "desc": ""
                            },
                            {
                                "name": "var_names",
                                "desc": ""
                            }
                        ]
                    },
                    {
                        "label": "array_change_key_case",
                        "value": "array_change_key_case",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "case",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "array_chunk",
                        "value": "array_chunk",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "preserve_keys",
                                "desc": "",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "array_combine",
                        "value": "array_combine",
                        "desc": "",
                        "return_type": "array",
                        "arg": [
                            {
                                "name": "keys",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "values",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_pop",
                        "value": "array_pop",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "array_push",
                        "value": "array_push",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "array",
                                "desc": "",
                                "type": "array"
                            },
                            {
                                "name": "values",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "abs",
                        "value": "abs",
                        "desc": "",
                        "return_type": "int|float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "int|float"
                            }
                        ]
                    },
                    {
                        "label": "ceil",
                        "value": "ceil",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "int|float"
                            }
                        ]
                    },
                    {
                        "label": "floor",
                        "value": "floor",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "int|float"
                            }
                        ]
                    },
                    {
                        "label": "sqrt",
                        "value": "sqrt",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "pow",
                        "value": "pow",
                        "desc": "",
                        "return_type": "object|int|float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "mixed"
                            },
                            {
                                "name": "exponent",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "exp",
                        "value": "exp",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "log",
                        "value": "log",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            },
                            {
                                "name": "base",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "log10",
                        "value": "log10",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "sin",
                        "value": "sin",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "cos",
                        "value": "cos",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "tan",
                        "value": "tan",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "asin",
                        "value": "asin",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "acos",
                        "value": "acos",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "atan",
                        "value": "atan",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "atan2",
                        "value": "atan2",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "y",
                                "desc": "",
                                "type": "float"
                            },
                            {
                                "name": "x",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "pi",
                        "value": "pi",
                        "desc": "",
                        "return_type": "float",
                        "arg": []
                    },
                    {
                        "label": "fmod",
                        "value": "fmod",
                        "desc": "",
                        "return_type": "float",
                        "arg": [
                            {
                                "name": "num1",
                                "desc": "",
                                "type": "float"
                            },
                            {
                                "name": "num2",
                                "desc": "",
                                "type": "float"
                            }
                        ]
                    },
                    {
                        "label": "rand",
                        "value": "rand",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "min",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "max",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "mt_srand",
                        "value": "mt_srand",
                        "desc": "",
                        "return_type": "void",
                        "arg": [
                            {
                                "name": "seed",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "mode",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "random_int",
                        "value": "random_int",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "min",
                                "desc": "",
                                "type": "int"
                            },
                            {
                                "name": "max",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "random_bytes",
                        "value": "random_bytes",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "length",
                                "desc": "",
                                "type": "int"
                            }
                        ]
                    },
                    {
                        "label": "json_last_error",
                        "value": "json_last_error",
                        "desc": "",
                        "return_type": "int",
                        "arg": []
                    },
                    {
                        "label": "json_last_error_msg",
                        "value": "json_last_error_msg",
                        "desc": "",
                        "return_type": "string",
                        "arg": []
                    },
                    {
                        "label": "serialize",
                        "value": "serialize",
                        "desc": "",
                        "return_type": "string",
                        "arg": [
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "unserialize",
                        "value": "unserialize",
                        "desc": "",
                        "return_type": "mixed",
                        "arg": [
                            {
                                "name": "data",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "options",
                                "desc": "",
                                "type": "array"
                            }
                        ]
                    },
                    {
                        "label": "var_dump",
                        "value": "var_dump",
                        "desc": "",
                        "return_type": "void",
                        "arg": [
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            },
                            {
                                "name": "values",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    },
                    {
                        "label": "print_r",
                        "value": "print_r",
                        "desc": "",
                        "return_type": "string|bool",
                        "arg": [
                            {
                                "name": "value",
                                "desc": "",
                                "type": "mixed"
                            },
                            {
                                "name": "return",
                                "desc": "",
                                "type": "bool"
                            }
                        ]
                    },
                    {
                        "label": "printf",
                        "value": "printf",
                        "desc": "",
                        "return_type": "int",
                        "arg": [
                            {
                                "name": "format",
                                "desc": "",
                                "type": "string"
                            },
                            {
                                "name": "values",
                                "desc": "",
                                "type": "mixed"
                            }
                        ]
                    }
                ]
            }
        ]
    }
]