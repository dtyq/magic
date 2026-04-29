package parseddocument

import "maps"

// CloneParsedDocument 复制解析结果，避免当前链路继续加工 ParsedDocument 时，把 cache 或另一条链路的数据一起改脏。
//
// 这里的 clone 不是为了做一个通用 deep copy 工具，而是为了保护文档同步链路里的数据不串。
//
// ParsedDocument 在业务上不是纯只读结果。后面同步链路还会继续补 metadata、改文件名、重建文本，
// 所以它一旦要跨 cache、snapshot、source override 这类边界传递，就不能几条链路共用同一份。
// 否则当前请求改了块 metadata，缓存里的底稿或者另一条链路手里的数据也会一起被改脏。
//
// 这里也不是无脑递归深拷贝。我们只拷当前业务里实际会出现的 JSON-like metadata 结构，
// 保证 document 同步和切片链路用到的 map / slice 不共用底层数据。
// 对暂时不支持的复杂值，继续原样透传；这是当前契约，不是假装支持所有 Go 类型的 deep copy。
func CloneParsedDocument(parsed *ParsedDocument) *ParsedDocument {
	if parsed == nil {
		return nil
	}

	cloned := &ParsedDocument{
		SourceType: parsed.SourceType,
		PlainText:  parsed.PlainText,
	}
	if len(parsed.Blocks) > 0 {
		cloned.Blocks = make([]ParsedBlock, len(parsed.Blocks))
		for i, block := range parsed.Blocks {
			cloned.Blocks[i] = ParsedBlock{
				Type:     block.Type,
				Content:  block.Content,
				Metadata: cloneParsedMetadata(block.Metadata),
			}
		}
	}
	cloned.DocumentMeta = cloneParsedMetadata(parsed.DocumentMeta)
	return cloned
}

func cloneParsedMetadata(src map[string]any) map[string]any {
	if len(src) == 0 {
		return nil
	}

	dst := make(map[string]any, len(src))
	for key, value := range src {
		dst[key] = cloneParsedValue(value)
	}
	return dst
}

func cloneParsedValue(value any) any {
	switch typed := value.(type) {
	case nil:
		return nil
	case map[string]any:
		return cloneParsedMetadata(typed)
	case map[string]string:
		return cloneParsedStringMap(typed)
	case []any:
		return cloneParsedSlice(typed)
	case []bool:
		return cloneFlatSlice(typed)
	case []int:
		return cloneFlatSlice(typed)
	case []int32:
		return cloneFlatSlice(typed)
	case []int64:
		return cloneFlatSlice(typed)
	case []string:
		return cloneFlatSlice(typed)
	case []float64:
		return cloneFlatSlice(typed)
	case []map[string]any:
		return cloneParsedMapSlice(typed)
	default:
		return typed
	}
}

func cloneParsedStringMap(src map[string]string) map[string]string {
	if len(src) == 0 {
		return nil
	}

	dst := make(map[string]string, len(src))
	maps.Copy(dst, src)
	return dst
}

func cloneParsedSlice(src []any) []any {
	if len(src) == 0 {
		return nil
	}

	dst := make([]any, len(src))
	for i := range src {
		dst[i] = cloneParsedValue(src[i])
	}
	return dst
}

func cloneParsedMapSlice(src []map[string]any) []map[string]any {
	if len(src) == 0 {
		return nil
	}

	dst := make([]map[string]any, len(src))
	for i := range src {
		dst[i] = cloneParsedMetadata(src[i])
	}
	return dst
}

func cloneFlatSlice[T any](src []T) []T {
	if len(src) == 0 {
		return nil
	}
	return append([]T(nil), src...)
}
