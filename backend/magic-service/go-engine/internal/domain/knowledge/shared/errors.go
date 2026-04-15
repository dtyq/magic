package shared

import "errors"

var (
	// ErrEmbeddingModelRequired 表示必须提供 embedding 模型。
	ErrEmbeddingModelRequired = errors.New("embedding model is required")
	// ErrEmbeddingModelNotAllowed 表示 embedding 模型不被允许。
	ErrEmbeddingModelNotAllowed = errors.New("embedding model is not allowed")
	// ErrDocumentFileEmpty 表示文档文件为空。
	ErrDocumentFileEmpty = errors.New("document file is empty")
)
