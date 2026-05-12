package documentrepo

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
	"magic/internal/infrastructure/persistence/mysql/jsoncompat"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/internal/pkg/filetype"
)

var errDocumentDocTypeOverflow = errors.New("document doc_type overflows int32")

type documentRecord struct {
	ID                int64
	OrganizationCode  string
	KnowledgeBaseCode string
	SourceBindingID   int64
	SourceItemID      int64
	AutoAdded         bool
	Name              string
	Description       string
	Code              string
	Enabled           bool
	DocType           int32
	DocMetadata       []byte
	DocumentFile      []byte
	SyncStatus        int32
	SyncTimes         int32
	SyncStatusMessage string
	EmbeddingModel    string
	VectorDB          string
	RetrieveConfig    []byte
	FragmentConfig    []byte
	EmbeddingConfig   []byte
	VectorDBConfig    []byte
	WordCount         uint64
	ThirdPlatformType sql.NullString
	ThirdFileID       sql.NullString
	CreatedUID        string
	UpdatedUID        string
	CreatedAt         sql.NullTime
	UpdatedAt         sql.NullTime
	DeletedAt         sql.NullTime
	SourceProvider    string
	BindingRootRef    string
	SourceItemRef     string
}

type documentFileExtensionPayload struct {
	Extension              string                         `json:"extension"`
	ThirdFileExtensionName string                         `json:"third_file_extension_name"`
	Name                   string                         `json:"name"`
	URL                    string                         `json:"url"`
	Key                    string                         `json:"key"`
	FileLink               *documentFileExtensionFileLink `json:"file_link"`
}

type documentFileExtensionFileLink struct {
	URL string `json:"url"`
}

// ToKnowledgeBaseDocumentByCodeAndKnowledgeBase 将 sqlc 查询行映射为领域文档实体。
func ToKnowledgeBaseDocumentByCodeAndKnowledgeBase(
	row mysqlsqlc.KnowledgeBaseDocument,
) (*docentity.KnowledgeBaseDocument, error) {
	record, err := documentRecordFromFindByCodeAndKnowledgeBaseRow(row)
	if err != nil {
		return nil, err
	}
	return toKnowledgeBaseDocument(record)
}

func toKnowledgeBaseDocument(record documentRecord) (*docentity.KnowledgeBaseDocument, error) {
	wordCount, err := knowledgeShared.SafeUint64ToInt(record.WordCount, "word_count")
	if err != nil {
		return nil, fmt.Errorf("invalid word_count: %w", err)
	}

	doc := &docentity.KnowledgeBaseDocument{
		ID:                record.ID,
		OrganizationCode:  record.OrganizationCode,
		KnowledgeBaseCode: record.KnowledgeBaseCode,
		SourceBindingID:   record.SourceBindingID,
		SourceItemID:      record.SourceItemID,
		AutoAdded:         record.AutoAdded,
		Name:              record.Name,
		Description:       record.Description,
		Code:              record.Code,
		Enabled:           record.Enabled,
		DocType:           int(record.DocType),
		SyncStatus:        shared.SyncStatus(record.SyncStatus),
		SyncTimes:         int(record.SyncTimes),
		SyncStatusMessage: record.SyncStatusMessage,
		EmbeddingModel:    record.EmbeddingModel,
		VectorDB:          record.VectorDB,
		WordCount:         wordCount,
		ThirdPlatformType: record.ThirdPlatformType.String,
		ThirdFileID:       record.ThirdFileID.String,
		CreatedUID:        record.CreatedUID,
		UpdatedUID:        record.UpdatedUID,
	}

	if record.CreatedAt.Valid {
		doc.CreatedAt = record.CreatedAt.Time
	}
	if record.UpdatedAt.Valid {
		doc.UpdatedAt = record.UpdatedAt.Time
	}
	if record.DeletedAt.Valid {
		doc.DeletedAt = &record.DeletedAt.Time
	}

	if err := decodeDocumentJSONFields(record, doc); err != nil {
		return nil, err
	}
	applyLegacySourceCompatibility(doc, record.SourceProvider, record.BindingRootRef, record.SourceItemRef)
	return doc, nil
}

func documentRecordFromFindByIDRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	if row.DocType > math.MaxInt32 {
		return documentRecord{}, fmt.Errorf("%w: %d", errDocumentDocTypeOverflow, row.DocType)
	}
	return documentRecord{
		ID:                row.ID,
		OrganizationCode:  row.OrganizationCode,
		KnowledgeBaseCode: row.KnowledgeBaseCode,
		SourceBindingID:   row.SourceBindingID,
		SourceItemID:      row.SourceItemID,
		AutoAdded:         row.AutoAdded,
		Name:              row.Name,
		Description:       row.Description,
		Code:              row.Code,
		Enabled:           row.Enabled,
		DocType:           int32(row.DocType),
		DocMetadata:       row.DocMetadata,
		DocumentFile:      row.DocumentFile,
		SyncStatus:        row.SyncStatus,
		SyncTimes:         row.SyncTimes,
		SyncStatusMessage: row.SyncStatusMessage,
		EmbeddingModel:    row.EmbeddingModel,
		VectorDB:          row.VectorDb,
		RetrieveConfig:    row.RetrieveConfig,
		FragmentConfig:    row.FragmentConfig,
		EmbeddingConfig:   row.EmbeddingConfig,
		VectorDBConfig:    row.VectorDbConfig,
		WordCount:         row.WordCount,
		ThirdPlatformType: row.ThirdPlatformType,
		ThirdFileID:       row.ThirdFileID,
		CreatedUID:        row.CreatedUid,
		UpdatedUID:        row.UpdatedUid,
		CreatedAt:         sql.NullTime{Time: row.CreatedAt, Valid: true},
		UpdatedAt:         sql.NullTime{Time: row.UpdatedAt, Valid: true},
		DeletedAt:         row.DeletedAt,
	}, nil
}

func documentRecordFromModel(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromFindByCodeRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromFindByCodeAndKnowledgeBaseRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromFindByThirdFileRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromFindByKnowledgeBaseAndThirdFileRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromFindLatestByBindingAndItemsRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromFindLatestBySourceItemsRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromFindDocumentIncludingDeletedRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromListByKnowledgeBaseRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromListByKnowledgeBaseAndSourceBindingIDsRow(
	row mysqlsqlc.KnowledgeBaseDocument,
) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromListByOrganizationRow(row mysqlsqlc.KnowledgeBaseDocument) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromListByOrganizationAndKnowledgeBaseRow(
	row mysqlsqlc.KnowledgeBaseDocument,
) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromListByOrganizationAndSourceBindingAndSourceItemsRow(
	row mysqlsqlc.KnowledgeBaseDocument,
) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromListByOrganizationAndSourceItemIDsRow(
	row mysqlsqlc.KnowledgeBaseDocument,
) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func documentRecordFromListByOrganizationAndThirdFileRow(
	row mysqlsqlc.KnowledgeBaseDocument,
) (documentRecord, error) {
	return documentRecordFromFindByIDRow(row)
}

func decodeDocumentJSONFields(record documentRecord, doc *docentity.KnowledgeBaseDocument) error {
	metadata, err := jsoncompat.DecodeObjectMap(record.DocMetadata, "doc_metadata")
	if err != nil {
		return fmt.Errorf("decode doc_metadata: %w", err)
	}
	doc.DocMetadata = metadata

	documentFile, err := DecodeDocumentFile(record.DocumentFile)
	if err != nil {
		return fmt.Errorf("decode document_file: %w", err)
	}
	if documentFile != nil && *documentFile == (docentity.File{}) {
		documentFile = nil
	}
	doc.DocumentFile = documentFile

	retrieveConfig, err := jsoncompat.DecodeObjectPtr[shared.RetrieveConfig](record.RetrieveConfig, "retrieve_config")
	if err != nil {
		return fmt.Errorf("decode retrieve_config: %w", err)
	}
	doc.RetrieveConfig = retrieveConfig

	fragmentConfig, err := jsoncompat.DecodeObjectPtr[shared.FragmentConfig](record.FragmentConfig, "fragment_config")
	if err != nil {
		return fmt.Errorf("decode fragment_config: %w", err)
	}
	doc.FragmentConfig = fragmentConfig

	embeddingConfig, err := jsoncompat.DecodeObjectPtr[shared.EmbeddingConfig](record.EmbeddingConfig, "embedding_config")
	if err != nil {
		return fmt.Errorf("decode embedding_config: %w", err)
	}
	doc.EmbeddingConfig = embeddingConfig

	vectorDBConfig, err := jsoncompat.DecodeObjectPtr[shared.VectorDBConfig](record.VectorDBConfig, "vector_db_config")
	if err != nil {
		return fmt.Errorf("decode vector_db_config: %w", err)
	}
	doc.VectorDBConfig = vectorDBConfig
	return nil
}

func applyLegacySourceCompatibility(doc *docentity.KnowledgeBaseDocument, provider, bindingRootRef, itemRef string) {
	if doc == nil {
		return
	}
	switch provider {
	case sourcebindingentity.ProviderProject:
		if doc.ProjectID == 0 {
			doc.ProjectID = parseInt64(bindingRootRef)
		}
		if doc.ProjectFileID == 0 {
			doc.ProjectFileID = parseInt64(itemRef)
		}
	case "", sourcebindingentity.ProviderLocalUpload:
		return
	default:
		if doc.ThirdPlatformType == "" {
			doc.ThirdPlatformType = provider
		}
		if doc.ThirdFileID == "" {
			doc.ThirdFileID = itemRef
		}
	}
}

// DecodeDocumentFile 将 JSON 文档文件信息解析为统一结构。
func DecodeDocumentFile(documentFileJSON []byte) (*docentity.File, error) {
	file, err := jsoncompat.DecodeObjectMap(documentFileJSON, "document_file")
	if err != nil {
		return nil, fmt.Errorf("decode document_file object: %w", err)
	}
	if len(file) == 0 {
		return &docentity.File{}, nil
	}

	fileLinkURL := ""
	if fileLink, ok := file["file_link"].(map[string]any); ok {
		fileLinkURL = anyToString(fileLink["url"])
	}

	return &docentity.File{
		Type:            normalizeDocumentFileType(file["type"]),
		Name:            anyToString(file["name"]),
		URL:             firstNonEmpty(anyToString(file["url"]), fileLinkURL, anyToString(file["key"])),
		Size:            anyToInt64(file["size"]),
		Extension:       inferDocumentFileExtension(file, fileLinkURL),
		ThirdID:         firstNonEmpty(anyToString(file["third_id"]), anyToString(file["third_file_id"])),
		SourceType:      firstNonEmpty(anyToString(file["source_type"]), anyToString(file["platform_type"])),
		ThirdFileType:   firstNonEmpty(anyToString(file["third_file_type"]), anyToString(file["teamshare_file_type"]), anyToString(file["file_type"])),
		KnowledgeBaseID: anyToString(file["knowledge_base_id"]),
	}, nil
}

func extractDocumentFileExtension(documentFileJSON []byte) (string, error) {
	if len(documentFileJSON) == 0 {
		return "", nil
	}

	var payload documentFileExtensionPayload
	if err := json.Unmarshal(documentFileJSON, &payload); err != nil {
		return "", fmt.Errorf("decode document_file extension: %w", err)
	}

	fileLinkURL := ""
	if payload.FileLink != nil {
		fileLinkURL = payload.FileLink.URL
	}

	return inferDocumentFileExtension(map[string]any{
		"extension":                 payload.Extension,
		"third_file_extension_name": payload.ThirdFileExtensionName,
		"name":                      payload.Name,
		"url":                       payload.URL,
		"key":                       payload.Key,
	}, fileLinkURL), nil
}

func inferDocumentFileExtension(file map[string]any, fileLinkURL string) string {
	if ext := filetype.NormalizeExtension(anyToString(file["extension"])); ext != "" {
		return ext
	}
	if ext := filetype.NormalizeExtension(anyToString(file["third_file_extension_name"])); ext != "" {
		return ext
	}
	for _, candidate := range []string{
		anyToString(file["name"]),
		anyToString(file["url"]),
		anyToString(file["key"]),
		fileLinkURL,
	} {
		if ext := filetype.ExtractExtension(candidate); ext != "" {
			return ext
		}
	}
	return ""
}

func normalizeDocumentFileType(v any) string {
	switch value := v.(type) {
	case string:
		return value
	case float64:
		switch int64(value) {
		case 1:
			return "external"
		case 2:
			return "third_platform"
		default:
			return strconv.FormatInt(int64(value), 10)
		}
	default:
		return anyToString(v)
	}
}

func anyToString(v any) string {
	switch value := v.(type) {
	case string:
		return value
	case float64:
		return strconv.FormatInt(int64(value), 10)
	case int64:
		return strconv.FormatInt(value, 10)
	case int:
		return strconv.Itoa(value)
	default:
		return ""
	}
}

func anyToInt64(v any) int64 {
	switch value := v.(type) {
	case int64:
		return value
	case int:
		return int64(value)
	case float64:
		return int64(value)
	case string:
		return parseInt64(value)
	default:
		return 0
	}
}

func parseInt64(value string) int64 {
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
