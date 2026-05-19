package jrpc

import (
	"errors"
	"strconv"
	"strings"

	documentapp "magic/internal/application/knowledge/document/service"
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	fragmentapp "magic/internal/application/knowledge/fragment/service"
	knowledgebaseapp "magic/internal/application/knowledge/knowledgebase/service"
	rebuildapp "magic/internal/application/knowledge/rebuild"
	documentdomain "magic/internal/domain/knowledge/document/service"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/i18n"
	"magic/internal/pkg/thirdplatform"
)

// MapBusinessErrorWithLanguage 将应用/领域错误统一映射为指定语言的对外业务错误码。
func MapBusinessErrorWithLanguage(err error, language string) error {
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
	case isResourceLimitError(err):
		return NewBusinessErrorWithMessage(ErrCodeInvalidParams, buildResourceLimitErrorMessage(err, language), nil)
	case isDocumentSourcePrecheckError(err):
		return NewBusinessErrorWithMessage(ErrCodeSyncFailed, i18n.Translate(i18n.KnowledgeDocumentSourcePrecheckFailed, language), nil)
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

func isResourceLimitError(err error) bool {
	return errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded)
}

func buildResourceLimitErrorMessage(err error, language string) string {
	var limitErr *documentdomain.ResourceLimitError
	if !errors.As(err, &limitErr) || limitErr == nil {
		return i18n.Translate(i18n.KnowledgeDocumentResourceLimitGeneric, language)
	}

	key := resourceLimitMessageKey(limitErr.LimitName)
	if key == i18n.KnowledgeDocumentResourceLimitGeneric {
		return i18n.Translate(key, language)
	}
	return i18n.Translatef(
		key,
		language,
		strconv.FormatInt(limitErr.ObservedValue, 10),
		strconv.FormatInt(limitErr.LimitValue, 10),
	)
}

func resourceLimitMessageKey(limitName string) i18n.MessageKey {
	switch limitName {
	case documentdomain.ResourceLimitMaxSourceBytes:
		return i18n.KnowledgeDocumentResourceLimitSourceBytes
	case documentdomain.ResourceLimitMaxTabularRows:
		return i18n.KnowledgeDocumentResourceLimitTabularRows
	case documentdomain.ResourceLimitMaxTabularCells:
		return i18n.KnowledgeDocumentResourceLimitTabularCells
	case documentdomain.ResourceLimitMaxPlainTextChars:
		return i18n.KnowledgeDocumentResourceLimitPlainTextChars
	case documentdomain.ResourceLimitMaxParsedBlocks:
		return i18n.KnowledgeDocumentResourceLimitParsedBlocks
	case documentdomain.ResourceLimitMaxFragmentsPerDocument:
		return i18n.KnowledgeDocumentResourceLimitFragments
	case documentdomain.ResourceLimitMaxPDFPages:
		return i18n.KnowledgeDocumentResourceLimitPDFPages
	case documentdomain.ResourceLimitMaxArchiveUncompressedBytes:
		return i18n.KnowledgeDocumentResourceLimitArchiveUncompressedBytes
	case documentdomain.ResourceLimitMaxArchiveEntryBytes:
		return i18n.KnowledgeDocumentResourceLimitArchiveEntryBytes
	case documentdomain.ResourceLimitMaxEmbeddedAssetBytes:
		return i18n.KnowledgeDocumentResourceLimitEmbeddedAssetBytes
	case documentdomain.ResourceLimitMaxPresentationSlides:
		return i18n.KnowledgeDocumentResourceLimitPresentationSlides
	default:
		return i18n.KnowledgeDocumentResourceLimitGeneric
	}
}

func isDocumentSourcePrecheckError(err error) bool {
	return errors.Is(err, documentapp.ErrDocumentSourcePrecheckFailed) || documentapp.IsDocumentSourcePrecheckError(err)
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
		errors.Is(err, documentapp.ErrDocumentPermissionDenied) ||
		errors.Is(err, fragmentapp.ErrFragmentPermissionDenied) ||
		errors.Is(err, knowledgebaseapp.ErrKnowledgeBasePermissionDenied) ||
		errors.Is(err, knowledgebaseapp.ErrOfficialOrganizationMemberRequired) ||
		errors.Is(err, rebuildapp.ErrOfficialOrganizationMemberRequired) ||
		errors.Is(err, knowledgebaseapp.ErrSuperMagicAgentNotManageable) ||
		errors.Is(err, thirdplatform.ErrPermissionDenied)
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
	if isDocumentSourcePrecheckError(err) {
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
		documentdomain.ErrManagedDocumentSingleDeleteNotAllowed,
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
		thirdplatform.ErrIdentityMissing,
		kbentity.ErrInvalidSourceType,
		kbentity.ErrInvalidKnowledgeBaseType,
		kbentity.ErrExplicitFlowSourceTypeRequired,
		kbentity.ErrDigitalEmployeeSourceTypeRequired,
		kbentity.ErrAmbiguousFlowSourceType,
		kbentity.ErrManualDocumentCreateNotAllowed,
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
