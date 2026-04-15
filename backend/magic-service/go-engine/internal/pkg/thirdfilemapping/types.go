// Package thirdfilemapping 定义第三方 file_id 历史修复的共享类型。
package thirdfilemapping

// RepairGroupQuery 描述历史映射扫描条件。
type RepairGroupQuery struct {
	OrganizationCode string
	Offset           int
	Limit            int
}

// RepairGroup 描述一个 knowledge_code + third_file_id 分组。
type RepairGroup struct {
	KnowledgeCode            string
	ThirdFileID              string
	KnowledgeBaseID          string
	GroupRef                 string
	ThirdFileType            string
	DocumentCode             string
	DocumentName             string
	PreviewURL               string
	CreatedUID               string
	UpdatedUID               string
	FragmentCount            int64
	MissingDocumentCodeCount int64
}

// BackfillByThirdFileInput 描述按第三方文件批量回填 document_code 的条件。
type BackfillByThirdFileInput struct {
	OrganizationCode string
	KnowledgeCode    string
	ThirdFileID      string
	DocumentCode     string
}
