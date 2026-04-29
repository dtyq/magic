package jrpc_test

import (
	"errors"
	"fmt"
	"testing"

	documentapp "magic/internal/application/knowledge/document/service"
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	knowledgebaseapp "magic/internal/application/knowledge/knowledgebase/service"
	documentdomain "magic/internal/domain/knowledge/document/service"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	jsonrpc "magic/internal/pkg/jsonrpc"
	"magic/internal/pkg/thirdplatform"
)

var (
	errTestUnknown                          = errors.New("unknown")
	errTestBucketNotFound                   = errors.New("bucket not found")
	errTestLLMTimeout                       = errors.New("connection to LLM service timed out")
	errTestUpstreamDown                     = errors.New("upstream unavailable")
	errTestOpenPDFFailedFallbackOCRDisabled = errors.New("open pdf failed: missing EOF\nfallback document ocr failed: ocr disabled")
	errTestOCRFailedInvokeVolcengine500     = errors.New("ocr failed: invoke volcengine ocr: upstream 500")
)

type executionUserMessageStubError struct {
	message string
	err     error
}

func (e *executionUserMessageStubError) Error() string {
	if e == nil || e.err == nil {
		return ""
	}
	return e.err.Error()
}

func (e *executionUserMessageStubError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

func (e *executionUserMessageStubError) ExecutionUserMessage() string {
	if e == nil {
		return ""
	}
	return e.message
}

type businessErrorCase struct {
	name          string
	err           error
	wantCode      int
	wantMessage   string
	wantUseRawMsg bool
}

func TestMapBusinessError(t *testing.T) {
	t.Parallel()

	for _, tc := range businessErrorCases() {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertBusinessErrorMapping(t, tc)
		})
	}
}

func businessErrorCases() []businessErrorCase {
	cases := make([]businessErrorCase, 0, 15)
	cases = append(cases, executionErrorCases()...)
	cases = append(cases, validationErrorCases()...)
	cases = append(cases, notFoundErrorCases()...)
	cases = append(cases, passthroughErrorCases()...)
	return cases
}

func executionErrorCases() []businessErrorCase {
	return []businessErrorCase{
		{
			name:          "document source precheck failed -> execute failed",
			err:           errors.Join(documentapp.ErrDocumentSourcePrecheckFailed, errTestBucketNotFound),
			wantCode:      jsonrpc.ErrCodeSyncFailed,
			wantUseRawMsg: true,
		},
		{
			name: "vector dimension mismatch -> execute failed",
			err: &fragmodel.VectorDimensionMismatchError{
				Collection: "magic_knowledge",
				Expected:   1024,
				Actual:     3072,
				Index:      0,
			},
			wantCode:      jsonrpc.ErrCodeSyncFailed,
			wantUseRawMsg: true,
		},
		{
			name:          "embedding compute failed -> execute failed",
			err:           errors.Join(embeddingapp.ErrEmbeddingComputeFailed, ipcclient.ErrNoClientConnected),
			wantCode:      jsonrpc.ErrCodeEmbeddingFailed,
			wantUseRawMsg: true,
		},
		{
			name:          "embedding providers list failed -> execute failed",
			err:           errors.Join(embeddingapp.ErrEmbeddingProvidersListFailed, ipcclient.ErrPHPRequestFailed),
			wantCode:      jsonrpc.ErrCodeEmbeddingFailed,
			wantUseRawMsg: true,
		},
		{
			name: "domain embedding timeout -> embedding failed",
			err: fmt.Errorf(
				"failed to compute query embedding: %w",
				fmt.Errorf("%w: get embedding: %w", embeddingdomain.ErrEmbeddingComputeFailed, errTestLLMTimeout),
			),
			wantCode:    jsonrpc.ErrCodeEmbeddingFailed,
			wantMessage: "向量化服务调用超时，请稍后重试",
		},
		{
			name: "domain embedding providers failed -> embedding failed",
			err: fmt.Errorf(
				"list providers failed: %w",
				fmt.Errorf("%w: failed to get providers: %w", embeddingdomain.ErrEmbeddingProvidersListFailed, errTestUpstreamDown),
			),
			wantCode:    jsonrpc.ErrCodeEmbeddingFailed,
			wantMessage: "向量化服务调用失败，请稍后重试",
		},
	}
}

func validationErrorCases() []businessErrorCase {
	cases := make([]businessErrorCase, 0, 14)
	cases = append(cases, genericValidationErrorCases()...)
	cases = append(cases, knowledgeBaseValidationErrorCases()...)
	cases = append(cases, permissionValidationErrorCases()...)
	return cases
}

func genericValidationErrorCases() []businessErrorCase {
	return []businessErrorCase{
		{
			name:          "document file empty -> validate failed",
			err:           documentapp.ErrDocumentFileEmpty,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "no parser found -> validate failed",
			err:           documentdomain.ErrNoParserFound,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "document source empty -> validate failed",
			err:           documentdomain.ErrDocumentSourceEmpty,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "embedding content empty -> validate failed",
			err:           embeddingdomain.ErrContentEmpty,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "fragment write disabled -> validate failed",
			err:           shared.ErrFragmentWriteDisabled,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "third platform identity missing -> validate failed",
			err:           thirdplatform.ErrIdentityMissing,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
	}
}

func knowledgeBaseValidationErrorCases() []businessErrorCase {
	return []businessErrorCase{
		{
			name:          "unsupported source binding provider -> validate failed",
			err:           knowledgebaseapp.ErrUnsupportedSourceBindingProvider,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "unsupported repair third platform -> validate failed",
			err:           knowledgebaseapp.ErrUnsupportedRepairThirdPlatform,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "invalid agent code -> validate failed",
			err:           knowledgebaseapp.ErrInvalidAgentCode,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "invalid knowledge base source type -> validate failed",
			err:           kbentity.ErrInvalidSourceType,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "invalid knowledge base type -> validate failed",
			err:           kbentity.ErrInvalidKnowledgeBaseType,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "explicit flow source type required -> validate failed",
			err:           kbentity.ErrExplicitFlowSourceTypeRequired,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "digital employee source type required -> validate failed",
			err:           kbentity.ErrDigitalEmployeeSourceTypeRequired,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
		{
			name:          "ambiguous flow source type -> validate failed",
			err:           kbentity.ErrAmbiguousFlowSourceType,
			wantCode:      jsonrpc.ErrCodeInvalidParams,
			wantUseRawMsg: true,
		},
	}
}

func permissionValidationErrorCases() []businessErrorCase {
	return []businessErrorCase{
		{
			name:          "document org mismatch -> access denied",
			err:           documentapp.ErrDocumentOrgMismatch,
			wantCode:      jsonrpc.ErrCodePermissionDenied,
			wantUseRawMsg: true,
		},
		{
			name:          "third platform permission denied -> access denied",
			err:           fmt.Errorf("list tree nodes: %w", thirdplatform.ErrPermissionDenied),
			wantCode:      jsonrpc.ErrCodePermissionDenied,
			wantUseRawMsg: true,
		},
	}
}

func notFoundErrorCases() []businessErrorCase {
	return []businessErrorCase{
		{
			name:          "knowledge not found -> knowledge validate failed",
			err:           shared.ErrKnowledgeBaseNotFound,
			wantCode:      jsonrpc.ErrCodeKnowledgeBaseNotFound,
			wantUseRawMsg: true,
		},
		{
			name:          "document not found -> knowledge validate failed",
			err:           shared.ErrDocumentNotFound,
			wantCode:      jsonrpc.ErrCodeDocumentNotFound,
			wantUseRawMsg: true,
		},
		{
			name:          "fragment not found -> knowledge validate failed",
			err:           shared.ErrFragmentNotFound,
			wantCode:      jsonrpc.ErrCodeFragmentNotFound,
			wantUseRawMsg: true,
		},
		{
			name:          "generic not found -> knowledge validate failed",
			err:           shared.ErrNotFound,
			wantCode:      jsonrpc.ErrCodeNotFound,
			wantUseRawMsg: true,
		},
		{
			name:          "repair source binding document not mapped -> knowledge validate failed",
			err:           knowledgebaseapp.ErrRepairSourceBindingDocumentNotMapped,
			wantCode:      jsonrpc.ErrCodeNotFound,
			wantUseRawMsg: true,
		},
		{
			name:          "super magic agent not found -> knowledge validate failed",
			err:           knowledgebaseapp.ErrSuperMagicAgentNotFound,
			wantCode:      jsonrpc.ErrCodeNotFound,
			wantUseRawMsg: true,
		},
	}
}

func passthroughErrorCases() []businessErrorCase {
	return []businessErrorCase{
		{
			name:          "official organization member required -> access denied",
			err:           knowledgebaseapp.ErrOfficialOrganizationMemberRequired,
			wantCode:      jsonrpc.ErrCodePermissionDenied,
			wantUseRawMsg: true,
		},
		{
			name:          "super magic agent not manageable -> access denied",
			err:           knowledgebaseapp.ErrSuperMagicAgentNotManageable,
			wantCode:      jsonrpc.ErrCodePermissionDenied,
			wantUseRawMsg: true,
		},
		{
			name:        "unknown -> internal error",
			err:         errTestUnknown,
			wantCode:    jsonrpc.ErrCodeInternalError,
			wantMessage: jsonrpc.GetErrorMessage(jsonrpc.ErrCodeInternalError),
		},
		{
			name: "execution user message -> sync failed with custom message",
			err: &executionUserMessageStubError{
				message: "PDF parsing failed and OCR recognition is unavailable",
				err:     errTestOpenPDFFailedFallbackOCRDisabled,
			},
			wantCode:    jsonrpc.ErrCodeSyncFailed,
			wantMessage: "PDF parsing failed and OCR recognition is unavailable",
		},
		{
			name: "wrapped execution user message -> sync failed with custom message",
			err: fmt.Errorf(
				"failed to parse document: %w",
				fmt.Errorf(
					"parser failed: %w",
					&executionUserMessageStubError{
						message: "OCR recognition is unavailable",
						err:     errTestOCRFailedInvokeVolcengine500,
					},
				),
			),
			wantCode:    jsonrpc.ErrCodeSyncFailed,
			wantMessage: "OCR recognition is unavailable",
		},
		{
			name:          "business error passthrough",
			err:           jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodePermissionDenied, "custom denied", nil),
			wantCode:      jsonrpc.ErrCodePermissionDenied,
			wantMessage:   "custom denied",
			wantUseRawMsg: false,
		},
	}
}

func assertBusinessErrorMapping(t *testing.T, tc businessErrorCase) {
	t.Helper()

	mapped := jsonrpc.MapBusinessError(tc.err)

	var bizErr *jsonrpc.BusinessError
	if !errors.As(mapped, &bizErr) {
		t.Fatalf("expected BusinessError, got %T", mapped)
	}
	if bizErr.Code != tc.wantCode {
		t.Fatalf("expected code=%d, got %d", tc.wantCode, bizErr.Code)
	}

	wantMessage := tc.wantMessage
	if tc.wantUseRawMsg {
		wantMessage = tc.err.Error()
	}
	if wantMessage != "" && bizErr.Message != wantMessage {
		t.Fatalf("expected message=%q, got %q", wantMessage, bizErr.Message)
	}
}
