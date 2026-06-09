package handlers

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	docdto "magic/internal/application/knowledge/document/dto"
	docapp "magic/internal/application/knowledge/document/service"
)

// KnowledgeSourceFileService 定义 HTTP 层需要的知识库源文件链接应用服务能力。
type KnowledgeSourceFileService interface {
	GetLink(context.Context, docapp.KnowledgeSourceFileLinkRequest) (*docdto.OriginalFileLinkDTO, error)
}

// KnowledgeSourceFileHandler 处理知识库源文件链接 HTTP 请求。
type KnowledgeSourceFileHandler struct {
	service KnowledgeSourceFileService
}

// NewKnowledgeSourceFileHandler 创建知识库源文件链接 Handler。
func NewKnowledgeSourceFileHandler(service KnowledgeSourceFileService) *KnowledgeSourceFileHandler {
	return &KnowledgeSourceFileHandler{service: service}
}

type knowledgeSourceFileLinkRequest struct {
	FileKey string `json:"file_key"`
}

type knowledgeSourceFileLinkResponse struct {
	Available  bool   `json:"available"`
	URL        string `json:"url"`
	Name       string `json:"name"`
	FileKey    string `json:"file_key"`
	Type       string `json:"type"`
	SourceType string `json:"source_type,omitempty"`
	LinkType   string `json:"link_type,omitempty"`
}

// SourceFileLink 处理 POST /api/v1/knowledge-bases/:knowledgeBaseCode/documents/:documentCode/source-file-link。
func (h *KnowledgeSourceFileHandler) SourceFileLink(c *gin.Context) {
	if h == nil || h.service == nil {
		writeError(c, http.StatusServiceUnavailable, "knowledge source file service unavailable")
		return
	}

	var body knowledgeSourceFileLinkRequest
	if err := c.ShouldBindJSON(&body); err != nil && !errors.Is(err, io.EOF) {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	result, err := h.service.GetLink(c.Request.Context(), docapp.KnowledgeSourceFileLinkRequest{
		Authorization:     readKnowledgeSourceFileAuth(c),
		OrganizationCode:  readOrganizationCode(c),
		KnowledgeBaseCode: c.Param("knowledgeBaseCode"),
		DocumentCode:      c.Param("documentCode"),
		FileKey:           body.FileKey,
	})
	if err != nil {
		writeError(c, statusFromKnowledgeSourceFileError(err), messageFromKnowledgeSourceFileError(err))
		return
	}

	response := knowledgeSourceFileLinkResponse{
		Available:  result.Available,
		URL:        result.URL,
		Name:       result.Name,
		FileKey:    result.Key,
		Type:       result.Type,
		SourceType: result.SourceType,
		LinkType:   result.LinkType,
	}
	writeSuccess(c, response)
}

func readKnowledgeSourceFileAuth(c *gin.Context) string {
	for _, key := range []string{"Authorization", "User-Authorization", "user-authorization"} {
		value := strings.TrimSpace(c.GetHeader(key))
		if value == "" {
			continue
		}
		return strings.TrimPrefix(value, "Bearer ")
	}
	return ""
}

func statusFromKnowledgeSourceFileError(err error) int {
	switch {
	case errors.Is(err, docapp.ErrKnowledgeSourceFileUnauthorized):
		return http.StatusUnauthorized
	case errors.Is(err, docapp.ErrKnowledgeSourceFileAuthUnavailable):
		return http.StatusServiceUnavailable
	case errors.Is(err, docapp.ErrKnowledgeSourceFileKeyMismatch):
		return http.StatusForbidden
	case errors.Is(err, docapp.ErrDocumentPermissionDenied):
		return http.StatusForbidden
	case errors.Is(err, docapp.ErrDocumentOrgMismatch):
		return http.StatusNotFound
	case errors.Is(err, docapp.ErrKnowledgeSourceFileUnavailable):
		return http.StatusNotFound
	default:
		return http.StatusInternalServerError
	}
}

func messageFromKnowledgeSourceFileError(err error) string {
	switch {
	case errors.Is(err, docapp.ErrKnowledgeSourceFileUnauthorized):
		return "unauthorized"
	case errors.Is(err, docapp.ErrKnowledgeSourceFileAuthUnavailable):
		return "web auth unavailable"
	case errors.Is(err, docapp.ErrKnowledgeSourceFileKeyMismatch):
		return "knowledge source file key mismatch"
	case errors.Is(err, docapp.ErrDocumentPermissionDenied):
		return "knowledge base permission denied"
	case errors.Is(err, docapp.ErrDocumentOrgMismatch):
		return "knowledge document not found"
	case errors.Is(err, docapp.ErrKnowledgeSourceFileUnavailable):
		return "knowledge source file unavailable"
	default:
		return "internal server error"
	}
}
