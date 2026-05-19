package config

// ExpandEnvPlaceholders 暴露 expandEnvPlaceholders 供测试使用。
func ExpandEnvPlaceholders(input string) string {
	return expandEnvPlaceholders(input)
}
