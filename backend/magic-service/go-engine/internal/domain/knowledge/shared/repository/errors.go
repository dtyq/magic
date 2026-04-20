// Package repository 提供领域实体的仓储接口。
package repository

import "errors"

// 通用仓储错误
var (
	// ErrNotFound 表示资源未找到。
	ErrNotFound = errors.New("not found")

	// ErrFragmentNotFound 表示片段未找到
	ErrFragmentNotFound = errors.New("fragment not found")

	// ErrKnowledgeBaseNotFound 表示知识库未找到
	ErrKnowledgeBaseNotFound = errors.New("knowledge base not found")

	// ErrDocumentNotFound 表示文档未找到
	ErrDocumentNotFound = errors.New("document not found")

	// ErrFragmentDocumentCodeRequired 表示片段 document_code 不能为空。
	ErrFragmentDocumentCodeRequired = errors.New("fragment document code is required")
)
