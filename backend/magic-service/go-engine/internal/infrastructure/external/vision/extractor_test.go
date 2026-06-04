package vision_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	"magic/internal/infrastructure/external/vision"
	"magic/internal/pkg/ctxmeta"
)

var (
	errAbilityRPC = errors.New("ability rpc failed")
	errModelDown  = errors.New("model down")
)

const (
	testMIMEImageJPEG = "image/jpeg"
	testMIMEImagePNG  = "image/png"
)

func TestConfigurableVisualTextExtractorFallsBackToOCR(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		ability fakeAbilityProvider
	}{
		{
			name:    "ability rpc failed",
			ability: fakeAbilityProvider{err: errAbilityRPC},
		},
		{
			name: "ability disabled",
			ability: fakeAbilityProvider{config: documentdomain.AIAbilityConfig{
				Enabled: false,
				Config:  map[string]any{"model_id": "qwen-vl"},
			}},
		},
		{
			name: "empty model",
			ability: fakeAbilityProvider{config: documentdomain.AIAbilityConfig{
				Enabled: true,
				Config:  map[string]any{"model_id": ""},
			}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ocr := &fakeVisualOCR{text: "ocr text"}
			extractor := vision.NewConfigurableVisualTextExtractor(
				&tc.ability,
				&fakeModelConfigProvider{},
				vision.NewOCRVisualTextExtractor(ocr),
				vision.NewModelVisualTextExtractor(&fakeVisionClient{text: "model text"}, &fakePDFRenderer{}, vision.Config{}, documentdomain.DefaultResourceLimits(), nil),
				nil,
			)

			text, err := extractor.RecognizeSource(context.Background(), "https://example.test/a.png", strings.NewReader("image"), "png")
			if err != nil {
				t.Fatalf("RecognizeSource returned error: %v", err)
			}
			if text != "ocr text" {
				t.Fatalf("expected OCR text, got %q", text)
			}
			if ocr.sourceCalls != 1 {
				t.Fatalf("expected OCR source call once, got %d", ocr.sourceCalls)
			}
		})
	}
}

func TestConfigurableVisualTextExtractorUsesModelForImage(t *testing.T) {
	t.Parallel()

	ocr := &fakeVisualOCR{text: "ocr text"}
	client := &fakeVisionClient{text: "model text"}
	extractor := newModelModeExtractor(ocr, client, &fakePDFRenderer{})

	text, err := extractor.RecognizeSource(context.Background(), "https://example.test/a.png", strings.NewReader("image"), "png")
	if err != nil {
		t.Fatalf("RecognizeSource returned error: %v", err)
	}
	if text != "model text" {
		t.Fatalf("expected model text, got %q", text)
	}
	if ocr.sourceCalls != 0 {
		t.Fatalf("expected OCR not called, got %d", ocr.sourceCalls)
	}
	if client.calls != 1 {
		t.Fatalf("expected model called once, got %d", client.calls)
	}
	if client.lastInput.MIMEType != testMIMEImagePNG {
		t.Fatalf("expected image/png, got %q", client.lastInput.MIMEType)
	}
}

func TestConfigurableVisualTextExtractorUsesBusinessParamsOrganization(t *testing.T) {
	t.Parallel()

	ability := &fakeAbilityProvider{config: documentdomain.AIAbilityConfig{
		Enabled: true,
		Config:  map[string]any{"model_id": "qwen-vl"},
	}}
	modelConfig := &fakeModelConfigProvider{config: testModelConfig()}
	extractor := vision.NewConfigurableVisualTextExtractor(
		ability,
		modelConfig,
		vision.NewOCRVisualTextExtractor(&fakeVisualOCR{text: "ocr text"}),
		vision.NewModelVisualTextExtractor(&fakeVisionClient{text: "model text"}, &fakePDFRenderer{}, vision.Config{}, documentdomain.DefaultResourceLimits(), nil),
		nil,
	)
	ctx := ctxmeta.WithBusinessParams(context.Background(), &ctxmeta.BusinessParams{
		OrganizationCode: "TGosRaFhvb",
		UserID:           "usi_test",
	})

	text, err := extractor.RecognizeSource(ctx, "https://example.test/a.png", strings.NewReader("image"), "png")
	if err != nil {
		t.Fatalf("RecognizeSource returned error: %v", err)
	}
	if text != "model text" {
		t.Fatalf("expected model text, got %q", text)
	}
	if ability.organizationCode != "TGosRaFhvb" {
		t.Fatalf("ability organization_code = %q, want TGosRaFhvb", ability.organizationCode)
	}
	if ability.abilityCode != documentdomain.AIAbilityCodeKnowledgeBaseVisualUnderstanding {
		t.Fatalf("ability code = %q", ability.abilityCode)
	}
	if modelConfig.organizationCode != "TGosRaFhvb" {
		t.Fatalf("model organization_code = %q, want TGosRaFhvb", modelConfig.organizationCode)
	}
}

func TestConfigurableVisualTextExtractorResolvedURLPolicy(t *testing.T) {
	t.Parallel()

	modelExtractor := newModelModeExtractor(&fakeVisualOCR{text: "ocr"}, &fakeVisionClient{text: "model"}, &fakePDFRenderer{})
	if modelExtractor.NeedsResolvedURL(context.Background(), "png") {
		t.Fatal("expected configured model mode image recognition to skip resolved URL")
	}
	if !modelExtractor.BypassesNativePDFText(context.Background(), "pdf") {
		t.Fatal("expected configured model mode PDF recognition to bypass native PDF text")
	}

	ocrExtractor := vision.NewConfigurableVisualTextExtractor(
		&fakeAbilityProvider{config: documentdomain.AIAbilityConfig{Enabled: true, Config: map[string]any{"model_id": ""}}},
		&fakeModelConfigProvider{},
		vision.NewOCRVisualTextExtractor(&fakeVisualOCR{text: "ocr"}),
		vision.NewModelVisualTextExtractor(&fakeVisionClient{text: "model"}, &fakePDFRenderer{}, vision.Config{}, documentdomain.DefaultResourceLimits(), nil),
		nil,
	)
	if !ocrExtractor.NeedsResolvedURL(context.Background(), "png") {
		t.Fatal("expected OCR mode image recognition to require resolved URL")
	}
	if ocrExtractor.BypassesNativePDFText(context.Background(), "pdf") {
		t.Fatal("expected OCR mode PDF recognition to keep native PDF text path")
	}
}

func TestConfigurableVisualTextExtractorDoesNotFallbackAfterModelFailure(t *testing.T) {
	t.Parallel()

	ocr := &fakeVisualOCR{text: "ocr text"}
	client := &fakeVisionClient{err: errModelDown}
	extractor := newModelModeExtractor(ocr, client, &fakePDFRenderer{})

	_, err := extractor.RecognizeSource(context.Background(), "https://example.test/a.png", strings.NewReader("image"), "png")
	if err == nil {
		t.Fatal("expected model error")
	}
	if ocr.sourceCalls != 0 {
		t.Fatalf("expected OCR not called, got %d", ocr.sourceCalls)
	}
}

func TestModelVisualTextExtractorPDFKeepsPageOrder(t *testing.T) {
	t.Parallel()

	client := &fakeVisionClient{textByPage: map[int]string{1: "第一页文字", 2: "第二页文字"}}
	renderer := &fakePDFRenderer{pages: []vision.RenderedPDFPage{
		{Index: 0, PageCount: 2, Image: []byte("page-1"), MIMEType: testMIMEImageJPEG},
		{Index: 1, PageCount: 2, Image: []byte("page-2"), MIMEType: testMIMEImageJPEG},
	}}
	extractor := vision.NewModelVisualTextExtractor(client, renderer, vision.Config{}, documentdomain.DefaultResourceLimits(), nil)

	text, err := extractor.Recognize(context.Background(), testModelConfig(), []byte("pdf"), "pdf")
	if err != nil {
		t.Fatalf("Recognize returned error: %v", err)
	}
	want := "## Page 1\n第一页文字\n\n## Page 2\n第二页文字"
	if text != want {
		t.Fatalf("unexpected text:\nwant: %q\n got: %q", want, text)
	}
	if client.calls != 2 {
		t.Fatalf("expected two model calls, got %d", client.calls)
	}
	if client.lastInput.PDFPageCount != 2 {
		t.Fatalf("expected pdf page count forwarded, got %d", client.lastInput.PDFPageCount)
	}
}

func TestModelVisualTextExtractorRejectsOversizeImageBeforeModelCall(t *testing.T) {
	t.Parallel()

	client := &fakeVisionClient{text: "model text"}
	extractor := vision.NewModelVisualTextExtractor(
		client,
		&fakePDFRenderer{},
		vision.Config{MaxPageImageBytes: 4},
		documentdomain.DefaultResourceLimits(),
		nil,
	)

	_, err := extractor.Recognize(context.Background(), testModelConfig(), []byte("large"), "png")
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
	if client.calls != 0 {
		t.Fatalf("expected model not called, got %d", client.calls)
	}
}

func TestOpenAICompatibleVisionTextClientRejectsOversizePayloadBeforeRequest(t *testing.T) {
	t.Parallel()

	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		requests++
	}))
	defer server.Close()

	client := vision.NewOpenAICompatibleVisionTextClient(vision.Config{MaxModelRequestBytes: 16}, nil)
	_, err := client.RecognizeImage(context.Background(), vision.ImageInput{
		Config:     testModelConfigWithURL(server.URL),
		Image:      bytes.Repeat([]byte("x"), 64),
		MIMEType:   testMIMEImagePNG,
		FileType:   "png",
		RuntimeCfg: vision.Config{MaxModelRequestBytes: 16},
	})
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
	if requests != 0 {
		t.Fatalf("expected request not sent, got %d", requests)
	}
}

func TestOpenAICompatibleVisionTextClientAllowsVolcengineProvider(t *testing.T) {
	t.Parallel()

	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if r.URL.Path != "/api/v3/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"vision text"}}]}`))
	}))
	defer server.Close()

	config := testModelConfigWithURL(server.URL + "/api/v3")
	config.ProviderCode = "Volcengine"
	client := vision.NewOpenAICompatibleVisionTextClient(vision.Config{}, nil)
	text, err := client.RecognizeImage(context.Background(), vision.ImageInput{
		Config:     config,
		Image:      []byte("image"),
		MIMEType:   testMIMEImagePNG,
		FileType:   "png",
		RuntimeCfg: vision.Config{},
	})
	if err != nil {
		t.Fatalf("RecognizeImage returned error: %v", err)
	}
	if text != "vision text" {
		t.Fatalf("expected vision text, got %q", text)
	}
	if requests != 1 {
		t.Fatalf("expected one request, got %d", requests)
	}
}

func newModelModeExtractor(
	ocr *fakeVisualOCR,
	client vision.TextClient,
	renderer vision.PDFPageRenderer,
) *vision.ConfigurableVisualTextExtractor {
	return vision.NewConfigurableVisualTextExtractor(
		&fakeAbilityProvider{config: documentdomain.AIAbilityConfig{
			Enabled:          true,
			OrganizationCode: "ORG",
			Config:           map[string]any{"model_id": "qwen-vl"},
		}},
		&fakeModelConfigProvider{config: testModelConfig()},
		vision.NewOCRVisualTextExtractor(ocr),
		vision.NewModelVisualTextExtractor(client, renderer, vision.Config{}, documentdomain.DefaultResourceLimits(), nil),
		nil,
	)
}

func testModelConfig() documentdomain.ModelCallConfig {
	return testModelConfigWithURL("https://example.test/v1")
}

func testModelConfigWithURL(url string) documentdomain.ModelCallConfig {
	return documentdomain.ModelCallConfig{
		ModelID:        "qwen-vl",
		Model:          "qwen-vl",
		ProviderCode:   "qwen",
		RequestBaseURL: url,
		AccessToken:    "sk-test",
	}
}

type fakeAbilityProvider struct {
	config           documentdomain.AIAbilityConfig
	err              error
	organizationCode string
	abilityCode      string
}

func (f *fakeAbilityProvider) GetVisualAbilityConfig(
	_ context.Context,
	organizationCode string,
	abilityCode string,
) (documentdomain.AIAbilityConfig, error) {
	f.organizationCode = organizationCode
	f.abilityCode = abilityCode
	if f.err != nil {
		return documentdomain.AIAbilityConfig{}, f.err
	}
	return f.config, nil
}

type fakeModelConfigProvider struct {
	config           documentdomain.ModelCallConfig
	err              error
	organizationCode string
	modelID          string
	modelType        string
}

func (f *fakeModelConfigProvider) GetVisualModelCallConfig(
	_ context.Context,
	organizationCode string,
	modelID string,
	modelType string,
) (documentdomain.ModelCallConfig, error) {
	f.organizationCode = organizationCode
	f.modelID = modelID
	f.modelType = modelType
	if f.err != nil {
		return documentdomain.ModelCallConfig{}, f.err
	}
	return f.config, nil
}

type fakeVisualOCR struct {
	text        string
	sourceCalls int
	bytesCalls  int
}

func (f *fakeVisualOCR) OCR(context.Context, string, string) (string, error) {
	f.sourceCalls++
	return f.text, nil
}

func (f *fakeVisualOCR) OCRSource(context.Context, string, io.Reader, string) (string, error) {
	f.sourceCalls++
	return f.text, nil
}

func (f *fakeVisualOCR) OCRBytes(context.Context, []byte, string) (string, error) {
	f.bytesCalls++
	return f.text, nil
}

type fakeVisionClient struct {
	text       string
	textByPage map[int]string
	err        error
	calls      int
	lastInput  vision.ImageInput
}

func (f *fakeVisionClient) RecognizeImage(_ context.Context, input vision.ImageInput) (string, error) {
	f.calls++
	f.lastInput = input
	if f.err != nil {
		return "", f.err
	}
	if f.textByPage != nil {
		return f.textByPage[input.PageIndex], nil
	}
	return f.text, nil
}

type fakePDFRenderer struct {
	pages []vision.RenderedPDFPage
	err   error
}

func (f *fakePDFRenderer) RenderPages(
	_ context.Context,
	_ []byte,
	_ vision.Config,
	_ documentdomain.ResourceLimits,
	handle func(vision.RenderedPDFPage) error,
) error {
	if f.err != nil {
		return f.err
	}
	for _, page := range f.pages {
		if err := handle(page); err != nil {
			return err
		}
	}
	return nil
}
