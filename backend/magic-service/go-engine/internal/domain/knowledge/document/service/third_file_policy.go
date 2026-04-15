package document

import (
	"maps"
	"strings"
	"time"

	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/ctxmeta"
)

// ThirdFileRevectorizeSeed 描述第三方文件重向量化前置规划结果。
type ThirdFileRevectorizeSeed struct {
	SourceCacheKey string
	SeedDocument   *KnowledgeBaseDocument
}

// SourceSnapshotInput 描述构造稳定源快照所需输入。
type SourceSnapshotInput struct {
	Content            string
	DocType            int
	DocumentFile       map[string]any
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
		OrganizationCode:  strings.TrimSpace(input.OrganizationCode),
		UserID:            strings.TrimSpace(input.UserID),
		ThirdPlatformType: strings.ToLower(strings.TrimSpace(input.ThirdPlatformType)),
		ThirdFileID:       strings.TrimSpace(input.ThirdFileID),
	}
}

// FirstUsableDocument 选择可用于代表第三方文件的文档。
func FirstUsableDocument(docs []*KnowledgeBaseDocument) *KnowledgeBaseDocument {
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
	docs []*KnowledgeBaseDocument,
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

// ResolveMappedDocumentUserID 解析用于调度同步的用户 ID。
func ResolveMappedDocumentUserID(defaultUserID string, doc *KnowledgeBaseDocument) string {
	if strings.TrimSpace(defaultUserID) != "" {
		return strings.TrimSpace(defaultUserID)
	}
	if doc == nil {
		return ""
	}
	return strings.TrimSpace(doc.UpdatedUID)
}

// BuildThirdFileSyncRequests 根据第三方源快照构造所有文档同步请求。
func BuildThirdFileSyncRequests(
	input *ThirdFileRevectorizeInput,
	docs []*KnowledgeBaseDocument,
	seedDoc *KnowledgeBaseDocument,
	snapshot *ResolvedSourceSnapshot,
) []*SyncDocumentInput {
	if input == nil || snapshot == nil {
		return nil
	}

	defaultUserID := strings.TrimSpace(input.UserID)
	if defaultUserID == "" && seedDoc != nil {
		defaultUserID = strings.TrimSpace(seedDoc.UpdatedUID)
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
				Source:             snapshot.Source,
				ContentHash:        snapshot.ContentHash,
				FetchedAtUnixMilli: snapshot.FetchedAtUnixMilli,
			},
			BusinessParams: buildSyncBusinessParams(strings.TrimSpace(input.OrganizationCode), ResolveMappedDocumentUserID(defaultUserID, mappedDoc), strings.TrimSpace(mappedDoc.KnowledgeBaseCode)),
		})
	}
	return requests
}

// BuildThirdFileRevectorizeRequests 根据 seed 和源快照构造重向量化调度请求。
func BuildThirdFileRevectorizeRequests(
	input *ThirdFileRevectorizeInput,
	docs []*KnowledgeBaseDocument,
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
	normalizedContent := NormalizeDocumentContentForFileType(resolveSourceSnapshotFileType(input.DocumentFile), input.Content)
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

func buildSyncBusinessParams(organizationCode, userID, businessID string) *ctxmeta.BusinessParams {
	return &ctxmeta.BusinessParams{
		OrganizationCode: strings.TrimSpace(organizationCode),
		UserID:           strings.TrimSpace(userID),
		BusinessID:       strings.TrimSpace(businessID),
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
