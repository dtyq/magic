package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	docdto "magic/internal/application/knowledge/document/dto"
	docapp "magic/internal/application/knowledge/document/service"
	"magic/internal/interfaces/http/handlers"
)

var errKnowledgeSourceFileHandlerBoom = errors.New("knowledge source file handler boom")

type knowledgeSourceFileServiceStub struct {
	result  *docdto.OriginalFileLinkDTO
	err     error
	request docapp.KnowledgeSourceFileLinkRequest
}

func (s *knowledgeSourceFileServiceStub) GetLink(
	_ context.Context,
	request docapp.KnowledgeSourceFileLinkRequest,
) (*docdto.OriginalFileLinkDTO, error) {
	s.request = request
	if s.err != nil {
		return nil, s.err
	}
	return s.result, nil
}

func TestKnowledgeSourceFileHandlerSuccess(t *testing.T) {
	t.Parallel()

	service := &knowledgeSourceFileServiceStub{
		result: &docdto.OriginalFileLinkDTO{
			Available:  true,
			URL:        "https://download.test/doc.md",
			Name:       "doc.md",
			Key:        "ORG1/files/doc.md",
			Type:       "external",
			SourceType: "oss",
			LinkType:   "download",
		},
	}
	recorder := performKnowledgeSourceFileRequest(
		t,
		service,
		`{"file_key":"ORG1/files/doc.md"}`,
		func(request *http.Request) {
			request.Header.Set("authorization", "Bearer token-1")
			request.Header.Set("organization-code", "ORG1")
		},
	)

	assertHTTPStatus(t, recorder, http.StatusOK)
	body := decodeKnowledgeSourceFileResponse(t, recorder)
	if body.Code != 1000 || body.Message != "ok" {
		t.Fatalf("unexpected response envelope: %#v", body)
	}
	data := body.Data
	if data["available"] != true ||
		data["url"] != "https://download.test/doc.md" ||
		data["name"] != "doc.md" ||
		data["file_key"] != "ORG1/files/doc.md" ||
		data["type"] != "external" ||
		data["source_type"] != "oss" ||
		data["link_type"] != "download" {
		t.Fatalf("unexpected response data: %#v", data)
	}
	if service.request.Authorization != "token-1" ||
		service.request.OrganizationCode != "ORG1" ||
		service.request.KnowledgeBaseCode != "KB1" ||
		service.request.DocumentCode != "DOC1" ||
		service.request.FileKey != "ORG1/files/doc.md" {
		t.Fatalf("unexpected service request: %#v", service.request)
	}
}

func TestKnowledgeSourceFileHandlerAllowsEmptyBody(t *testing.T) {
	t.Parallel()

	service := &knowledgeSourceFileServiceStub{
		result: &docdto.OriginalFileLinkDTO{
			Available:  true,
			URL:        "https://docs.example/main/doc",
			Name:       "external doc",
			Type:       "third_platform",
			SourceType: "external_docs",
			LinkType:   "web",
		},
	}
	recorder := performKnowledgeSourceFileRequest(t, service, "", func(request *http.Request) {
		request.Header.Set("user-authorization", "token-1")
	})

	assertHTTPStatus(t, recorder, http.StatusOK)
	if service.request.FileKey != "" {
		t.Fatalf("expected empty file_key, got %#v", service.request)
	}
	body := decodeKnowledgeSourceFileResponse(t, recorder)
	if body.Data["link_type"] != "web" || body.Data["source_type"] != "external_docs" {
		t.Fatalf("unexpected response data: %#v", body.Data)
	}
}

func TestKnowledgeSourceFileHandlerErrorMapping(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		err     error
		status  int
		message string
	}{
		{
			name:    "unauthorized",
			err:     docapp.ErrKnowledgeSourceFileUnauthorized,
			status:  http.StatusUnauthorized,
			message: "unauthorized",
		},
		{
			name:    "web auth unavailable",
			err:     docapp.ErrKnowledgeSourceFileAuthUnavailable,
			status:  http.StatusServiceUnavailable,
			message: "web auth unavailable",
		},
		{
			name:    "file key mismatch",
			err:     docapp.ErrKnowledgeSourceFileKeyMismatch,
			status:  http.StatusForbidden,
			message: "knowledge source file key mismatch",
		},
		{
			name:    "permission denied",
			err:     docapp.ErrDocumentPermissionDenied,
			status:  http.StatusForbidden,
			message: "knowledge base permission denied",
		},
		{
			name:    "document not found",
			err:     docapp.ErrDocumentOrgMismatch,
			status:  http.StatusNotFound,
			message: "knowledge document not found",
		},
		{
			name:    "unavailable",
			err:     docapp.ErrKnowledgeSourceFileUnavailable,
			status:  http.StatusNotFound,
			message: "knowledge source file unavailable",
		},
		{
			name:    "internal",
			err:     errKnowledgeSourceFileHandlerBoom,
			status:  http.StatusInternalServerError,
			message: "internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			recorder := performKnowledgeSourceFileRequest(
				t,
				&knowledgeSourceFileServiceStub{err: tt.err},
				`{"file_key":"ORG1/files/doc.md"}`,
				func(request *http.Request) {
					request.Header.Set("authorization", "Bearer token-1")
				},
			)

			assertHTTPStatus(t, recorder, tt.status)
			body := decodeKnowledgeSourceFileResponse(t, recorder)
			if body.Code != tt.status || body.Message != tt.message || body.Data != nil {
				t.Fatalf("unexpected error response: %#v", body)
			}
		})
	}
}

func TestKnowledgeSourceFileHandlerRejectsInvalidBody(t *testing.T) {
	t.Parallel()

	recorder := performKnowledgeSourceFileRequest(
		t,
		&knowledgeSourceFileServiceStub{},
		`{"file_key":`,
		func(request *http.Request) {
			request.Header.Set("authorization", "Bearer token-1")
		},
	)

	assertHTTPStatus(t, recorder, http.StatusBadRequest)
	body := decodeKnowledgeSourceFileResponse(t, recorder)
	if body.Message != "invalid request body" {
		t.Fatalf("unexpected response: %#v", body)
	}
}

type knowledgeSourceFileResponse struct {
	Code    int            `json:"code"`
	Message string         `json:"message"`
	Data    map[string]any `json:"data"`
}

func performKnowledgeSourceFileRequest(
	t *testing.T,
	service *knowledgeSourceFileServiceStub,
	body string,
	mutate func(*http.Request),
) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	handler := handlers.NewKnowledgeSourceFileHandler(service)
	engine := gin.New()
	engine.POST("/api/v1/knowledge-bases/:knowledgeBaseCode/documents/:documentCode/source-file-link", handler.SourceFileLink)

	request := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		"/api/v1/knowledge-bases/KB1/documents/DOC1/source-file-link",
		bytes.NewBufferString(body),
	)
	request.Header.Set("Content-Type", "application/json")
	if mutate != nil {
		mutate(request)
	}
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	return recorder
}

func decodeKnowledgeSourceFileResponse(
	t *testing.T,
	recorder *httptest.ResponseRecorder,
) knowledgeSourceFileResponse {
	t.Helper()

	var body knowledgeSourceFileResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, recorder.Body.String())
	}
	return body
}

func assertHTTPStatus(t *testing.T, recorder *httptest.ResponseRecorder, expected int) {
	t.Helper()
	if recorder.Code != expected {
		t.Fatalf("status = %d, want %d; body=%s", recorder.Code, expected, recorder.Body.String())
	}
}
