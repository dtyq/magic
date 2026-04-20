package jrpc

import (
	"errors"
	"strings"

	documentapp "magic/internal/application/knowledge/document/service"
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	fragmentapp "magic/internal/application/knowledge/fragment/service"
	knowledgebaseapp "magic/internal/application/knowledge/knowledgebase/service"
	rebuildapp "magic/internal/application/knowledge/rebuild"
	documentdomain "magic/internal/domain/knowledge/document/service"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
)

// MapBusinessError 将应用/领域错误统一映射为对外业务错误码。
func MapBusinessError(err error) error {
	if err == nil {
		return nil
	}

	var bizErr *BusinessError
	if errors.As(err, &bizErr) {
		return bizErr
	}

	switch {
	case isPermissionError(err):
		return NewBusinessErrorWithMessage(ErrCodePermissionDenied, err.Error(), nil)
	case isConflictError(err):
		return NewBusinessErrorWithMessage(ErrCodeConflict, err.Error(), nil)
	case isEmbeddingError(err):
		return NewBusinessErrorWithMessage(ErrCodeEmbeddingFailed, buildEmbeddingErrorMessage(err), nil)
	case hasExecutionUserMessage(err):
		return NewBusinessErrorWithMessage(ErrCodeSyncFailed, executionErrorMessage(err), nil)
	case isExecutionError(err):
		return NewBusinessErrorWithMessage(ErrCodeSyncFailed, executionErrorMessage(err), nil)
	case isValidationError(err):
		return NewBusinessErrorWithMessage(ErrCodeInvalidParams, err.Error(), nil)
	case isKnowledgeBaseNotFoundError(err):
		return NewBusinessErrorWithMessage(ErrCodeKnowledgeBaseNotFound, err.Error(), nil)
	case isDocumentNotFoundError(err):
		return NewBusinessErrorWithMessage(ErrCodeDocumentNotFound, err.Error(), nil)
	case isFragmentNotFoundError(err):
		return NewBusinessErrorWithMessage(ErrCodeFragmentNotFound, err.Error(), nil)
	case isGenericNotFoundError(err):
		return NewBusinessErrorWithMessage(ErrCodeNotFound, err.Error(), nil)
	default:
		return NewBusinessError(ErrCodeInternalError, nil)
	}
}

type executionUserMessageProvider interface {
	ExecutionUserMessage() string
}

func hasExecutionUserMessage(err error) bool {
	var provider executionUserMessageProvider
	return errors.As(err, &provider) && strings.TrimSpace(provider.ExecutionUserMessage()) != ""
}

func executionErrorMessage(err error) string {
	var provider executionUserMessageProvider
	if errors.As(err, &provider) {
		if msg := strings.TrimSpace(provider.ExecutionUserMessage()); msg != "" {
			return msg
		}
	}
	return err.Error()
}

func isPermissionError(err error) bool {
	return errors.Is(err, documentapp.ErrDocumentOrgMismatch) ||
		errors.Is(err, fragmentapp.ErrFragmentPermissionDenied) ||
		errors.Is(err, knowledgebaseapp.ErrKnowledgeBasePermissionDenied) ||
		errors.Is(err, knowledgebaseapp.ErrOfficialOrganizationMemberRequired) ||
		errors.Is(err, rebuildapp.ErrOfficialOrganizationMemberRequired) ||
		errors.Is(err, knowledgebaseapp.ErrSuperMagicAgentNotManageable)
}

func isConflictError(err error) bool {
	return errors.Is(err, shared.ErrDocumentMappingConflict) ||
		errors.Is(err, knowledgebaseapp.ErrKnowledgeBaseBusinessIDAlreadyExists)
}

func isEmbeddingError(err error) bool {
	return errors.Is(err, embeddingapp.ErrEmbeddingComputeFailed) ||
		errors.Is(err, embeddingapp.ErrEmbeddingProvidersListFailed) ||
		errors.Is(err, embeddingdomain.ErrEmbeddingComputeFailed) ||
		errors.Is(err, embeddingdomain.ErrEmbeddingProvidersListFailed)
}

func buildEmbeddingErrorMessage(err error) string {
	if errors.Is(err, embeddingdomain.ErrEmbeddingComputeFailed) || errors.Is(err, embeddingdomain.ErrEmbeddingProvidersListFailed) {
		if isEmbeddingTimeoutError(err) {
			return "向量化服务调用超时，请稍后重试"
		}
		return "向量化服务调用失败，请稍后重试"
	}

	return err.Error()
}

func isEmbeddingTimeoutError(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "timeout") ||
		strings.Contains(message, "timed out") ||
		strings.Contains(message, "超时")
}

func isExecutionError(err error) bool {
	if errors.Is(err, documentapp.ErrDocumentSourcePrecheckFailed) || documentapp.IsDocumentSourcePrecheckError(err) {
		return true
	}

	var dimErr interface {
		ActualDimension() int64
	}
	if errors.As(err, &dimErr) {
		return true
	}

	var repoDimErr *fragmodel.VectorDimensionMismatchError
	return errors.As(err, &repoDimErr)
}

func isValidationError(err error) bool {
	for _, validationErr := range validationErrorList() {
		if errors.Is(err, validationErr) {
			return true
		}
	}
	return false
}

func validationErrorList() []error {
	return []error{
		documentapp.ErrDocumentFileEmpty,
		shared.ErrDocumentFileEmpty,
		shared.ErrKnowledgeBaseDisabled,
		shared.ErrFragmentDocumentCodeRequired,
		shared.ErrFragmentMetadataFilterRequired,
		shared.ErrUnsupportedThirdPlatformType,
		shared.ErrFragmentWriteDisabled,
		documentdomain.ErrNoParserFound,
		documentdomain.ErrDocumentSourceEmpty,
		embeddingdomain.ErrContentEmpty,
		knowledgebaseapp.ErrEmbeddingModelRequired,
		knowledgebaseapp.ErrEmbeddingModelNotAllowed,
		knowledgebaseapp.ErrMissingProjectSourceBindings,
		knowledgebaseapp.ErrUnsupportedSourceBindingProvider,
		knowledgebaseapp.ErrInvalidProjectRootRef,
		knowledgebaseapp.ErrInvalidSourceBindingNodesSourceType,
		knowledgebaseapp.ErrInvalidSourceBindingNodesProvider,
		knowledgebaseapp.ErrInvalidSourceBindingNodesParentType,
		knowledgebaseapp.ErrSourceBindingNodesParentRefRequired,
		knowledgebaseapp.ErrSourceBindingSemanticMismatch,
		knowledgebaseapp.ErrSourceBindingTargetTypeInvalid,
		knowledgebaseapp.ErrSourceBindingSyncModeInvalid,
		knowledgebaseapp.ErrSourceBindingTargetsNotAllowed,
		knowledgebaseapp.ErrUnsupportedRepairThirdPlatform,
		knowledgebaseapp.ErrRepairSourceBindingsOrganizationRequired,
		knowledgebaseapp.ErrInvalidAgentCode,
		knowledgebasedomain.ErrInvalidSourceType,
		knowledgebasedomain.ErrInvalidKnowledgeBaseType,
		knowledgebasedomain.ErrExplicitFlowSourceTypeRequired,
		knowledgebasedomain.ErrDigitalEmployeeSourceTypeRequired,
		knowledgebasedomain.ErrAmbiguousFlowSourceType,
		knowledgebasedomain.ErrManualDocumentCreateNotAllowed,
	}
}

func isKnowledgeBaseNotFoundError(err error) bool {
	return errors.Is(err, shared.ErrKnowledgeBaseNotFound)
}

func isDocumentNotFoundError(err error) bool {
	return errors.Is(err, shared.ErrDocumentNotFound)
}

func isFragmentNotFoundError(err error) bool {
	return errors.Is(err, shared.ErrFragmentNotFound)
}

func isGenericNotFoundError(err error) bool {
	return errors.Is(err, shared.ErrNotFound) ||
		errors.Is(err, knowledgebaseapp.ErrRepairSourceBindingDocumentNotMapped) ||
		errors.Is(err, knowledgebaseapp.ErrSuperMagicAgentNotFound)
}
