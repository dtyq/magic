package document_test

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
)

var (
	errThirdPlatformEmptyFileMessage = errors.New("resolve third-platform document failed: parse third-platform resolved source: document file is empty")
	errInvalidPptxZipMessage         = errors.New("parsing failed: parser failed: open pptx zip failed: zip: not a valid zip file")
	errOCRHTTP429                    = errors.New("http code 429")
	errTemporaryNetworkFailure       = errors.New("temporary network failure")
	errParsedSourceEmptyMessage      = errors.New("parse third-platform resolved source: document file is empty")
)

type nonRetryableErrorCase struct {
	name string
	err  error
	want bool
}

func TestIsNonRetryableDocumentSyncErrorPermanentFailures(t *testing.T) {
	t.Parallel()

	runNonRetryableErrorCases(t, []nonRetryableErrorCase{
		{
			name: "empty file",
			err:  shared.ErrDocumentFileEmpty,
			want: true,
		},
		{
			name: "third platform empty file message",
			err:  errThirdPlatformEmptyFileMessage,
			want: true,
		},
		{
			name: "unsupported file",
			err:  documentdomain.ErrUnsupportedKnowledgeBaseFileType,
			want: true,
		},
		{
			name: "no parser",
			err:  fmt.Errorf("parser failed: %w", documentdomain.ErrNoParserFound),
			want: true,
		},
		{
			name: "invalid pptx zip",
			err:  errInvalidPptxZipMessage,
			want: true,
		},
	})
}

func TestIsNonRetryableDocumentSyncErrorPermanentResourceLimits(t *testing.T) {
	t.Parallel()

	runNonRetryableErrorCases(t, []nonRetryableErrorCase{
		{
			name: "source too large",
			err: newTestResourceLimitError(
				documentdomain.ResourceLimitMaxSourceBytes,
				500,
				501,
				"read_source",
			),
			want: true,
		},
		{
			name: "too many table rows",
			err: newTestResourceLimitError(
				documentdomain.ResourceLimitMaxTabularRows,
				200_000,
				200_001,
				"parsed_document",
			),
			want: true,
		},
		{
			name: "too many table cells",
			err: newTestResourceLimitError(
				documentdomain.ResourceLimitMaxTabularCells,
				2_000_000,
				2_000_001,
				"parsed_document",
			),
			want: true,
		},
		{
			name: "plain text too large",
			err: newTestResourceLimitError(
				documentdomain.ResourceLimitMaxPlainTextChars,
				20_000_000,
				20_000_001,
				"parsed_document",
			),
			want: true,
		},
		{
			name: "too many parsed blocks",
			err: newTestResourceLimitError(
				documentdomain.ResourceLimitMaxParsedBlocks,
				250_000,
				250_001,
				"parsed_document",
			),
			want: true,
		},
		{
			name: "too many fragments",
			err: newTestResourceLimitError(
				documentdomain.ResourceLimitMaxFragmentsPerDocument,
				10_000,
				10_001,
				"build_fragments",
			),
			want: true,
		},
	})
}

func runNonRetryableErrorCases(t *testing.T, testCases []nonRetryableErrorCase) {
	t.Helper()
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := documentdomain.IsNonRetryableDocumentSyncError(tc.err); got != tc.want {
				t.Fatalf("expected non-retryable=%v, got %v for %v", tc.want, got, tc.err)
			}
		})
	}
}

func newTestResourceLimitError(limitName string, limitValue, observedValue int64, stage string) error {
	return fmt.Errorf(
		"new test resource limit error: %w",
		documentdomain.NewResourceLimitError(limitName, limitValue, observedValue, stage, ""),
	)
}

func TestIsNonRetryableDocumentSyncErrorWrappedResourceLimit(t *testing.T) {
	t.Parallel()

	resourceErr := documentdomain.NewResourceLimitError(
		documentdomain.ResourceLimitMaxTabularCells,
		2_000_000,
		3_410_641,
		"parsed_document",
		"document table is too large",
	)
	stageErr := documentdomain.NewSyncStageError(documentdomain.SyncFailureResourceLimitExceeded, resourceErr)
	err := fmt.Errorf("run document sync task: %w", stageErr)

	if !documentdomain.IsNonRetryableDocumentSyncError(err) {
		t.Fatalf("expected wrapped table resource limit to be non-retryable, got %v", err)
	}
}

func TestIsNonRetryableDocumentSyncErrorRetryableFailures(t *testing.T) {
	t.Parallel()

	runNonRetryableErrorCases(t, []nonRetryableErrorCase{
		{
			name: "ocr overload stays retryable",
			err:  documentdomain.NewOCROverloadedError(documentdomain.OCRProviderVolcengine, errOCRHTTP429),
			want: false,
		},
		{
			name: "ordinary upstream error stays retryable",
			err:  errTemporaryNetworkFailure,
			want: false,
		},
	})
}

func TestBuildTerminalSyncFailureMessage(t *testing.T) {
	t.Parallel()

	empty := documentdomain.NewSyncStageError(
		documentdomain.SyncFailureResolveThirdPlatform,
		errParsedSourceEmptyMessage,
	)
	emptyMessage := documentdomain.BuildTerminalSyncFailureMessage(empty)
	if !strings.HasPrefix(emptyMessage, documentdomain.SyncFailureDocumentFileEmpty+":") {
		t.Fatalf("expected empty document terminal reason, got %q", emptyMessage)
	}
	if strings.Contains(emptyMessage, documentdomain.SyncFailureRetryExhausted) {
		t.Fatalf("expected non-retryable failure not to use retry exhausted message, got %q", emptyMessage)
	}

	temporary := documentdomain.BuildTerminalSyncFailureMessage(errTemporaryNetworkFailure)
	if !strings.Contains(temporary, documentdomain.SyncFailureRetryExhausted) {
		t.Fatalf("expected retry exhausted message for retryable failure, got %q", temporary)
	}
}
