package handlers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	magicfsapp "magic/internal/application/magicfs/service"
	"magic/internal/interfaces/http/handlers"
)

const handlerMagicFSFileID = "42"

func TestMagicFSFileHandlerGetVersion(t *testing.T) {
	t.Parallel()

	handler := newMagicFSFileHandler(&handlerMagicFSRepository{version: 12}, &handlerMagicFSAuthorizer{})
	recorder := performMagicFSVersionRequest(handler)

	var response struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			Version int64 `json:"version"`
		} `json:"data"`
	}
	decodeResponse(t, recorder, &response)
	if recorder.Code != http.StatusOK || response.Code != 1000 || response.Message != "ok" || response.Data.Version != 12 {
		t.Fatalf("unexpected response: status=%d body=%+v", recorder.Code, response)
	}
}

func TestMagicFSFileHandlerGetVersionBusinessError(t *testing.T) {
	t.Parallel()

	handler := newMagicFSFileHandler(
		&handlerMagicFSRepository{},
		&handlerMagicFSAuthorizer{err: &magicfsapp.BusinessError{Code: 2154, Message: "user.account_error"}},
	)
	recorder := performMagicFSVersionRequest(handler)

	var response handlers.APIResponse
	decodeResponse(t, recorder, &response)
	if recorder.Code != http.StatusOK || response.Code != 2154 || response.Message != "user.account_error" {
		t.Fatalf("unexpected response: status=%d body=%+v", recorder.Code, response)
	}
}

func TestMagicFSFileHandlerGetVersionNotFound(t *testing.T) {
	t.Parallel()

	handler := newMagicFSFileHandler(&handlerMagicFSRepository{err: magicfsapp.ErrFileNotFound}, &handlerMagicFSAuthorizer{})
	recorder := performMagicFSVersionRequest(handler)

	var response handlers.APIResponse
	decodeResponse(t, recorder, &response)
	if recorder.Code != http.StatusOK ||
		response.Code != magicfsapp.FileNotFoundCode ||
		response.Message != magicfsapp.FileNotFoundMessage {
		t.Fatalf("unexpected response: status=%d body=%+v", recorder.Code, response)
	}
}

func TestMagicFSFileHandlerGetVersionNoIPCClient(t *testing.T) {
	t.Parallel()

	handler := newMagicFSFileHandler(
		&handlerMagicFSRepository{},
		&handlerMagicFSAuthorizer{err: magicfsapp.ErrAuthorizationUnavailable},
	)
	recorder := performMagicFSVersionRequest(handler)

	var response handlers.APIResponse
	decodeResponse(t, recorder, &response)
	if recorder.Code != http.StatusInternalServerError ||
		response.Code != magicfsapp.SystemErrorCode ||
		response.Message != magicfsapp.SystemErrorMessage {
		t.Fatalf("unexpected response: status=%d body=%+v", recorder.Code, response)
	}
}

func newMagicFSFileHandler(
	repository magicfsapp.FileVersionRepository,
	authorizer magicfsapp.FileAccessAuthorizer,
) *handlers.MagicFSFileHandler {
	return handlers.NewMagicFSFileHandler(magicfsapp.NewFileVersionService(repository, authorizer))
}

func performMagicFSVersionRequest(handler *handlers.MagicFSFileHandler) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.GET("/api/v1/open-api/magicfs/files/:id/version", handler.GetVersion)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		"/api/v1/open-api/magicfs/files/"+handlerMagicFSFileID+"/version",
		nil,
	)
	request.Header.Set("Authorization", "Bearer token")
	engine.ServeHTTP(recorder, request)
	return recorder
}

func decodeResponse(t *testing.T, recorder *httptest.ResponseRecorder, out any) {
	t.Helper()

	if err := json.Unmarshal(recorder.Body.Bytes(), out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

type handlerMagicFSRepository struct {
	version int64
	err     error
}

func (s *handlerMagicFSRepository) GetMetadataVersion(ctx context.Context, fileID int64) (int64, error) {
	return s.version, s.err
}

type handlerMagicFSAuthorizer struct {
	err error
}

func (s *handlerMagicFSAuthorizer) AuthorizeFileViewer(
	ctx context.Context,
	headers map[string][]string,
	fileID string,
) error {
	return s.err
}
