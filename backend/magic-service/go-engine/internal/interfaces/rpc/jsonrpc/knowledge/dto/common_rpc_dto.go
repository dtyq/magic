// Package dto 定义 RPC 接口的数据传输对象。
package dto

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"

	confighelper "magic/internal/application/knowledge/helper/config"
	"magic/internal/constants"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

// 业务参数

// BusinessParams 业务参数
type BusinessParams struct {
	OrganizationCode string `json:"organization_code"`
	// OrganizationID 兼容旧入参字段，优先级低于 OrganizationCode。
	OrganizationID string `json:"organization_id,omitempty"`
	UserID         string `json:"user_id"`
	BusinessID     string `json:"business_id"`
	SourceID       string `json:"source_id"`
}

// ResolveOrganizationCode 返回规范化组织编码。
func (bp BusinessParams) ResolveOrganizationCode() string {
	if bp.OrganizationCode != "" {
		return bp.OrganizationCode
	}
	return bp.OrganizationID
}

// 分页参数

// PageParams 分页参数
type PageParams struct {
	Offset int `json:"offset" validate:"min=0"`
	Limit  int `json:"limit" validate:"min=1"`
}

// UnmarshalJSON 兼容分页数值字段传字符串。
func (p *PageParams) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "page")
	if err != nil {
		return err
	}

	offset, err := decodeRequestIntValue(raw, "offset")
	if err != nil {
		return err
	}
	limit, err := decodeRequestIntValue(raw, "limit")
	if err != nil {
		return err
	}

	*p = PageParams{
		Offset: offset,
		Limit:  limit,
	}
	return nil
}

// 数据隔离参数

// DataIsolation 数据隔离参数
type DataIsolation struct {
	OrganizationCode string `json:"organization_code"`
	// OrganizationID 兼容旧入参字段，优先级低于 OrganizationCode。
	OrganizationID                string `json:"organization_id,omitempty"`
	UserID                        string `json:"user_id"`
	ThirdPlatformUserID           string `json:"third_platform_user_id,omitempty"`
	ThirdPlatformOrganizationCode string `json:"third_platform_organization_code,omitempty"`
}

// ResolveOrganizationCode 返回规范化组织编码。
func (di DataIsolation) ResolveOrganizationCode() string {
	if di.OrganizationCode != "" {
		return di.OrganizationCode
	}
	return di.OrganizationID
}

const (
	maxRetrieveTopK   = 10
	maxHierarchyLevel = 6
	defaultPageNumber = 1
)

var errEmptyCompatInteger = errors.New("empty compat integer")

func unmarshalRequestObject(data []byte, fieldName string) (map[string]json.RawMessage, error) {
	raw := map[string]json.RawMessage{}
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(data, map[string]json.RawMessage{}, &raw); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}
	return raw, nil
}

func decodeRequestString(raw map[string]json.RawMessage, fieldName string) (string, bool, error) {
	field, ok := raw[fieldName]
	if !ok {
		return "", false, nil
	}
	trimmed := strings.TrimSpace(string(field))
	if trimmed == "" || trimmed == rawJSONNullLiteral {
		return "", true, nil
	}

	var value string
	if err := json.Unmarshal(field, &value); err != nil {
		return "", false, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}
	return value, true, nil
}

func decodeRequestStringValue(raw map[string]json.RawMessage, fieldName string) (string, error) {
	value, _, err := decodeRequestString(raw, fieldName)
	return value, err
}

func decodeRequestIDString(raw map[string]json.RawMessage, fieldName string) (string, bool, error) {
	field, ok := raw[fieldName]
	if !ok {
		return "", false, nil
	}
	value, provided, err := pkgjsoncompat.DecodeOptionalIDString(field, fieldName)
	if err != nil {
		return "", false, fmt.Errorf("decode %s: %w", fieldName, err)
	}
	return value, provided, nil
}

func decodeRequestIDStringValue(raw map[string]json.RawMessage, fieldName string) (string, error) {
	value, _, err := decodeRequestIDString(raw, fieldName)
	return value, err
}

func decodeRequestInt(raw map[string]json.RawMessage, fieldName string) (*int, bool, error) {
	field, ok := raw[fieldName]
	if !ok {
		return nil, false, nil
	}
	value, provided, err := pkgjsoncompat.DecodeOptionalInt(field, fieldName)
	if err != nil {
		return nil, false, fmt.Errorf("decode %s: %w", fieldName, err)
	}
	return value, provided, nil
}

func decodeRequestIntValue(raw map[string]json.RawMessage, fieldName string) (int, error) {
	value, _, err := decodeRequestInt(raw, fieldName)
	if err != nil {
		return 0, err
	}
	if value == nil {
		return 0, nil
	}
	return *value, nil
}

func decodeRequestInt64(raw map[string]json.RawMessage, fieldName string) (*int64, bool, error) {
	field, ok := raw[fieldName]
	if !ok {
		return nil, false, nil
	}
	value, provided, err := pkgjsoncompat.DecodeOptionalInt64(field, fieldName)
	if err != nil {
		return nil, false, fmt.Errorf("decode %s: %w", fieldName, err)
	}
	return value, provided, nil
}

func decodeRequestInt64Value(raw map[string]json.RawMessage, fieldName string) (int64, error) {
	value, _, err := decodeRequestInt64(raw, fieldName)
	if err != nil {
		return 0, err
	}
	if value == nil {
		return 0, nil
	}
	return *value, nil
}

func decodeRequestIDInt64(raw map[string]json.RawMessage, fieldName string) (*int64, bool, error) {
	field, ok := raw[fieldName]
	if !ok {
		return nil, false, nil
	}
	value, provided, err := pkgjsoncompat.DecodeOptionalIDInt64(field, fieldName)
	if err != nil {
		return nil, false, fmt.Errorf("decode %s: %w", fieldName, err)
	}
	return value, provided, nil
}

func decodeRequestIDInt64Value(raw map[string]json.RawMessage, fieldName string) (int64, error) {
	value, _, err := decodeRequestIDInt64(raw, fieldName)
	if err != nil {
		return 0, err
	}
	if value == nil {
		return 0, nil
	}
	return *value, nil
}

func decodeRequestFloat64(raw map[string]json.RawMessage, fieldName string) (float64, bool, error) {
	field, ok := raw[fieldName]
	if !ok {
		return 0, false, nil
	}
	value, _, err := pkgjsoncompat.DecodeOptionalFloat64(field, fieldName)
	if err != nil {
		return 0, false, fmt.Errorf("decode %s: %w", fieldName, err)
	}
	if value == nil {
		return 0, false, nil
	}
	return *value, true, nil
}

func decodeRequestFloat64Value(raw map[string]json.RawMessage, fieldName string) (float64, error) {
	value, ok, err := decodeRequestFloat64(raw, fieldName)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, nil
	}
	return value, nil
}

func decodeRequestBoolPHPTruth(raw map[string]json.RawMessage, fieldName string) (*bool, bool, error) {
	field, ok := raw[fieldName]
	if !ok {
		return nil, false, nil
	}
	value, provided, err := pkgjsoncompat.DecodeOptionalBoolPHPTruth(field, fieldName)
	if err != nil {
		return nil, false, fmt.Errorf("decode %s: %w", fieldName, err)
	}
	return value, provided, nil
}

func decodeRequestStringSlice(raw map[string]json.RawMessage, fieldName string) ([]string, error) {
	field, ok := raw[fieldName]
	if !ok {
		return nil, nil
	}
	if pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		return []string{}, nil
	}

	var values []string
	if err := json.Unmarshal(field, &values); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}
	return values, nil
}

func decodeRequestIntSlice(raw map[string]json.RawMessage, fieldName string) ([]int, error) {
	field, ok := raw[fieldName]
	if !ok {
		return nil, nil
	}
	return decodeCompatIntegerSlice(
		field,
		fieldName,
		func(item json.RawMessage, itemField string) (int, error) {
			value, _, err := pkgjsoncompat.DecodeOptionalInt(item, itemField)
			if err != nil {
				return 0, fmt.Errorf("decode %s: %w", itemField, err)
			}
			if value == nil {
				return 0, fmt.Errorf("decode %s: %w", itemField, errEmptyCompatInteger)
			}
			return *value, nil
		},
	)
}

func decodeRequestIDInt64Slice(raw map[string]json.RawMessage, fieldName string) ([]int64, error) {
	field, ok := raw[fieldName]
	if !ok {
		return nil, nil
	}
	return decodeCompatIntegerSlice(
		field,
		fieldName,
		func(item json.RawMessage, itemField string) (int64, error) {
			value, _, err := pkgjsoncompat.DecodeOptionalIDInt64(item, itemField)
			if err != nil {
				return 0, fmt.Errorf("decode %s: %w", itemField, err)
			}
			if value == nil {
				return 0, fmt.Errorf("decode %s: %w", itemField, errEmptyCompatInteger)
			}
			return *value, nil
		},
	)
}

func decodeCompatIntegerSlice[T int | int64](
	field json.RawMessage,
	fieldName string,
	decodeItem func(item json.RawMessage, itemField string) (T, error),
) ([]T, error) {
	trimmed := bytes.TrimSpace(field)
	switch {
	case len(trimmed) == 0, bytes.Equal(trimmed, []byte("null")):
		return []T{}, nil
	case bytes.Equal(trimmed, []byte("[]")):
		return []T{}, nil
	case trimmed[0] == '"':
		var rawString string
		if err := json.Unmarshal(trimmed, &rawString); err != nil {
			return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
		}
		switch strings.TrimSpace(rawString) {
		case "", "null", "[]":
			return []T{}, nil
		}
	}

	var items []json.RawMessage
	if err := json.Unmarshal(trimmed, &items); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}

	values := make([]T, 0, len(items))
	for idx, item := range items {
		itemField := fmt.Sprintf("%s[%d]", fieldName, idx)
		value, err := decodeItem(item, itemField)
		if err != nil {
			return nil, err
		}
		values = append(values, value)
	}
	return values, nil
}

func decodeRequestPageWindow(
	raw map[string]json.RawMessage,
	defaultLimit int,
) (int, int, error) {
	offset := 0
	limit := defaultLimit

	explicitOffset, offsetProvided, err := decodeRequestInt(raw, "offset")
	if err != nil {
		return 0, 0, err
	}
	explicitLimit, limitProvided, err := decodeRequestInt(raw, "limit")
	if err != nil {
		return 0, 0, err
	}
	if offsetProvided || limitProvided {
		if explicitOffset != nil {
			offset = *explicitOffset
		}
		if explicitLimit != nil {
			limit = *explicitLimit
		}
		return offset, limit, nil
	}

	page := defaultPageNumber
	pageValue, pageProvided, err := decodeRequestInt(raw, "page")
	if err != nil {
		return 0, 0, err
	}
	if pageProvided && pageValue != nil {
		page = *pageValue
	}
	pageSizeValue, pageSizeProvided, err := decodeRequestInt(raw, "page_size")
	if err != nil {
		return 0, 0, err
	}
	if pageSizeProvided && pageSizeValue != nil {
		limit = *pageSizeValue
	}
	offset = (page - 1) * limit
	return offset, limit, nil
}

func isJSONObjectPayload(data json.RawMessage) bool {
	trimmed := strings.TrimSpace(string(data))
	return len(trimmed) > 0 && trimmed[0] == '{'
}

func newRPCRequestValidator() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	v.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "" || name == "-" {
			return fld.Name
		}
		return name
	})
	return v
}

func validateStruct(req any) error {
	if err := newRPCRequestValidator().Struct(req); err != nil {
		var validationErrs validator.ValidationErrors
		if errors.As(err, &validationErrs) {
			return invalidParams(formatValidationError(validationErrs[0]))
		}
		return invalidParams(err.Error())
	}
	return nil
}

func formatValidationError(fe validator.FieldError) string {
	fieldPath := formatFieldPath(fe.Namespace(), fe.Field())
	switch fe.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", fieldPath)
	case "gt":
		if fe.Param() == "0" {
			return fmt.Sprintf("%s must be greater than 0", fieldPath)
		}
		return fmt.Sprintf("%s must be greater than %s", fieldPath, fe.Param())
	case "min":
		switch fe.Kind() {
		case reflect.Slice, reflect.Array:
			return fmt.Sprintf("%s must contain at least %s item", fieldPath, fe.Param())
		case reflect.String:
			return fmt.Sprintf("%s must be at least %s characters long", fieldPath, fe.Param())
		default:
			return fmt.Sprintf("%s must be greater than or equal to %s", fieldPath, fe.Param())
		}
	case "max":
		return fmt.Sprintf("%s must be less than or equal to %s", fieldPath, fe.Param())
	default:
		return fmt.Sprintf("%s is invalid", fieldPath)
	}
}

func formatFieldPath(namespace, fallback string) string {
	if _, after, ok := strings.Cut(namespace, "."); ok {
		return after
	}
	if fallback != "" {
		return fallback
	}
	return namespace
}

func invalidParams(message string) error {
	return jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInvalidParams, message, nil)
}

func invalidParamsf(format string, args ...any) error {
	return invalidParams(fmt.Sprintf(format, args...))
}

func validateResolvedOrgCode(fieldPath, code string) error {
	if code == "" {
		return invalidParamsf("%s is required", fieldPath)
	}
	return nil
}

func validateRequiredUserID(userID string) error {
	if strings.TrimSpace(userID) == "" {
		return invalidParams("data_isolation.user_id is required")
	}
	return nil
}

func validateTrimmedRequiredString(fieldPath, value string) error {
	if strings.TrimSpace(value) == "" {
		return invalidParamsf("%s is required", fieldPath)
	}
	return nil
}

func validateRetrieveConfig(cfg *confighelper.RetrieveConfigDTO) error {
	if cfg == nil {
		return nil
	}
	if cfg.TopK < 1 || cfg.TopK > maxRetrieveTopK {
		return invalidParamsf("retrieve_config.top_k must be between 1 and %d", maxRetrieveTopK)
	}
	return nil
}

func validateSimilarityTopK(topK int) error {
	if topK <= 0 {
		return nil
	}
	if topK > maxRetrieveTopK {
		return invalidParamsf("top_k must be less than or equal to %d", maxRetrieveTopK)
	}
	return nil
}

func validateFragmentConfig(cfg *confighelper.FragmentConfigDTO) error {
	if cfg == nil {
		return nil
	}
	rawChunkOverlapUnit := ""
	if cfg.Normal != nil && cfg.Normal.SegmentRule != nil {
		rawChunkOverlapUnit = strings.TrimSpace(cfg.Normal.SegmentRule.ChunkOverlapUnit)
	}
	if !confighelper.IsValidChunkOverlapUnit(rawChunkOverlapUnit) {
		return invalidParams("fragment_config.normal.segment_rule.chunk_overlap_unit must be one of absolute, percent")
	}

	normalized := confighelper.NormalizeFragmentConfigDTO(cfg)
	if normalized == nil {
		return nil
	}

	switch normalized.Mode {
	case 1:
		if normalized.Normal == nil {
			return invalidParams("fragment_config.normal is required when mode=1")
		}
		if normalized.Normal.SegmentRule == nil {
			return invalidParams("fragment_config.normal.segment_rule is required when mode=1")
		}
		if normalized.Normal.SegmentRule.ChunkSize < 1 {
			return invalidParams("fragment_config.normal.segment_rule.chunk_size must be greater than 0")
		}
		if normalized.Normal.SegmentRule.ChunkOverlap < 0 {
			return invalidParams("fragment_config.normal.segment_rule.chunk_overlap must be greater than or equal to 0")
		}
		unit := confighelper.NormalizeChunkOverlapUnit(rawChunkOverlapUnit)
		if unit == confighelper.ChunkOverlapUnitPercent &&
			normalized.Normal.SegmentRule.ChunkOverlap > 100 {
			return invalidParams("fragment_config.normal.segment_rule.chunk_overlap must be less than or equal to 100 when chunk_overlap_unit=percent")
		}
	case 2:
		return nil
	case 3:
		if normalized.Hierarchy == nil {
			return invalidParams("fragment_config.hierarchy is required when mode=3")
		}
		if normalized.Hierarchy.MaxLevel != 0 && (normalized.Hierarchy.MaxLevel < 1 || normalized.Hierarchy.MaxLevel > maxHierarchyLevel) {
			return invalidParamsf("fragment_config.hierarchy.max_level must be between 1 and %d", maxHierarchyLevel)
		}
	default:
		return invalidParams("fragment_config.mode must be one of 1, 2, 3")
	}

	return nil
}

func validateStrategyConfig(cfg *confighelper.StrategyConfigDTO) error {
	if cfg == nil {
		return nil
	}
	switch cfg.ParsingType {
	case 0, 1, 2:
		return nil
	default:
		return invalidParams("strategy_config.parsing_type must be one of 0, 1, 2")
	}
}

func validateSourceBindings(bindings []SourceBindingPayload) error {
	for idx, binding := range bindings {
		if strings.TrimSpace(binding.Provider) == "" {
			return invalidParamsf("source_bindings[%d].provider is required", idx)
		}
		if strings.TrimSpace(binding.RootType) == "" {
			return invalidParamsf("source_bindings[%d].root_type is required", idx)
		}
		if strings.TrimSpace(binding.RootRef) == "" {
			return invalidParamsf("source_bindings[%d].root_ref is required", idx)
		}
		if strings.TrimSpace(binding.SyncMode) == "" {
			return invalidParamsf("source_bindings[%d].sync_mode is required", idx)
		}
		for targetIdx, target := range binding.Targets {
			switch strings.TrimSpace(target.TargetType) {
			case "", "folder", "group", "file":
			default:
				return invalidParamsf("source_bindings[%d].targets[%d].target_type must be one of %q, %q", idx, targetIdx, "folder", "file")
			}
			if strings.TrimSpace(target.TargetType) != "" && strings.TrimSpace(target.TargetRef) == "" {
				return invalidParamsf("source_bindings[%d].targets[%d].target_ref is required", idx, targetIdx)
			}
		}
	}
	return nil
}

// validateKnowledgeBaseSourceTypeIfPresent 只校验联合 source_type 值域。
//
// RPC/DTO 层故意不在这里做产品线级强校验：
// - 创建时产品线要先按 agent_codes 判定
// - 更新时产品线要先按存量 knowledge_base_type 判定
func validateKnowledgeBaseSourceTypeIfPresent(sourceType *int) error {
	if sourceType == nil {
		return nil
	}
	if constants.IsValidKnowledgeBaseSourceType(*sourceType) {
		return nil
	}
	return invalidParams("source_type must be one of 1, 2, 3, 4, 1001")
}

func validateStringSlice(fieldPath string, values []string) error {
	if len(values) == 0 {
		return invalidParamsf("%s must contain at least 1 item", fieldPath)
	}
	for idx, value := range values {
		if strings.TrimSpace(value) == "" {
			return invalidParamsf("%s[%d] is required", fieldPath, idx)
		}
	}
	return nil
}

func validateOptionalStringSlice(fieldPath string, values []string) error {
	for idx, value := range values {
		if strings.TrimSpace(value) == "" {
			return invalidParamsf("%s[%d] is required", fieldPath, idx)
		}
	}
	return nil
}

func validateTargetDimensionIfPresent(fieldPath string, value int64) error {
	if value != 0 && value < 0 {
		return invalidParamsf("%s must be greater than or equal to 0", fieldPath)
	}
	return nil
}

func validateIntIfPresentGEZero(fieldPath string, value int) error {
	if value < 0 {
		return invalidParamsf("%s must be greater than or equal to 0", fieldPath)
	}
	return nil
}

func validateTexts(fieldPath string, values []string) error {
	if len(values) == 0 {
		return invalidParamsf("%s is required", fieldPath)
	}
	for idx, value := range values {
		if value == "" {
			return invalidParamsf("%s[%d] is required", fieldPath, idx)
		}
	}
	return nil
}

func validateKnowledgeBaseCodes(codes []string) error {
	return validateStringSlice("knowledge_base_codes", codes)
}

func validateRetryIfPresent(fieldPath string, value int) error {
	if value < 0 {
		return invalidParamsf("%s must be greater than or equal to 0", fieldPath)
	}
	return nil
}

func validateBatchSizePositive(fieldPath string, value int) error {
	if value != 0 && value <= 0 {
		return invalidParamsf("%s must be greater than 0", fieldPath)
	}
	return nil
}

// Validate 校验 CreateKnowledgeBaseRequest 的 RPC 入参。
func (r CreateKnowledgeBaseRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateRequiredUserID(r.DataIsolation.UserID); err != nil {
		return err
	}
	if err := validateTrimmedRequiredString("name", r.Name); err != nil {
		return err
	}
	if err := validateRetrieveConfig(r.RetrieveConfig); err != nil {
		return err
	}
	if err := validateFragmentConfig(r.FragmentConfig); err != nil {
		return err
	}
	if err := validateKnowledgeBaseSourceTypeIfPresent(r.SourceType); err != nil {
		return err
	}
	if len(r.AgentCodes) > 0 {
		if err := validateStringSlice("agent_codes", r.AgentCodes); err != nil {
			return err
		}
	}
	return validateSourceBindings(r.SourceBindings)
}

// Validate 校验 UpdateKnowledgeBaseRequest 的 RPC 入参。
func (r UpdateKnowledgeBaseRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateRequiredUserID(r.DataIsolation.UserID); err != nil {
		return err
	}
	if err := validateRetrieveConfig(r.RetrieveConfig); err != nil {
		return err
	}
	if err := validateFragmentConfig(r.FragmentConfig); err != nil {
		return err
	}
	if err := validateKnowledgeBaseSourceTypeIfPresent(r.SourceType); err != nil {
		return err
	}
	if r.SourceBindings == nil {
		return nil
	}
	return validateSourceBindings(*r.SourceBindings)
}

// Validate 校验 SaveProcessKnowledgeBaseRequest 的 RPC 入参。
func (r SaveProcessKnowledgeBaseRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateRequiredUserID(r.DataIsolation.UserID)
}

// Validate 校验 ShowKnowledgeBaseRequest 的 RPC 入参。
func (r ShowKnowledgeBaseRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateRequiredUserID(r.DataIsolation.UserID)
}

// Validate 校验 ListKnowledgeBaseRequest 的 RPC 入参。
func (r ListKnowledgeBaseRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateRequiredUserID(r.DataIsolation.UserID)
}

// Validate 校验 DestroyKnowledgeBaseRequest 的 RPC 入参。
func (r DestroyKnowledgeBaseRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateRequiredUserID(r.DataIsolation.UserID)
}

// Validate 校验 RebuildKnowledgeBaseRequest 的 RPC 入参。
func (r RebuildKnowledgeBaseRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateTargetDimensionIfPresent("target_dimension", r.TargetDimension); err != nil {
		return err
	}
	if err := validateIntIfPresentGEZero("concurrency", r.Concurrency); err != nil {
		return err
	}
	if err := validateBatchSizePositive("batch_size", r.BatchSize); err != nil {
		return err
	}
	return validateRetryIfPresent("retry", r.Retry)
}

// Validate 校验 RepairSourceBindingsRequest 的 RPC 入参。
func (r RepairSourceBindingsRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateOptionalStringSlice("organization_codes", r.OrganizationCodes); err != nil {
		return err
	}
	return validateBatchSizePositive("batch_size", r.BatchSize)
}

// Validate 校验 RebuildCleanupRequest 的 RPC 入参。
func (r RebuildCleanupRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 CreateDocumentRequest 的 RPC 入参。
func (r CreateDocumentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateRetrieveConfig(r.RetrieveConfig); err != nil {
		return err
	}
	if err := validateStrategyConfig(r.StrategyConfig); err != nil {
		return err
	}
	return validateFragmentConfig(r.FragmentConfig)
}

// Validate 校验 UpdateDocumentRequest 的 RPC 入参。
func (r UpdateDocumentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateRetrieveConfig(r.RetrieveConfig); err != nil {
		return err
	}
	if err := validateStrategyConfig(r.StrategyConfig); err != nil {
		return err
	}
	return validateFragmentConfig(r.FragmentConfig)
}

// Validate 校验 ShowDocumentRequest 的 RPC 入参。
func (r ShowDocumentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 GetOriginalFileLinkRequest 的 RPC 入参。
func (r GetOriginalFileLinkRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 ListDocumentRequest 的 RPC 入参。
func (r ListDocumentRequest) Validate() error {
	return validateStruct(r)
}

// Validate 校验 GetDocumentsByThirdFileIdRequest 的 RPC 入参。
func (r GetDocumentsByThirdFileIdRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 DestroyDocumentRequest 的 RPC 入参。
func (r DestroyDocumentRequest) Validate() error {
	return validateStruct(r)
}

// Validate 校验 SyncDocumentRequest 的 RPC 入参。
func (r SyncDocumentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateResolvedOrgCode("business_params.organization_code", r.BusinessParams.ResolveOrganizationCode())
}

// Validate 校验 ReVectorizedByThirdFileIdRequest 的 RPC 入参。
func (r ReVectorizedByThirdFileIdRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 NotifyProjectFileChangeRequest 的 RPC 入参。
func (r NotifyProjectFileChangeRequest) Validate() error {
	return validateStruct(r)
}

// Validate 校验 CountByKnowledgeBaseCodesRequest 的 RPC 入参。
func (r CountByKnowledgeBaseCodesRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateKnowledgeBaseCodes(r.KnowledgeBaseCodes)
}

// Validate 校验 CreateFragmentRequest 的 RPC 入参。
func (r CreateFragmentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 ShowFragmentRequest 的 RPC 入参。
func (r ShowFragmentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 ListFragmentRequest 的 RPC 入参。
func (r ListFragmentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 DestroyFragmentRequest 的 RPC 入参。
func (r DestroyFragmentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 SyncFragmentRequest 的 RPC 入参。
func (r SyncFragmentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateResolvedOrgCode("business_params.organization_code", r.BusinessParams.ResolveOrganizationCode())
}

// Validate 校验 SimilarityRequest 的 RPC 入参。
func (r SimilarityRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("business_params.organization_code", r.BusinessParams.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateSimilarityTopK(r.TopK)
}

// Validate 校验 RuntimeSimilarityRequest 的 RPC 入参。
func (r RuntimeSimilarityRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("business_params.organization_code", r.BusinessParams.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateStringSlice("knowledge_codes", r.KnowledgeCodes); err != nil {
		return err
	}
	return validateSimilarityTopK(r.TopK)
}

// Validate 校验 PreviewFragmentRequest 的 RPC 入参。
func (r PreviewFragmentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateStrategyConfig(r.StrategyConfig); err != nil {
		return err
	}
	return validateFragmentConfig(r.FragmentConfig)
}

// Validate 校验 RuntimeCreateFragmentRequest 的 RPC 入参。
func (r RuntimeCreateFragmentRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateResolvedOrgCode("business_params.organization_code", r.BusinessParams.ResolveOrganizationCode())
}

// Validate 校验 RuntimeDestroyByBusinessIDRequest 的 RPC 入参。
func (r RuntimeDestroyByBusinessIDRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// Validate 校验 RuntimeDestroyByMetadataFilterRequest 的 RPC 入参。
func (r RuntimeDestroyByMetadataFilterRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if len(r.MetadataFilter) == 0 {
		return invalidParams("metadata_filter is required")
	}
	return nil
}

// Validate 校验 ComputeEmbeddingRequest 的 RPC 入参。
func (r ComputeEmbeddingRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("business_params.organization_code", r.BusinessParams.ResolveOrganizationCode())
}

// Validate 校验 ComputeBatchEmbeddingRequest 的 RPC 入参。
func (r ComputeBatchEmbeddingRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("business_params.organization_code", r.BusinessParams.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateTexts("texts", r.Texts)
}

// Validate 校验 ListEmbeddingProvidersRequest 的 RPC 入参。
func (r ListEmbeddingProvidersRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("business_params.organization_code", r.BusinessParams.ResolveOrganizationCode())
}
