package sourcebindingrepo

// DecodeObjectMapForTest 暴露来源绑定对象兼容解码逻辑供外部测试使用。
func DecodeObjectMapForTest(raw []byte) map[string]any {
	return decodeObjectMap(raw)
}
