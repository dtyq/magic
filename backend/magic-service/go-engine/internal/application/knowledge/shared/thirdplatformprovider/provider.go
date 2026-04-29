// Package thirdplatformprovider 提供知识库第三方平台的共享应用层 provider 适配实现。
package thirdplatformprovider

import (
	"context"
	"fmt"
	"maps"
	"path/filepath"
	"strings"
	"time"

	texthelper "magic/internal/application/knowledge/helper/text"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

const (
	teamsharePlatformType      = "teamshare"
	thirdPlatformDocumentType  = "third_platform"
	thirdPlatformResolveSource = "third_platform_resolve"
)

type documentResolver interface {
	Resolve(ctx context.Context, input thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error)
}

// BuildInitialDocumentInput 描述首次建立第三方文档映射所需输入。
type BuildInitialDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	ThirdFileID       string
	Metadata          map[string]any
}

// InitialDocumentSpec 描述首次建映射时的文档基础信息。
type InitialDocumentSpec struct {
	Name         string
	DocType      int
	DocumentFile *docentity.File
}

// ResolveLatestContentInput 描述按第三方文件拉取最新内容所需输入。
type ResolveLatestContentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	ThirdFileID       string
	Document          *docentity.KnowledgeBaseDocument
}

// LatestContentResult 描述第三方文档的最新内容。
type LatestContentResult struct {
	Content            string
	DocType            int
	DocumentFile       map[string]any
	Source             string
	ContentHash        string
	FetchedAtUnixMilli int64
}

// ThirdPlatformProvider 定义第三方平台扩展能力。
type ThirdPlatformProvider interface {
	PlatformType() string
	BuildInitialDocument(ctx context.Context, input BuildInitialDocumentInput) (*InitialDocumentSpec, error)
	ResolveLatestContent(ctx context.Context, input ResolveLatestContentInput) (*LatestContentResult, error)
}

// Registry 保存第三方平台 provider。
type Registry struct {
	providers map[string]ThirdPlatformProvider
}

// NewRegistry 创建 provider registry。
func NewRegistry(providers ...ThirdPlatformProvider) *Registry {
	registry := &Registry{providers: make(map[string]ThirdPlatformProvider, len(providers))}
	for _, item := range providers {
		if item == nil {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(item.PlatformType()))
		if key == "" {
			continue
		}
		registry.providers[key] = item
	}
	return registry
}

// Provider 根据平台类型返回 provider。
func (r *Registry) Provider(platformType string) (ThirdPlatformProvider, error) {
	if r == nil {
		return nil, shared.ErrUnsupportedThirdPlatformType
	}
	key := strings.ToLower(strings.TrimSpace(platformType))
	if key == "" {
		return nil, shared.ErrUnsupportedThirdPlatformType
	}
	provider, ok := r.providers[key]
	if !ok || provider == nil {
		return nil, shared.ErrUnsupportedThirdPlatformType
	}
	return provider, nil
}

// TeamshareProvider 提供 Teamshare 第三方文档能力。
type TeamshareProvider struct {
	resolver documentResolver
	logger   *logging.SugaredLogger
}

// NewTeamshareProvider 创建 Teamshare provider。
func NewTeamshareProvider(resolver documentResolver, logger *logging.SugaredLogger) *TeamshareProvider {
	return &TeamshareProvider{resolver: resolver, logger: logger}
}

// PlatformType 返回平台类型。
func (p *TeamshareProvider) PlatformType() string {
	return teamsharePlatformType
}

// BuildInitialDocument 构造首次落库所需的文档基础信息。
func (p *TeamshareProvider) BuildInitialDocument(ctx context.Context, input BuildInitialDocumentInput) (*InitialDocumentSpec, error) {
	thirdFileID := strings.TrimSpace(input.ThirdFileID)
	if thirdFileID == "" {
		return nil, shared.ErrFragmentDocumentCodeRequired
	}

	documentName := resolveDocumentName(input.Metadata, thirdFileID)
	file := buildDocumentFile(documentName, thirdFileID)
	// 首次建映射时如果还没拿到远端 resolve 结果，先按文件名推导一个主表精确 doc_type；
	// 后续 resolved.DocType 仍可能覆盖成 enterprise 扩展值 1001/1002。
	spec := &InitialDocumentSpec{
		Name:         documentName,
		DocType:      inferInitialDocType(documentName),
		DocumentFile: file,
	}

	if p == nil || p.resolver == nil {
		return spec, nil
	}

	doc := &docentity.KnowledgeBaseDocument{
		OrganizationCode:  input.OrganizationCode,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		Name:              documentName,
		DocType:           spec.DocType,
		ThirdPlatformType: teamsharePlatformType,
		ThirdFileID:       thirdFileID,
		DocumentFile:      cloneDocumentFile(file),
	}
	resolved, err := p.resolver.Resolve(ctx, thirdplatform.DocumentResolveInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		ThirdPlatformType: teamsharePlatformType,
		ThirdFileID:       thirdFileID,
		DocumentFile:      documentdomain.BuildDocumentFilePayload(doc),
	})
	if err != nil {
		if p.logger != nil {
			p.logger.KnowledgeWarnContext(
				ctx,
				"Resolve teamshare document for initial mapping failed",
				"knowledge_base_code", input.KnowledgeBaseCode,
				"third_file_id", thirdFileID,
				"error", err,
			)
		}
		return spec, nil
	}

	documentdomain.ApplyResolvedDocumentResult(doc, resolved.DocType, resolved.DocumentFile)
	if strings.TrimSpace(doc.Name) != "" {
		spec.Name = doc.Name
	}
	spec.DocType = doc.DocType
	spec.DocumentFile = cloneDocumentFile(doc.DocumentFile)
	return spec, nil
}

// ResolveLatestContent 拉取 Teamshare 最新内容。
func (p *TeamshareProvider) ResolveLatestContent(ctx context.Context, input ResolveLatestContentInput) (*LatestContentResult, error) {
	if p == nil || p.resolver == nil {
		return nil, shared.ErrUnsupportedThirdPlatformType
	}

	document := input.Document
	if document == nil {
		document = &docentity.KnowledgeBaseDocument{
			OrganizationCode:  input.OrganizationCode,
			KnowledgeBaseCode: input.KnowledgeBaseCode,
			ThirdPlatformType: teamsharePlatformType,
			ThirdFileID:       input.ThirdFileID,
			DocumentFile:      buildDocumentFile(strings.TrimSpace(input.ThirdFileID), strings.TrimSpace(input.ThirdFileID)),
		}
	}

	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		userID = document.UpdatedUID
	}
	resolved, err := p.resolver.Resolve(ctx, thirdplatform.DocumentResolveInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            userID,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		ThirdPlatformType: teamsharePlatformType,
		ThirdFileID:       input.ThirdFileID,
		DocumentFile:      documentdomain.BuildDocumentFilePayload(document),
	})
	if err != nil {
		return nil, fmt.Errorf("resolve teamshare document: %w", err)
	}

	content := texthelper.NormalizeContent(resolved.Content)
	if content == "" {
		return nil, shared.ErrDocumentFileEmpty
	}

	return &LatestContentResult{
		Content:            content,
		DocType:            resolved.DocType,
		DocumentFile:       cloneDocumentFilePayload(resolved.DocumentFile),
		Source:             thirdPlatformResolveSource,
		ContentHash:        texthelper.HashText(content),
		FetchedAtUnixMilli: time.Now().UnixMilli(),
	}, nil
}

func resolveDocumentName(metadata map[string]any, thirdFileID string) string {
	if title := parseMarkdownLinkTitle(texthelper.StringValue(metadata["url"])); title != "" {
		return title
	}
	return strings.TrimSpace(thirdFileID)
}

func parseMarkdownLinkTitle(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || !strings.HasPrefix(trimmed, "[") {
		return ""
	}
	end := strings.Index(trimmed, "](")
	if end <= 1 {
		return ""
	}
	return strings.TrimSpace(trimmed[1:end])
}

func inferInitialDocType(name string) int {
	if extension := inferExtension(name); extension != "" {
		return projectfile.ResolveDocType(extension)
	}
	return int(docentity.DocTypeText)
}

func inferExtension(name string) string {
	return strings.TrimSpace(strings.ToLower(strings.TrimPrefix(filepath.Ext(strings.TrimSpace(name)), ".")))
}

func buildDocumentFile(name, thirdFileID string) *docentity.File {
	file := &docentity.File{
		Type:       thirdPlatformDocumentType,
		Name:       name,
		ThirdID:    thirdFileID,
		SourceType: teamsharePlatformType,
	}
	if ext := inferExtension(name); ext != "" {
		file.Extension = ext
	}
	return file
}

func cloneDocumentFile(file *docentity.File) *docentity.File {
	if file == nil {
		return nil
	}
	cloned := *file
	return &cloned
}

func cloneDocumentFilePayload(src map[string]any) map[string]any {
	if len(src) == 0 {
		return nil
	}
	dst := make(map[string]any, len(src))
	maps.Copy(dst, src)
	return dst
}
