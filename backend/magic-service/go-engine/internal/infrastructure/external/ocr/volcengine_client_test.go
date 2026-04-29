package ocr_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	ocr "magic/internal/infrastructure/external/ocr"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/ratelimit"
)

const (
	refreshedOCRContent        = "second"
	normalizedOCRPDFFileType   = "pdf"
	normalizedOCRImageFileType = "image"
)

var (
	errOCRUpstream500              = errors.New("upstream 500")
	errOCR429                      = errors.New("http code 429")
	errOCRUsageReporterUnavailable = errors.New("ipc unavailable")
)

type executionUserMessageProvider interface {
	ExecutionUserMessage() string
}

type ocrConfigProviderStub struct {
	cfg *documentdomain.OCRAbilityConfig
	err error
}

func (s *ocrConfigProviderStub) GetOCRConfig(context.Context) (*documentdomain.OCRAbilityConfig, error) {
	return s.cfg, s.err
}

type ocrCacheRepoStub struct {
	mu         sync.Mutex
	nextID     int64
	urlCaches  map[string]*documentdomain.OCRResultCache
	byteCaches map[string]*documentdomain.OCRResultCache
}

type ocrRateLimiterStub struct {
	calls   int
	key     string
	timeout time.Duration
	result  ratelimit.Result
	err     error
}

func (s *ocrRateLimiterStub) Wait(_ context.Context, key string, timeout time.Duration) (ratelimit.Result, error) {
	s.calls++
	s.key = key
	s.timeout = timeout
	return s.result, s.err
}

type ocrUsageReporterStub struct {
	mu      sync.Mutex
	reports []documentdomain.OCRUsage
	err     error
}

func (s *ocrUsageReporterStub) ReportOCRUsage(_ context.Context, usage documentdomain.OCRUsage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reports = append(s.reports, usage)
	return s.err
}

func (s *ocrUsageReporterStub) snapshot() []documentdomain.OCRUsage {
	s.mu.Lock()
	defer s.mu.Unlock()
	reports := make([]documentdomain.OCRUsage, len(s.reports))
	copy(reports, s.reports)
	return reports
}

func newOCRCacheRepoStub() *ocrCacheRepoStub {
	return &ocrCacheRepoStub{
		nextID:     1,
		urlCaches:  make(map[string]*documentdomain.OCRResultCache),
		byteCaches: make(map[string]*documentdomain.OCRResultCache),
	}
}

func (s *ocrCacheRepoStub) FindURLCache(_ context.Context, textHash, model string) (*documentdomain.OCRResultCache, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cache := cloneOCRCache(s.urlCaches[textHash+"|"+model])
	if cache == nil {
		return nil, documentdomain.ErrOCRCacheNotFound
	}
	return cache, nil
}

func (s *ocrCacheRepoStub) FindBytesCache(_ context.Context, textHash, model string) (*documentdomain.OCRResultCache, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cache := cloneOCRCache(s.byteCaches[textHash+"|"+model])
	if cache == nil {
		return nil, documentdomain.ErrOCRCacheNotFound
	}
	return cache, nil
}

func (s *ocrCacheRepoStub) UpsertURLCache(_ context.Context, cache *documentdomain.OCRResultCache) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.upsert(s.urlCaches, cache)
	return nil
}

func (s *ocrCacheRepoStub) UpsertBytesCache(_ context.Context, cache *documentdomain.OCRResultCache) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.upsert(s.byteCaches, cache)
	return nil
}

func (s *ocrCacheRepoStub) Touch(_ context.Context, id int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, group := range []map[string]*documentdomain.OCRResultCache{s.urlCaches, s.byteCaches} {
		for key, cache := range group {
			if cache.ID != id {
				continue
			}
			cloned := cloneOCRCache(cache)
			cloned.AccessCount++
			group[key] = cloned
			return nil
		}
	}
	return nil
}

func (s *ocrCacheRepoStub) upsert(store map[string]*documentdomain.OCRResultCache, cache *documentdomain.OCRResultCache) {
	key := cache.TextHash + "|" + cache.EmbeddingModel
	existing := store[key]
	cloned := cloneOCRCache(cache)
	if existing != nil {
		cloned.ID = existing.ID
		cloned.AccessCount = existing.AccessCount + 1
	} else {
		cloned.ID = s.nextID
		s.nextID++
		if cloned.AccessCount == 0 {
			cloned.AccessCount = 1
		}
	}
	store[key] = cloned
}

func cloneOCRCache(cache *documentdomain.OCRResultCache) *documentdomain.OCRResultCache {
	if cache == nil {
		return nil
	}
	cloned := *cache
	return &cloned
}

func enabledVolcengineOCRConfig() *documentdomain.OCRAbilityConfig {
	return &documentdomain.OCRAbilityConfig{
		Enabled:      true,
		ProviderCode: "Volcengine",
		Providers: []documentdomain.OCRProviderConfig{
			{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
		},
	}
}

func newOCRUsageTestContext() context.Context {
	ctx := documentdomain.WithOCRUsageContext(context.Background(), documentdomain.OCRUsageContext{
		OrganizationCode:  "ORG-1",
		UserID:            "USER-1",
		KnowledgeBaseCode: "KB-1",
		DocumentCode:      "DOC-1",
		BusinessID:        "BIZ-1",
		SourceID:          "SRC-1",
	})
	return ctxmeta.WithRequestID(ctx, "REQ-1")
}

func TestVolcengineOCRClientValidateConfigErrors(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		cfg  *documentdomain.OCRAbilityConfig
		want error
	}{
		{
			name: "disabled",
			cfg:  &documentdomain.OCRAbilityConfig{},
			want: documentdomain.ErrOCRDisabled,
		},
		{
			name: "unsupported provider",
			cfg: &documentdomain.OCRAbilityConfig{
				Enabled:      true,
				ProviderCode: "Other",
			},
			want: documentdomain.ErrOCRProviderUnsupported,
		},
		{
			name: "missing credentials",
			cfg: &documentdomain.OCRAbilityConfig{
				Enabled:      true,
				ProviderCode: "Volcengine",
				Providers: []documentdomain.OCRProviderConfig{
					{Provider: "Volcengine", Enable: true},
				},
			},
			want: documentdomain.ErrOCRCredentialsIncomplete,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{cfg: tc.cfg}, nil, logging.New())
			_, err := client.OCR(context.Background(), "https://example.com/demo.pdf", normalizedOCRPDFFileType)
			if !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
		})
	}
}

func TestVolcengineOCRClientCachesSourceByContentHash(t *testing.T) {
	t.Parallel()

	const cachedContent = "first"
	invokeCount := 0
	samePDF := bytes.Repeat([]byte("same-pdf-"), (1<<20)/9+32)
	changedPDF := bytes.Repeat([]byte("changed-pdf-"), (1<<20)/12+48)

	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, newOCRCacheRepoStub(), logging.New())
	invokeHook := func(_ context.Context, _, fileType string) (string, error) {
		invokeCount++
		if fileType != normalizedOCRPDFFileType {
			t.Fatalf("expected normalized pdf file type, got %q", fileType)
		}
		if invokeCount == 1 {
			return cachedContent, nil
		}
		return refreshedOCRContent, nil
	}
	client.SetInvokeHookForTest(invokeHook)

	first, err := client.OCRSource(context.Background(), "https://example.com/demo.pdf?token=1", bytes.NewReader(samePDF), normalizedOCRPDFFileType)
	if err != nil {
		t.Fatalf("first OCRSource returned error: %v", err)
	}
	second, err := client.OCRSource(context.Background(), "https://example.com/demo.pdf?token=2", bytes.NewReader(samePDF), normalizedOCRPDFFileType)
	if err != nil {
		t.Fatalf("second OCRSource returned error: %v", err)
	}
	if first != cachedContent || second != cachedContent {
		t.Fatalf("unexpected cached responses: %q %q", first, second)
	}
	if invokeCount != 1 {
		t.Fatalf("expected cached second call, got %d invokes", invokeCount)
	}

	third, err := client.OCRSource(context.Background(), "https://example.com/demo.pdf?token=3", bytes.NewReader(changedPDF), normalizedOCRPDFFileType)
	if err != nil {
		t.Fatalf("third OCRSource returned error: %v", err)
	}
	if third != refreshedOCRContent {
		t.Fatalf("expected changed content hash to refresh content, got %q", third)
	}
	if invokeCount != 2 {
		t.Fatalf("expected second invoke after content hash change, got %d", invokeCount)
	}
}

func TestVolcengineOCRClientWaitsForRateLimitBeforeInvoke(t *testing.T) {
	t.Parallel()

	limiter := &ocrRateLimiterStub{
		result: ratelimit.Result{
			Allowed:   true,
			Remaining: 1,
			Waited:    5 * time.Millisecond,
		},
	}
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, nil, logging.New())
	client.SetRateLimiter(limiter, ocr.RateLimitConfig{
		Key:         "ocr:Volcengine",
		WaitTimeout: 10 * time.Second,
	})
	client.SetInvokeHookForTest(func(_ context.Context, _, fileType string) (string, error) {
		if limiter.calls != 1 {
			t.Fatalf("expected rate limiter to run before invoke, got %d calls", limiter.calls)
		}
		if fileType != normalizedOCRPDFFileType {
			t.Fatalf("expected normalized pdf file type, got %q", fileType)
		}
		return refreshedOCRContent, nil
	})

	content, err := client.OCR(context.Background(), "https://example.com/demo.pdf", normalizedOCRPDFFileType)
	if err != nil {
		t.Fatalf("OCR returned error: %v", err)
	}
	if content != refreshedOCRContent {
		t.Fatalf("unexpected OCR content: %q", content)
	}
	if limiter.key != "ocr:Volcengine" || limiter.timeout != 10*time.Second {
		t.Fatalf("unexpected limiter call key=%q timeout=%s", limiter.key, limiter.timeout)
	}
}

func TestVolcengineOCRClientBytesCacheHitSkipsRateLimiter(t *testing.T) {
	t.Parallel()

	limiter := &ocrRateLimiterStub{result: ratelimit.Result{Allowed: true}}
	invokeCount := 0
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, newOCRCacheRepoStub(), logging.New())
	client.SetRateLimiter(limiter, ocr.RateLimitConfig{
		Key:         "ocr:Volcengine",
		WaitTimeout: time.Second,
	})
	client.SetInvokeBytesHookForTest(func(_ context.Context, data []byte, fileType string) (string, error) {
		invokeCount++
		return string(data) + ":" + fileType, nil
	})

	first, err := client.OCRBytes(context.Background(), []byte("image-bytes"), "png")
	if err != nil {
		t.Fatalf("first OCRBytes returned error: %v", err)
	}
	second, err := client.OCRBytes(context.Background(), []byte("image-bytes"), "png")
	if err != nil {
		t.Fatalf("second OCRBytes returned error: %v", err)
	}

	if first != second {
		t.Fatalf("expected second call to return cached content, got %q and %q", first, second)
	}
	if invokeCount != 1 {
		t.Fatalf("expected one real OCR invoke, got %d", invokeCount)
	}
	if limiter.calls != 1 {
		t.Fatalf("expected cache hit not to take another rate-limit token, got %d limiter calls", limiter.calls)
	}
}

func TestVolcengineOCRClientReportsImageBytesUsageAfterSuccess(t *testing.T) {
	t.Parallel()

	reporter := &ocrUsageReporterStub{}
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, nil, logging.New())
	client.SetUsageReporter(reporter)
	client.SetInvokeBytesHookForTest(func(_ context.Context, data []byte, fileType string) (string, error) {
		if string(data) != "image-bytes" {
			t.Fatalf("unexpected OCR bytes: %q", string(data))
		}
		if fileType != normalizedOCRImageFileType {
			t.Fatalf("expected normalized image file type, got %q", fileType)
		}
		return refreshedOCRContent, nil
	})

	content, err := client.OCRBytes(newOCRUsageTestContext(), []byte("image-bytes"), "png")
	if err != nil {
		t.Fatalf("OCRBytes returned error: %v", err)
	}
	if content != refreshedOCRContent {
		t.Fatalf("unexpected OCR content: %q", content)
	}

	reports := reporter.snapshot()
	if len(reports) != 1 {
		t.Fatalf("expected one usage report, got %d", len(reports))
	}
	report := reports[0]
	if report.Provider != documentdomain.OCRProviderVolcengine ||
		report.OrganizationCode != "ORG-1" ||
		report.UserID != "USER-1" ||
		report.PageCount != 1 ||
		report.FileType != normalizedOCRImageFileType ||
		report.CallType != "bytes" ||
		report.KnowledgeBaseCode != "KB-1" ||
		report.DocumentCode != "DOC-1" ||
		report.BusinessID != "BIZ-1" ||
		report.SourceID != "SRC-1" ||
		report.RequestID != "REQ-1" ||
		report.EventID == "" {
		t.Fatalf("unexpected usage report: %#v", report)
	}
}

func TestVolcengineOCRClientCacheHitSkipsUsageReport(t *testing.T) {
	t.Parallel()

	reporter := &ocrUsageReporterStub{}
	invokeCount := 0
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, newOCRCacheRepoStub(), logging.New())
	client.SetUsageReporter(reporter)
	client.SetInvokeBytesHookForTest(func(context.Context, []byte, string) (string, error) {
		invokeCount++
		return refreshedOCRContent, nil
	})

	if _, err := client.OCRBytes(newOCRUsageTestContext(), []byte("image-bytes"), "png"); err != nil {
		t.Fatalf("first OCRBytes returned error: %v", err)
	}
	if _, err := client.OCRBytes(newOCRUsageTestContext(), []byte("image-bytes"), "png"); err != nil {
		t.Fatalf("second OCRBytes returned error: %v", err)
	}

	if invokeCount != 1 {
		t.Fatalf("expected one real invoke, got %d", invokeCount)
	}
	if reports := reporter.snapshot(); len(reports) != 1 {
		t.Fatalf("expected cache hit to skip second usage report, got %d reports", len(reports))
	}
}

func TestVolcengineOCRClientInvokeFailureSkipsUsageReport(t *testing.T) {
	t.Parallel()

	reporter := &ocrUsageReporterStub{}
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, nil, logging.New())
	client.SetUsageReporter(reporter)
	client.SetInvokeBytesHookForTest(func(context.Context, []byte, string) (string, error) {
		return "", errOCRUpstream500
	})

	_, err := client.OCRBytes(newOCRUsageTestContext(), []byte("image-bytes"), "png")
	if err == nil {
		t.Fatal("expected OCRBytes error")
	}
	if reports := reporter.snapshot(); len(reports) != 0 {
		t.Fatalf("expected no usage report on upstream failure, got %d reports", len(reports))
	}
}

func TestVolcengineOCRClientUsageReporterFailureDoesNotFailOCR(t *testing.T) {
	t.Parallel()

	reporter := &ocrUsageReporterStub{err: errOCRUsageReporterUnavailable}
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, nil, logging.New())
	client.SetUsageReporter(reporter)
	client.SetInvokeBytesHookForTest(func(context.Context, []byte, string) (string, error) {
		return refreshedOCRContent, nil
	})

	content, err := client.OCRBytes(newOCRUsageTestContext(), []byte("image-bytes"), "png")
	if err != nil {
		t.Fatalf("usage report failure should not fail OCR: %v", err)
	}
	if content != refreshedOCRContent {
		t.Fatalf("unexpected OCR content: %q", content)
	}
	if reports := reporter.snapshot(); len(reports) != 1 {
		t.Fatalf("expected one attempted usage report, got %d", len(reports))
	}
}

func TestVolcengineOCRClientReportsPDFPageCount(t *testing.T) {
	t.Parallel()

	reporter := &ocrUsageReporterStub{}
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, nil, logging.New())
	client.SetUsageReporter(reporter)
	client.SetInvokeHookForTest(func(context.Context, string, string) (string, error) {
		return refreshedOCRContent, nil
	})

	_, err := client.OCRSource(
		newOCRUsageTestContext(),
		"https://example.com/demo.pdf",
		bytes.NewReader(buildTestPDFWithPages(2)),
		normalizedOCRPDFFileType,
	)
	if err != nil {
		t.Fatalf("OCRSource returned error: %v", err)
	}

	reports := reporter.snapshot()
	if len(reports) != 1 {
		t.Fatalf("expected one usage report, got %d", len(reports))
	}
	if reports[0].PageCount != 2 || reports[0].CallType != "source" || reports[0].FileType != normalizedOCRPDFFileType {
		t.Fatalf("unexpected PDF usage report: %#v", reports[0])
	}
}

func TestVolcengineOCRClientClampsPDFPageCountToRequestLimit(t *testing.T) {
	t.Parallel()

	reporter := &ocrUsageReporterStub{}
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, nil, logging.New())
	client.SetUsageReporter(reporter)
	client.SetInvokeHookForTest(func(context.Context, string, string) (string, error) {
		return refreshedOCRContent, nil
	})

	_, err := client.OCRSource(
		newOCRUsageTestContext(),
		"https://example.com/large.pdf",
		bytes.NewReader(buildTestPDFWithPages(101)),
		normalizedOCRPDFFileType,
	)
	if err != nil {
		t.Fatalf("OCRSource returned error: %v", err)
	}

	reports := reporter.snapshot()
	if len(reports) != 1 {
		t.Fatalf("expected one usage report, got %d", len(reports))
	}
	if reports[0].PageCount != 100 {
		t.Fatalf("expected page count to be clamped to 100, got %#v", reports[0])
	}
}

func TestVolcengineOCRClientRateLimitTimeoutReturnsOverload(t *testing.T) {
	t.Parallel()

	limiter := &ocrRateLimiterStub{
		result: ratelimit.Result{RetryAfter: time.Second, Waited: 10 * time.Second},
		err:    ratelimit.ErrWaitTimeout,
	}
	invokeCount := 0
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: enabledVolcengineOCRConfig(),
	}, nil, logging.New())
	client.SetRateLimiter(limiter, ocr.RateLimitConfig{
		Key:         "ocr:Volcengine",
		WaitTimeout: time.Second,
	})
	client.SetInvokeHookForTest(func(context.Context, string, string) (string, error) {
		invokeCount++
		return refreshedOCRContent, nil
	})

	_, err := client.OCR(context.Background(), "https://example.com/demo.pdf", normalizedOCRPDFFileType)
	if err == nil {
		t.Fatal("expected error")
	}
	if !documentdomain.IsOCROverloaded(err) {
		t.Fatalf("expected OCR overload error, got %v", err)
	}
	if !errors.Is(err, ratelimit.ErrWaitTimeout) {
		t.Fatalf("expected rate limit timeout in error chain, got %v", err)
	}
	if invokeCount != 0 {
		t.Fatalf("expected OCR invoke to be skipped after limiter timeout, got %d", invokeCount)
	}
}

func TestVolcengineOCRClientRejectsUnsupportedFileType(t *testing.T) {
	t.Parallel()

	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, nil, logging.New())

	_, err := client.OCR(context.Background(), "https://example.com/demo.gif", "gif")
	if !errors.Is(err, documentdomain.ErrUnsupportedOCRFileType) {
		t.Fatalf("expected ErrUnsupportedOCRFileType, got %v", err)
	}
}

func TestVolcengineOCRClientReturnsExecutionUserMessageOnInvokeFailure(t *testing.T) {
	t.Parallel()

	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, nil, logging.New())
	client.SetInvokeHookForTest(func(_ context.Context, _, fileType string) (string, error) {
		if fileType != normalizedOCRPDFFileType {
			t.Fatalf("expected normalized pdf file type, got %q", fileType)
		}
		return "", errOCRUpstream500
	})

	_, err := client.OCR(context.Background(), "https://example.com/demo.pdf", normalizedOCRPDFFileType)
	if err == nil {
		t.Fatal("expected error")
	}

	var provider executionUserMessageProvider
	if !errors.As(err, &provider) {
		t.Fatalf("expected execution user message provider, got %T", err)
	}
	if provider.ExecutionUserMessage() != "OCR recognition is unavailable" {
		t.Fatalf("unexpected execution user message: %q", provider.ExecutionUserMessage())
	}
}

func TestVolcengineOCRClientPreservesOverloadError(t *testing.T) {
	t.Parallel()

	overload := documentdomain.NewOCROverloadedError(documentdomain.OCRProviderVolcengine, errOCR429)
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, nil, logging.New())
	client.SetInvokeHookForTest(func(context.Context, string, string) (string, error) {
		return "", fmt.Errorf("%w", overload)
	})

	_, err := client.OCR(context.Background(), "https://example.com/demo.pdf", normalizedOCRPDFFileType)
	if err == nil {
		t.Fatal("expected error")
	}
	if !documentdomain.IsOCROverloaded(err) {
		t.Fatalf("expected overload error to be preserved, got %v", err)
	}
}

func TestVolcengineOCRClientDoesNotTreatGenericFailureAsOverload(t *testing.T) {
	t.Parallel()

	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, nil, logging.New())
	client.SetInvokeHookForTest(func(context.Context, string, string) (string, error) {
		return "", errOCRUpstream500
	})

	_, err := client.OCR(context.Background(), "https://example.com/demo.pdf", normalizedOCRPDFFileType)
	if err == nil {
		t.Fatal("expected error")
	}
	if documentdomain.IsOCROverloaded(err) {
		t.Fatalf("expected generic upstream failure not to be overload, got %v", err)
	}
}

func TestVolcengineOCRClientCachesByImageBytesHash(t *testing.T) {
	t.Parallel()

	const cachedContent = "first"
	invokeCount := 0

	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, newOCRCacheRepoStub(), logging.New())
	client.SetInvokeBytesHookForTest(func(_ context.Context, data []byte, fileType string) (string, error) {
		invokeCount++
		if fileType != normalizedOCRImageFileType {
			t.Fatalf("expected normalized image file type, got %q", fileType)
		}
		if invokeCount == 1 {
			if string(data) != "image-bytes" {
				t.Fatalf("unexpected OCR bytes for first call: %q", string(data))
			}
			return cachedContent, nil
		}
		if string(data) != "image-bytes-changed" {
			t.Fatalf("unexpected OCR bytes for cache miss call: %q", string(data))
		}
		return refreshedOCRContent, nil
	})

	first, err := client.OCRBytes(context.Background(), []byte("image-bytes"), "png")
	if err != nil {
		t.Fatalf("first OCRBytes returned error: %v", err)
	}
	second, err := client.OCRBytes(context.Background(), []byte("image-bytes"), "png")
	if err != nil {
		t.Fatalf("second OCRBytes returned error: %v", err)
	}
	third, err := client.OCRBytes(context.Background(), []byte("image-bytes-changed"), "png")
	if err != nil {
		t.Fatalf("third OCRBytes returned error: %v", err)
	}

	if first != cachedContent || second != cachedContent {
		t.Fatalf("expected second OCRBytes call to hit cache, got %q and %q", first, second)
	}
	if third != refreshedOCRContent {
		t.Fatalf("expected changed content hash to bypass cache, got %q", third)
	}
	if invokeCount != 2 {
		t.Fatalf("expected 2 OCR invocations, got %d", invokeCount)
	}
}

func TestVolcengineOCRClientBytesReturnsExecutionUserMessageOnInvokeFailure(t *testing.T) {
	t.Parallel()

	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, nil, logging.New())
	client.SetInvokeBytesHookForTest(func(_ context.Context, data []byte, fileType string) (string, error) {
		if len(data) == 0 {
			t.Fatal("expected non-empty data")
		}
		if fileType != normalizedOCRImageFileType {
			t.Fatalf("expected normalized image file type, got %q", fileType)
		}
		return "", errOCRUpstream500
	})

	_, err := client.OCRBytes(context.Background(), []byte("image-bytes"), "png")
	if err == nil {
		t.Fatal("expected error")
	}

	var provider executionUserMessageProvider
	if !errors.As(err, &provider) {
		t.Fatalf("expected execution user message provider, got %T", err)
	}
	if provider.ExecutionUserMessage() != "OCR recognition is unavailable" {
		t.Fatalf("unexpected execution user message: %q", provider.ExecutionUserMessage())
	}
}

func TestVolcengineOCRClientBytesCacheSeparatesFileType(t *testing.T) {
	t.Parallel()

	invokeCount := 0
	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, newOCRCacheRepoStub(), logging.New())
	client.SetInvokeBytesHookForTest(func(_ context.Context, data []byte, fileType string) (string, error) {
		invokeCount++
		return string(data) + ":" + fileType, nil
	})

	first, err := client.OCRBytes(context.Background(), []byte("same-bytes"), "png")
	if err != nil {
		t.Fatalf("first OCRBytes returned error: %v", err)
	}
	second, err := client.OCRBytes(context.Background(), []byte("same-bytes"), "jpg")
	if err != nil {
		t.Fatalf("second OCRBytes returned error: %v", err)
	}

	if first != "same-bytes:image" {
		t.Fatalf("unexpected first OCRBytes result: %q", first)
	}
	if second != "same-bytes:image" {
		t.Fatalf("unexpected second OCRBytes result: %q", second)
	}
	if invokeCount != 2 {
		t.Fatalf("expected different file types to bypass cache, got %d invokes", invokeCount)
	}
}

func TestVolcengineOCRClientRejectsUnsupportedBytesFileType(t *testing.T) {
	t.Parallel()

	client := ocr.NewVolcengineOCRClient(&ocrConfigProviderStub{
		cfg: &documentdomain.OCRAbilityConfig{
			Enabled:      true,
			ProviderCode: "Volcengine",
			Providers: []documentdomain.OCRProviderConfig{
				{Provider: "Volcengine", Enable: true, AccessKey: "ak", SecretKey: "sk"},
			},
		},
	}, nil, logging.New())

	_, err := client.OCRBytes(context.Background(), []byte("gif"), "gif")
	if !errors.Is(err, documentdomain.ErrUnsupportedOCRFileType) {
		t.Fatalf("expected ErrUnsupportedOCRFileType, got %v", err)
	}
}

func buildTestPDFWithPages(pageCount int) []byte {
	if pageCount <= 0 {
		pageCount = 1
	}
	fontObjectID := 3 + pageCount*2
	pageRefs := make([]string, 0, pageCount)
	objects := []string{
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
	}
	for page := range pageCount {
		pageObjectID := 3 + page*2
		contentObjectID := pageObjectID + 1
		pageRefs = append(pageRefs, fmt.Sprintf("%d 0 R", pageObjectID))
		stream := fmt.Sprintf("BT /F1 24 Tf 72 720 Td (Page %d) Tj ET", page+1)
		objects = append(objects,
			fmt.Sprintf(
				"%d 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>\nendobj\n",
				pageObjectID,
				fontObjectID,
				contentObjectID,
			),
			fmt.Sprintf("%d 0 obj\n<< /Length %d >>\nstream\n%s\nendstream\nendobj\n", contentObjectID, len(stream), stream),
		)
	}
	objects = append([]string{
		objects[0],
		fmt.Sprintf("2 0 obj\n<< /Type /Pages /Kids [%s] /Count %d >>\nendobj\n", strings.Join(pageRefs, " "), pageCount),
	}, objects[1:]...)
	objects = append(objects, fmt.Sprintf("%d 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n", fontObjectID))

	var buffer bytes.Buffer
	buffer.WriteString("%PDF-1.4\n")
	buffer.Write([]byte("%\xE2\xE3\xCF\xD3\n"))

	offsets := make([]int, len(objects)+1)
	for index, object := range objects {
		offsets[index+1] = buffer.Len()
		buffer.WriteString(object)
	}

	xrefOffset := buffer.Len()
	fmt.Fprintf(&buffer, "xref\n0 %d\n", len(objects)+1)
	buffer.WriteString("0000000000 65535 f \n")
	for index := 1; index <= len(objects); index++ {
		fmt.Fprintf(&buffer, "%010d 00000 n \n", offsets[index])
	}
	fmt.Fprintf(&buffer, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF", len(objects)+1, xrefOffset)
	return buffer.Bytes()
}

func TestResolveVolcengineEndpoint(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name           string
		endpoint       string
		expectedHost   string
		expectedScheme string
	}{
		{
			name:           "empty uses https default",
			endpoint:       "",
			expectedHost:   "visual.volcengineapi.com",
			expectedScheme: "https",
		},
		{
			name:           "host without scheme uses https default",
			endpoint:       "visual.volcengineapi.com",
			expectedHost:   "visual.volcengineapi.com",
			expectedScheme: "https",
		},
		{
			name:           "url with explicit scheme keeps scheme",
			endpoint:       "http://internal-volc.example.com",
			expectedHost:   "internal-volc.example.com",
			expectedScheme: "http",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			host, scheme := ocr.ResolveVolcengineEndpointForTest(tc.endpoint)
			if host != tc.expectedHost || scheme != tc.expectedScheme {
				t.Fatalf("expected (%s,%s), got (%s,%s)", tc.expectedHost, tc.expectedScheme, host, scheme)
			}
		})
	}
}

func TestResolveVolcengineProxyFallsBackToStandardEnv(t *testing.T) {
	t.Setenv("VOLC_HTTP_PROXY", "")
	t.Setenv("VOLC_HTTPS_PROXY", "")
	t.Setenv("VOLC_NO_PROXY", "")
	t.Setenv("HTTP_PROXY", "http://127.0.0.1:7897")
	t.Setenv("HTTPS_PROXY", "http://127.0.0.1:7897")
	t.Setenv("NO_PROXY", "")

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://visual.volcengineapi.com", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	proxyURL, err := ocr.ResolveVolcengineProxyForTest(req)
	if err != nil {
		t.Fatalf("resolve proxy: %v", err)
	}
	if proxyURL == nil || proxyURL.String() != "http://127.0.0.1:7897" {
		t.Fatalf("expected standard env proxy fallback, got %#v", proxyURL)
	}
}

func TestResolveVolcengineProxyPrefersVolcEnv(t *testing.T) {
	t.Setenv("VOLC_HTTP_PROXY", "http://127.0.0.1:8899")
	t.Setenv("VOLC_HTTPS_PROXY", "http://127.0.0.1:8899")
	t.Setenv("VOLC_NO_PROXY", "")
	t.Setenv("HTTP_PROXY", "http://127.0.0.1:7897")
	t.Setenv("HTTPS_PROXY", "http://127.0.0.1:7897")
	t.Setenv("NO_PROXY", "")

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://visual.volcengineapi.com", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	proxyURL, err := ocr.ResolveVolcengineProxyForTest(req)
	if err != nil {
		t.Fatalf("resolve proxy: %v", err)
	}
	if proxyURL == nil || proxyURL.String() != "http://127.0.0.1:8899" {
		t.Fatalf("expected volc env proxy, got %#v", proxyURL)
	}
}
