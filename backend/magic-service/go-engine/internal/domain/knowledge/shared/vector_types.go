package shared

// 共享向量语义定义。
const (
	// DefaultDenseVectorName 表示默认 dense named vector 名称。
	DefaultDenseVectorName = "dense_embedding"
	// DefaultSparseVectorName 表示默认 sparse named vector 名称。
	DefaultSparseVectorName = "sparse_terms"
	// DefaultSparseModelName 表示默认 Qdrant BM25 模型名称。
	DefaultSparseModelName = "qdrant/bm25"
	// SparseBackendClientBM25QdrantIDFV1 表示客户端构造 sparse vector、Qdrant 负责 IDF 的后端版本。
	SparseBackendClientBM25QdrantIDFV1 = "client_bm25_qdrant_idf_v1"
	// SparseBackendQdrantBM25ZHV1 表示中文优先的 Qdrant BM25 后端版本。
	SparseBackendQdrantBM25ZHV1 = "qdrant_bm25_zh_v1"
)

// VectorFilter 向量过滤条件（支持 must/should/must_not）。
type VectorFilter struct {
	Must    []FieldFilter `json:"must,omitempty"`
	Should  []FieldFilter `json:"should,omitempty"`
	MustNot []FieldFilter `json:"must_not,omitempty"`
}

// FieldFilter 单字段过滤条件。
type FieldFilter struct {
	Key   string `json:"key"`
	Match Match  `json:"match"`
}

// Match 匹配条件（等值/集合/范围）。
type Match struct {
	EqString  *string   `json:"eq_string,omitempty"`
	EqFloat   *float64  `json:"eq_float,omitempty"`
	EqBool    *bool     `json:"eq_bool,omitempty"`
	InStrings []string  `json:"in_strings,omitempty"`
	InFloats  []float64 `json:"in_floats,omitempty"`
	Range     *Range    `json:"range,omitempty"`
}

// Range 数值范围过滤。
type Range struct {
	Lt  *float64 `json:"lt,omitempty"`
	Gt  *float64 `json:"gt,omitempty"`
	Gte *float64 `json:"gte,omitempty"`
	Lte *float64 `json:"lte,omitempty"`
}

// VectorCollectionInfo 向量集合信息。
type VectorCollectionInfo struct {
	Name                string `json:"name"`
	VectorSize          int64  `json:"vector_size"`
	Points              int64  `json:"points"`
	HasNamedDenseVector bool   `json:"has_named_dense_vector"`
	HasSparseVector     bool   `json:"has_sparse_vector"`
}

// SparseVector 表示稀疏向量。
type SparseVector struct {
	Indices []uint32  `json:"indices,omitempty"`
	Values  []float32 `json:"values,omitempty"`
}

// SparseDocument 表示交给 Qdrant 推理的稀疏文本。
type SparseDocument struct {
	Text    string         `json:"text,omitempty"`
	Model   string         `json:"model,omitempty"`
	Options map[string]any `json:"options,omitempty"`
}

// SparseInput 表示一次 sparse 写入请求，可使用文档推理或手工 sparse vector 二选一。
type SparseInput struct {
	Document *SparseDocument `json:"document,omitempty"`
	Vector   *SparseVector   `json:"vector,omitempty"`
}

// DenseSearchRequest 表示 dense named vector 检索请求。
type DenseSearchRequest struct {
	Collection     string        `json:"collection"`
	VectorName     string        `json:"vector_name,omitempty"`
	Vector         []float64     `json:"vector,omitempty"`
	TopK           int           `json:"top_k"`
	ScoreThreshold float64       `json:"score_threshold"`
	Filter         *VectorFilter `json:"filter,omitempty"`
}

// SparseSearchRequest 表示 sparse named vector 检索请求。
type SparseSearchRequest struct {
	Collection     string          `json:"collection"`
	VectorName     string          `json:"vector_name,omitempty"`
	Document       *SparseDocument `json:"document,omitempty"`
	Vector         *SparseVector   `json:"vector,omitempty"`
	TopK           int             `json:"top_k"`
	ScoreThreshold float64         `json:"score_threshold"`
	Filter         *VectorFilter   `json:"filter,omitempty"`
}

// VectorSearchResult 向量搜索结果。
type VectorSearchResult[T any] struct {
	ID       string         `json:"id"`
	Score    float64        `json:"score"`
	Payload  T              `json:"payload"`
	Content  string         `json:"content"`
	Metadata map[string]any `json:"metadata"`
}
