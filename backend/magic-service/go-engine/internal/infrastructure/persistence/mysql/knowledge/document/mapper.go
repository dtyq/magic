package documentrepo

import (
	"database/sql"
	"fmt"
	"strconv"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/infrastructure/persistence/mysql/jsoncompat"
	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
	mysqlsqlc "magic/internal/infrastructure/persistence/mysql/sqlc"
	"magic/internal/pkg/filetype"
	"magic/pkg/convert"
)

const documentCoreSelectColumns = `d.id,
d.organization_code,
d.knowledge_base_code,
d.source_binding_id,
d.source_item_id,
d.auto_added,
d.name,
d.description,
d.code,
d.enabled,
d.doc_type,
COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata,
COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
d.sync_status,
d.sync_times,
d.sync_status_message,
d.embedding_model,
d.vector_db,
COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config,
COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
d.word_count,
d.third_platform_type,
d.third_file_id,
d.created_uid,
d.updated_uid,
d.created_at,
d.updated_at,
d.deleted_at`

const documentSelectColumns = documentCoreSelectColumns + `,
COALESCE(b.provider, '') AS source_provider,
COALESCE(b.root_ref, '') AS binding_root_ref,
COALESCE(si.item_ref, '') AS source_item_ref`

const documentScopedSelectColumns = documentCoreSelectColumns + `,
? AS source_provider,
? AS binding_root_ref,
? AS source_item_ref`

const documentSelectFromSQL = ` FROM knowledge_base_documents d
LEFT JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
LEFT JOIN knowledge_source_items si ON si.id = d.source_item_id`

const documentSelectSQL = `SELECT ` + documentSelectColumns + documentSelectFromSQL

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

func scanDocumentRecord(scanner interface{ Scan(dest ...any) error }) (documentRecord, error) {
	var record documentRecord
	if err := scanner.Scan(
		&record.ID,
		&record.OrganizationCode,
		&record.KnowledgeBaseCode,
		&record.SourceBindingID,
		&record.SourceItemID,
		&record.AutoAdded,
		&record.Name,
		&record.Description,
		&record.Code,
		&record.Enabled,
		&record.DocType,
		&record.DocMetadata,
		&record.DocumentFile,
		&record.SyncStatus,
		&record.SyncTimes,
		&record.SyncStatusMessage,
		&record.EmbeddingModel,
		&record.VectorDB,
		&record.RetrieveConfig,
		&record.FragmentConfig,
		&record.EmbeddingConfig,
		&record.VectorDBConfig,
		&record.WordCount,
		&record.ThirdPlatformType,
		&record.ThirdFileID,
		&record.CreatedUID,
		&record.UpdatedUID,
		&record.CreatedAt,
		&record.UpdatedAt,
		&record.DeletedAt,
		&record.SourceProvider,
		&record.BindingRootRef,
		&record.SourceItemRef,
	); err != nil {
		return documentRecord{}, fmt.Errorf("scan document record: %w", err)
	}
	return record, nil
}

func documentRecordFromFindDocumentByIDCompatRow(row mysqlsqlc.FindDocumentByIDCompatRow) (documentRecord, error) {
	docType, err := convert.SafeInt64ToInt32(int64(row.DocType), "doc_type")
	if err != nil {
		return documentRecord{}, fmt.Errorf("invalid doc_type: %w", err)
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
		DocType:           docType,
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
		SourceProvider:    row.SourceProvider,
		BindingRootRef:    row.BindingRootRef,
		SourceItemRef:     row.SourceItemRef,
	}, nil
}

func documentRecordFromFindDocumentByCodeCompatRow(row mysqlsqlc.FindDocumentByCodeCompatRow) (documentRecord, error) {
	return documentRecordFromFindDocumentByIDCompatRow(mysqlsqlc.FindDocumentByIDCompatRow(row))
}

func documentRecordFromFindDocumentByCodeAndKnowledgeBaseCompatRow(
	row mysqlsqlc.FindDocumentByCodeAndKnowledgeBaseCompatRow,
) (documentRecord, error) {
	return documentRecordFromFindDocumentByIDCompatRow(mysqlsqlc.FindDocumentByIDCompatRow(row))
}

func documentRecordFromFindDocumentByKnowledgeBaseAndProjectFileCompatRow(
	row mysqlsqlc.FindDocumentByKnowledgeBaseAndProjectFileCompatRow,
) (documentRecord, error) {
	return documentRecordFromFindDocumentByIDCompatRow(mysqlsqlc.FindDocumentByIDCompatRow(row))
}

func documentRecordFromFindDocumentIncludingDeletedCompatRow(
	row mysqlsqlc.FindDocumentIncludingDeletedCompatRow,
) (documentRecord, error) {
	return documentRecordFromFindDocumentByIDCompatRow(mysqlsqlc.FindDocumentByIDCompatRow(row))
}

func toKnowledgeBaseDocument(record documentRecord) (*documentdomain.KnowledgeBaseDocument, error) {
	wordCount, err := knowledgeShared.SafeUint64ToInt(record.WordCount, "word_count")
	if err != nil {
		return nil, fmt.Errorf("invalid word_count: %w", err)
	}

	doc := &documentdomain.KnowledgeBaseDocument{
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

func decodeDocumentJSONFields(record documentRecord, doc *documentdomain.KnowledgeBaseDocument) error {
	metadata, err := jsoncompat.DecodeObjectMap(record.DocMetadata, "doc_metadata")
	if err != nil {
		return fmt.Errorf("decode doc_metadata: %w", err)
	}
	doc.DocMetadata = metadata

	documentFile, err := DecodeDocumentFile(record.DocumentFile)
	if err != nil {
		return fmt.Errorf("decode document_file: %w", err)
	}
	if documentFile != nil && *documentFile == (documentdomain.File{}) {
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

func applyLegacySourceCompatibility(doc *documentdomain.KnowledgeBaseDocument, provider, bindingRootRef, itemRef string) {
	if doc == nil {
		return
	}
	switch provider {
	case sourcebindingdomain.ProviderProject:
		if doc.ProjectID == 0 {
			doc.ProjectID = parseInt64(bindingRootRef)
		}
		if doc.ProjectFileID == 0 {
			doc.ProjectFileID = parseInt64(itemRef)
		}
	case "", sourcebindingdomain.ProviderLocalUpload:
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
func DecodeDocumentFile(documentFileJSON []byte) (*documentdomain.File, error) {
	file, err := jsoncompat.DecodeObjectMap(documentFileJSON, "document_file")
	if err != nil {
		return nil, fmt.Errorf("decode document_file object: %w", err)
	}
	if len(file) == 0 {
		return &documentdomain.File{}, nil
	}

	fileLinkURL := ""
	if fileLink, ok := file["file_link"].(map[string]any); ok {
		fileLinkURL = anyToString(fileLink["url"])
	}

	return &documentdomain.File{
		Type:            normalizeDocumentFileType(file["type"]),
		Name:            anyToString(file["name"]),
		URL:             firstNonEmpty(anyToString(file["url"]), fileLinkURL, anyToString(file["key"])),
		Size:            anyToInt64(file["size"]),
		Extension:       inferDocumentFileExtension(file, fileLinkURL),
		ThirdID:         firstNonEmpty(anyToString(file["third_id"]), anyToString(file["third_file_id"])),
		SourceType:      firstNonEmpty(anyToString(file["source_type"]), anyToString(file["platform_type"])),
		KnowledgeBaseID: anyToString(file["knowledge_base_id"]),
	}, nil
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
