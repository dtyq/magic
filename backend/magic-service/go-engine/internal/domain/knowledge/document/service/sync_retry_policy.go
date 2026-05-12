package document

import (
	"errors"
	"strings"

	"magic/internal/domain/knowledge/shared"
)

// IsNonRetryableDocumentSyncError 判断文档同步失败是否属于确定性的文件异常。
func IsNonRetryableDocumentSyncError(err error) bool {
	if err == nil || IsOCROverloaded(err) {
		return false
	}
	if isTerminalResourceLimitError(err) {
		return true
	}
	if isKnownPermanentDocumentError(err) {
		return true
	}
	return hasPermanentDocumentFailureMessage(err)
}

// BuildTerminalSyncFailureMessage 根据失败类型构造 MQ 终态失败文案。
func BuildTerminalSyncFailureMessage(cause error) string {
	if !IsNonRetryableDocumentSyncError(cause) {
		return BuildSyncFailureMessage(SyncFailureRetryExhausted, cause)
	}
	reason := classifyNonRetryableSyncReason(cause)
	if reason == "" {
		reason = SyncFailureParsing
	}
	stageReason, unwrapped := unwrapSyncStageError(cause, reason)
	if reason == SyncFailureParsing && strings.TrimSpace(stageReason) != "" {
		reason = stageReason
	}
	return BuildSyncFailureMessage(reason, unwrapped)
}

func classifyNonRetryableSyncReason(err error) string {
	if isTerminalResourceLimitError(err) {
		return SyncFailureResourceLimitExceeded
	}
	if isEmptyDocumentError(err) || hasEmptyDocumentFailureMessage(err) {
		return SyncFailureDocumentFileEmpty
	}
	return SyncFailureParsing
}

func isTerminalResourceLimitError(err error) bool {
	var limitErr *ResourceLimitError
	if !errors.As(err, &limitErr) || limitErr == nil {
		return false
	}
	switch limitErr.LimitName {
	case ResourceLimitMaxSourceBytes,
		ResourceLimitMaxTabularRows,
		ResourceLimitMaxTabularCells,
		ResourceLimitMaxPlainTextChars,
		ResourceLimitMaxParsedBlocks,
		ResourceLimitMaxFragmentsPerDocument:
		return true
	default:
		return false
	}
}

func isKnownPermanentDocumentError(err error) bool {
	return isEmptyDocumentError(err) ||
		errors.Is(err, ErrUnsupportedKnowledgeBaseFileType) ||
		errors.Is(err, ErrNoParserFound) ||
		errors.Is(err, ErrDocumentSourceEmpty) ||
		errors.Is(err, ErrResolvedFileURLEmpty) ||
		errors.Is(err, ErrUnsupportedOCRFileType)
}

func isEmptyDocumentError(err error) bool {
	return errors.Is(err, shared.ErrDocumentFileEmpty)
}

func hasPermanentDocumentFailureMessage(err error) bool {
	message := strings.ToLower(err.Error())
	if hasEmptyDocumentFailureMessage(err) {
		return true
	}
	return strings.Contains(message, "unsupported knowledge base file type") ||
		strings.Contains(message, "no parser found") ||
		strings.Contains(message, "ocr file type is not supported") ||
		strings.Contains(message, "zip: not a valid zip file") ||
		strings.Contains(message, "not a valid zip file") ||
		strings.Contains(message, "unsupported compression method") ||
		strings.Contains(message, "open pptx zip failed") ||
		strings.Contains(message, "open docx zip failed") ||
		strings.Contains(message, "open xlsx zip failed") ||
		strings.Contains(message, "read pptx failed") ||
		strings.Contains(message, "read docx failed") ||
		strings.Contains(message, "read xlsx failed")
}

func hasEmptyDocumentFailureMessage(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "document file is empty") ||
		strings.Contains(message, "document source is empty") ||
		strings.Contains(message, "parsed content is empty") ||
		strings.Contains(message, "empty source")
}
