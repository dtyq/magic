package document

import (
	"maps"
	"strings"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/ctxmeta"
)

// ThirdFileRevectorizeSeed 描述第三方文件重向量化前置规划结果。
type ThirdFileRevectorizeSeed struct {
	SourceCacheKey string
	SeedDocument   *docentity.KnowledgeBaseDocument
}

// SourceSnapshotInput 描述构造稳定源快照所需输入。
type SourceSnapshotInput struct {
	Content            string
	DocType            int
	DocumentFile       map[string]any
	ParsedDocument     *parseddocument.ParsedDocument
	Source             string
	ContentHash        string
	FetchedAtUnixMilli int64
	Now                time.Time
}

// NormalizeThirdFileRevectorizeInput 规整第三方文件重向量化输入。
func NormalizeThirdFileRevectorizeInput(input *ThirdFileRevectorizeInput) *ThirdFileRevectorizeInput {
	if input == nil {
		return nil
	}
	return &ThirdFileRevectorizeInput{
		OrganizationCode:              strings.TrimSpace(input.OrganizationCode),
		UserID:                        strings.TrimSpace(input.UserID),
		ThirdPlatformUserID:           strings.TrimSpace(input.ThirdPlatformUserID),
		ThirdPlatformOrganizationCode: strings.TrimSpace(input.ThirdPlatformOrganizationCode),
		ThirdPlatformType:             strings.ToLower(strings.TrimSpace(input.ThirdPlatformType)),
		ThirdFileID:                   strings.TrimSpace(input.ThirdFileID),
		ThirdKnowledgeID:              strings.TrimSpace(input.ThirdKnowledgeID),
	}
}

// FirstUsableDocument 选择可用于代表第三方文件的文档。
func FirstUsableDocument(docs []*docentity.KnowledgeBaseDocument) *docentity.KnowledgeBaseDocument {
	for _, doc := range docs {
		if doc == nil || strings.TrimSpace(doc.KnowledgeBaseCode) == "" || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		return doc
	}
	return nil
}

// BuildThirdFileRevectorizeSeed 生成第三方文件重向量化的稳定 seed。
func BuildThirdFileRevectorizeSeed(
	input *ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
) (*ThirdFileRevectorizeSeed, error) {
	if input == nil {
		return nil, shared.ErrDocumentNotFound
	}
	seedDoc := FirstUsableDocument(docs)
	if seedDoc == nil {
		return nil, shared.ErrDocumentNotFound
	}
	return &ThirdFileRevectorizeSeed{
		SourceCacheKey: buildThirdFileSourceCacheKey(input.OrganizationCode, input.ThirdPlatformType, input.ThirdFileID),
		SeedDocument:   seedDoc,
	}, nil
}

// ResolveMappedDocumentUserID 解析用于调度同步和第三方文件读取的 Magic 用户 ID。
func ResolveMappedDocumentUserID(doc *docentity.KnowledgeBaseDocument) string {
	if doc == nil {
		return ""
	}
	if userID := strings.TrimSpace(doc.UpdatedUID); userID != "" {
		return userID
	}
	if userID := strings.TrimSpace(doc.CreatedUID); userID != "" {
		return userID
	}
	return ""
}

// BuildThirdFileSyncRequests 根据第三方源快照构造所有文档同步请求。
func BuildThirdFileSyncRequests(
	input *ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
	seedDoc *docentity.KnowledgeBaseDocument,
	snapshot *ResolvedSourceSnapshot,
) []*SyncDocumentInput {
	if input == nil || snapshot == nil {
		return nil
	}

	requests := make([]*SyncDocumentInput, 0, len(docs))
	for _, mappedDoc := range docs {
		if mappedDoc == nil || strings.TrimSpace(mappedDoc.KnowledgeBaseCode) == "" || strings.TrimSpace(mappedDoc.Code) == "" {
			continue
		}
		requests = append(requests, &SyncDocumentInput{
			OrganizationCode:  strings.TrimSpace(input.OrganizationCode),
			KnowledgeBaseCode: strings.TrimSpace(mappedDoc.KnowledgeBaseCode),
			Code:              strings.TrimSpace(mappedDoc.Code),
			Mode:              SyncModeResync,
			Async:             true,
			SourceOverride: &SourceOverride{
				Content:            snapshot.Content,
				DocType:            snapshot.DocType,
				DocumentFile:       cloneDocumentFilePayload(snapshot.DocumentFile),
				ParsedDocument:     parseddocument.CloneParsedDocument(snapshot.ParsedDocument),
				Source:             snapshot.Source,
				ContentHash:        snapshot.ContentHash,
				FetchedAtUnixMilli: snapshot.FetchedAtUnixMilli,
			},
			BusinessParams: buildSyncBusinessParams(
				strings.TrimSpace(input.OrganizationCode),
				ResolveMappedDocumentUserID(mappedDoc),
				strings.TrimSpace(mappedDoc.KnowledgeBaseCode),
				strings.TrimSpace(input.ThirdPlatformUserID),
				strings.TrimSpace(input.ThirdPlatformOrganizationCode),
			),
		})
	}
	return requests
}

// BuildThirdFileRevectorizeRequests 根据 seed 和源快照构造重向量化调度请求。
func BuildThirdFileRevectorizeRequests(
	input *ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
	seed *ThirdFileRevectorizeSeed,
	snapshot *ResolvedSourceSnapshot,
) []*SyncDocumentInput {
	if seed == nil {
		return nil
	}
	return BuildThirdFileSyncRequests(input, docs, seed.SeedDocument, snapshot)
}

// BuildResolvedSourceSnapshot 构造稳定的源内容快照。
func BuildResolvedSourceSnapshot(input SourceSnapshotInput) *ResolvedSourceSnapshot {
	clonedParsed := parseddocument.CloneParsedDocument(input.ParsedDocument)
	normalizedContent := NormalizeDocumentContentForFileType(resolveSourceSnapshotFileType(input.DocumentFile), input.Content)
	if clonedParsed != nil {
		if result, err := BuildSyncContentFromParsedDocument(clonedParsed); err == nil {
			normalizedContent = result.Content
		}
	}
	contentHash := strings.TrimSpace(input.ContentHash)
	fetchedAtUnixMilli := input.FetchedAtUnixMilli
	if strings.TrimSpace(contentHash) == "" && normalizedContent != "" {
		contentHash = hashSourceContent(normalizedContent)
	}
	if fetchedAtUnixMilli == 0 {
		fetchedAtUnixMilli = input.Now.UnixMilli()
	}
	return &ResolvedSourceSnapshot{
		Content:            normalizedContent,
		ContentHash:        strings.TrimSpace(contentHash),
		DocType:            input.DocType,
		DocumentFile:       cloneDocumentFilePayload(input.DocumentFile),
		ParsedDocument:     clonedParsed,
		Source:             strings.TrimSpace(input.Source),
		FetchedAtUnixMilli: fetchedAtUnixMilli,
	}
}

func resolveSourceSnapshotFileType(documentFile map[string]any) string {
	if len(documentFile) == 0 {
		return ""
	}
	file, ok := FileFromPayload(documentFile)
	if !ok || file == nil {
		return ""
	}
	return ResolveDocumentFileExtension(file, "")
}

func buildSyncBusinessParams(
	organizationCode string,
	userID string,
	businessID string,
	thirdPlatformUserID string,
	thirdPlatformOrganizationCode string,
) *ctxmeta.BusinessParams {
	return &ctxmeta.BusinessParams{
		OrganizationCode:              strings.TrimSpace(organizationCode),
		UserID:                        strings.TrimSpace(userID),
		BusinessID:                    strings.TrimSpace(businessID),
		ThirdPlatformUserID:           strings.TrimSpace(thirdPlatformUserID),
		ThirdPlatformOrganizationCode: strings.TrimSpace(thirdPlatformOrganizationCode),
	}
}

func cloneDocumentFilePayload(src map[string]any) map[string]any {
	if len(src) == 0 {
		return nil
	}
	dst := make(map[string]any, len(src))
	maps.Copy(dst, src)
	return dst
}

func buildThirdFileSourceCacheKey(organizationCode, thirdPlatformType, thirdFileID string) string {
	return strings.Join([]string{
		"teamshare",
		strings.TrimSpace(organizationCode),
		strings.ToLower(strings.TrimSpace(thirdPlatformType)),
		strings.TrimSpace(thirdFileID),
	}, ":")
}
