package ocr_test

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
	ocr "magic/internal/infrastructure/external/ocr"
	"magic/internal/infrastructure/logging"
)

const refreshedOCRContent = "second"

const normalizedOCRImageFileType = "image"

var errOCRUpstream500 = errors.New("upstream 500")

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
			_, err := client.OCR(context.Background(), "https://example.com/demo.pdf", "pdf")
			if !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
		})
	}
}

func TestVolcengineOCRClientCachesByHeaders(t *testing.T) {
	t.Parallel()

	const cachedContent = "first"

	lastModified := "Wed, 21 Oct 2015 07:28:00 GMT"
	etag := `"etag-1"`
	contentLength := "128"
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
	headerHook := func(context.Context, string) (string, string, string, error) {
		return lastModified, etag, contentLength, nil
	}
	invokeHook := func(_ context.Context, _, fileType string) (string, error) {
		invokeCount++
		if fileType != normalizedOCRImageFileType {
			t.Fatalf("expected normalized image file type, got %q", fileType)
		}
		if invokeCount == 1 {
			return cachedContent, nil
		}
		return refreshedOCRContent, nil
	}
	client.SetHeaderHookForTest(headerHook)
	client.SetInvokeHookForTest(invokeHook)

	first, err := client.OCR(context.Background(), "https://example.com/no-ext", "png")
	if err != nil {
		t.Fatalf("first OCR returned error: %v", err)
	}
	second, err := client.OCR(context.Background(), "https://example.com/no-ext", "png")
	if err != nil {
		t.Fatalf("second OCR returned error: %v", err)
	}
	if first != cachedContent || second != cachedContent {
		t.Fatalf("unexpected cached responses: %q %q", first, second)
	}
	if invokeCount != 1 {
		t.Fatalf("expected cached second call, got %d invokes", invokeCount)
	}

	etag = `"etag-2"`
	third, err := client.OCR(context.Background(), "https://example.com/no-ext", "png")
	if err != nil {
		t.Fatalf("third OCR returned error: %v", err)
	}
	if third != refreshedOCRContent {
		t.Fatalf("expected cache invalidation to refresh content, got %q", third)
	}
	if invokeCount != 2 {
		t.Fatalf("expected second invoke after etag change, got %d", invokeCount)
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
		if fileType != "pdf" {
			t.Fatalf("expected normalized pdf file type, got %q", fileType)
		}
		return "", errOCRUpstream500
	})

	_, err := client.OCR(context.Background(), "https://example.com/demo.pdf", "pdf")
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
