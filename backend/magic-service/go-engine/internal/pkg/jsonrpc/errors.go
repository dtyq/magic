// Package jrpc 提供 JSON-RPC 2.0 协议实现
package jrpc

import "fmt"

// 业务错误码定义（与 PHP error_message.php 对齐）
const (
	// FlowErrorCode::ValidateFailed
	ErrCodeInvalidParams = 31001
	// FlowErrorCode::KnowledgeValidateFailed
	ErrCodeNotFound              = 31007
	ErrCodeKnowledgeBaseNotFound = 31007
	ErrCodeFragmentNotFound      = 31007
	ErrCodeDocumentNotFound      = 31007
	// PermissionErrorCode::AccessDenied
	ErrCodePermissionDenied = 42003
	// FlowErrorCode::BusinessException
	ErrCodeConflict = 31002
	// FlowErrorCode::ExecuteFailed
	ErrCodeSyncFailed       = 31005
	ErrCodeEmbeddingFailed  = 31005
	ErrCodeEmbeddingTimeout = 31005
	// GenericErrorCode::SystemError
	ErrCodeInternalError = 5000

	// 保留兼容常量，避免历史引用编译失败
	ErrCodeKnowledgeBaseExists = ErrCodeConflict
	ErrCodeFragmentExists      = ErrCodeConflict
	ErrCodeDocumentExists      = ErrCodeConflict
)

// GetErrorMessage 获取错误消息
func GetErrorMessage(code int) string {
	switch code {
	case ErrCodeInvalidParams:
		return "参数校验失败"
	case ErrCodeNotFound:
		return "知识校验失败"
	case ErrCodePermissionDenied:
		return "权限不足"
	case ErrCodeConflict:
		return "业务冲突"
	case ErrCodeInternalError:
		return "内部错误"
	case ErrCodeSyncFailed:
		return "执行失败"
	default:
		return "未知错误"
	}
}

// BusinessError 业务错误
type BusinessError struct {
	Code    int
	Message string
	Data    any
}

// Error 实现 error 接口
func (e *BusinessError) Error() string {
	if e.Data != nil {
		return fmt.Sprintf("[%d] %s: %v", e.Code, e.Message, e.Data)
	}
	return fmt.Sprintf("[%d] %s", e.Code, e.Message)
}

// ToRPCError 转换为 JSON-RPC Error
func (e *BusinessError) ToRPCError() *Error {
	return &Error{
		Code:    e.Code,
		Message: e.Message,
		Data:    e.Data,
	}
}

// NewBusinessError 创建业务错误
func NewBusinessError(code int, data any) *BusinessError {
	return &BusinessError{
		Code:    code,
		Message: GetErrorMessage(code),
		Data:    data,
	}
}

// NewBusinessErrorWithMessage 创建带自定义消息的业务错误
func NewBusinessErrorWithMessage(code int, message string, data any) *BusinessError {
	return &BusinessError{
		Code:    code,
		Message: message,
		Data:    data,
	}
}

// WrapError 包装标准错误为业务错误
func WrapError(code int, err error) *BusinessError {
	return &BusinessError{
		Code:    code,
		Message: GetErrorMessage(code),
		Data:    err.Error(),
	}
}
