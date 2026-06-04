package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	kbaccess "magic/internal/domain/knowledge/access/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/webauth"
)

var (
	// ErrKnowledgeSourceFileUnauthorized 表示 Web 登录态无效。
	ErrKnowledgeSourceFileUnauthorized = errors.New("knowledge source file unauthorized")
	// ErrKnowledgeSourceFileAuthUnavailable 表示 WebAuth IPC 当前不可用。
	ErrKnowledgeSourceFileAuthUnavailable = errors.New("knowledge source file auth unavailable")
	// ErrKnowledgeSourceFileKeyMismatch 表示请求里的 file_key 与文档源文件 key 不一致。
	ErrKnowledgeSourceFileKeyMismatch = errors.New("knowledge source file key mismatch")
	// ErrKnowledgeSourceFileUnavailable 表示文档没有可打开的源文件链接。
	ErrKnowledgeSourceFileUnavailable = errors.New("knowledge source file unavailable")
)

// SourceFileWebAuthenticator 定义知识库源文件链接接口需要的 Web 登录态鉴权端口。
type SourceFileWebAuthenticator interface {
	Authenticate(ctx context.Context, request webauth.Request) (webauth.User, error)
}

// SourceFileDocumentReader 定义知识库源文件链接需要的文档读取能力。
type SourceFileDocumentReader interface {
	ShowByCodeAndKnowledgeBase(ctx context.Context, code, knowledgeBaseCode string) (*docentity.KnowledgeBaseDocument, error)
}

// SourceFileKnowledgeBaseReader 定义知识库源文件链接需要的知识库读取能力。
type SourceFileKnowledgeBaseReader interface {
	ShowByCodeAndOrg(ctx context.Context, code, orgCode string) (*kbentity.KnowledgeBase, error)
	List(ctx context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error)
}

// SourceFileObjectLinkProvider 定义对象存储源文件临时链接生成能力。
type SourceFileObjectLinkProvider interface {
	GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error)
}

// SourceFileThirdPlatformDocumentResolver 定义第三方文档源文件解析能力。
type SourceFileThirdPlatformDocumentResolver interface {
	Resolve(ctx context.Context, input thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error)
}

// SourceFileThirdPlatformAccess 定义第三方知识库访问权限读取能力。
type SourceFileThirdPlatformAccess interface {
	ListKnowledgeBases(ctx context.Context, input thirdplatform.KnowledgeBaseListInput) ([]thirdplatform.KnowledgeBaseItem, error)
}

// KnowledgeSourceFileLinkDeps 聚合知识库源文件链接应用服务需要的领域与端口依赖。
type KnowledgeSourceFileLinkDeps struct {
	DocumentReader            SourceFileDocumentReader
	KnowledgeBaseReader       SourceFileKnowledgeBaseReader
	PermissionReader          kbaccess.PermissionReader
	ThirdPlatformAccess       SourceFileThirdPlatformAccess
	FileLinkProvider          SourceFileObjectLinkProvider
	ProjectFileContentPort    documentdomain.ProjectFileContentAccessor
	ThirdPlatformDocumentPort SourceFileThirdPlatformDocumentResolver
	ThirdPlatformProviders    *thirdplatformprovider.Registry
}

// KnowledgeSourceFileLinkRequest 表示前端或沙箱请求知识库源文件链接的应用层入参。
type KnowledgeSourceFileLinkRequest struct {
	Authorization     string
	OrganizationCode  string
	KnowledgeBaseCode string
	DocumentCode      string
	FileKey           string
}

// KnowledgeSourceFileLinkService 编排 WebAuth 鉴权与知识库源文件链接校验。
type KnowledgeSourceFileLinkService struct {
	authenticator SourceFileWebAuthenticator
	resolver      documentOriginalFileLinkResolver
}

// NewKnowledgeSourceFileLinkService 创建知识库源文件链接应用服务。
func NewKnowledgeSourceFileLinkService(
	authenticator SourceFileWebAuthenticator,
	deps KnowledgeSourceFileLinkDeps,
) *KnowledgeSourceFileLinkService {
	return &KnowledgeSourceFileLinkService{
		authenticator: authenticator,
		resolver: documentOriginalFileLinkResolver{
			documentReader:            deps.DocumentReader,
			knowledgeBaseReader:       deps.KnowledgeBaseReader,
			permissionReader:          deps.PermissionReader,
			thirdPlatformAccess:       deps.ThirdPlatformAccess,
			fileLinkProvider:          deps.FileLinkProvider,
			projectFileContentPort:    deps.ProjectFileContentPort,
			thirdPlatformDocumentPort: deps.ThirdPlatformDocumentPort,
			thirdPlatformProviders:    deps.ThirdPlatformProviders,
		},
	}
}

// GetLink 获取通过权限与 file_key 校验后的知识库源文件链接。
func (s *KnowledgeSourceFileLinkService) GetLink(
	ctx context.Context,
	request KnowledgeSourceFileLinkRequest,
) (*docdto.OriginalFileLinkDTO, error) {
	if s == nil || s.authenticator == nil || !s.resolver.ready() {
		return nil, ErrKnowledgeSourceFileAuthUnavailable
	}

	authorization := strings.TrimSpace(request.Authorization)
	if authorization == "" {
		return nil, ErrKnowledgeSourceFileUnauthorized
	}

	organizationCode := strings.TrimSpace(request.OrganizationCode)
	user, err := s.authenticator.Authenticate(ctx, webauth.Request{
		Authorization:    authorization,
		OrganizationCode: organizationCode,
	})
	if err != nil {
		if errors.Is(err, webauth.ErrUnauthorized) {
			return nil, fmt.Errorf("%w: %w", ErrKnowledgeSourceFileUnauthorized, err)
		}
		return nil, fmt.Errorf("%w: %w", ErrKnowledgeSourceFileAuthUnavailable, err)
	}

	if organizationCode == "" {
		organizationCode = strings.TrimSpace(user.OrganizationCode)
	}
	userID := strings.TrimSpace(user.UserID)
	if organizationCode == "" || userID == "" {
		return nil, ErrKnowledgeSourceFileUnauthorized
	}

	return s.resolver.GetKnowledgeSourceFileLink(
		ctx,
		strings.TrimSpace(request.DocumentCode),
		strings.TrimSpace(request.KnowledgeBaseCode),
		organizationCode,
		userID,
		strings.TrimSpace(request.FileKey),
	)
}
