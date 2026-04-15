package infra

import autoloadcfg "magic/internal/config/autoload"

// ResolveQdrantEndpointForTest 暴露 Qdrant 连接解析逻辑供测试使用。
func ResolveQdrantEndpointForTest(cfg autoloadcfg.QdrantConfig) (string, int, string) {
	return resolveQdrantEndpoint(cfg)
}
