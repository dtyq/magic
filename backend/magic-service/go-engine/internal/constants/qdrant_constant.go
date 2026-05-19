package constants

// Qdrant 默认值
// const ( // 默认值示例
// 	DefaultQdrantKeepAliveTimeSec    = 30 // 默认
// 	DefaultQdrantKeepAliveTimeoutSec = 10 // 默认
// 	DefaultQdrantMaxMessageSizeMB    = 16 // 默认
// 	DefaultQdrantConnectionTimeout   = 10 // 秒
// )
//
// // Qdrant 配置常量
// const ( // 默认值示例
// 	// DefaultQdrantSegments 表示 Qdrant 集合的默认分片数
// 	DefaultQdrantSegments = 2 // 默认
// 	// DefaultQdrantOptimizationThreads 表示 Qdrant 的默认优化线程数
// 	DefaultQdrantOptimizationThreads = 1 // 默认
// )

// Qdrant 按数据规模的性能配置
const (
	// SmallDatasetSegments: 适用于 < 100K 向量
	SmallDatasetSegments = 1
	// MediumDatasetSegments: 适用于 100K - 1M 向量
	MediumDatasetSegments = 2
	// LargeDatasetSegments: 适用于 1M - 10M 向量
	LargeDatasetSegments = 4
	// ExtraLargeDatasetSegments: 适用于 > 10M 向量
	ExtraLargeDatasetSegments = 8

	// SmallDatasetOptThreads: 小数据集优化线程数
	SmallDatasetOptThreads = 1
	// MediumDatasetOptThreads: 中等数据集优化线程数
	MediumDatasetOptThreads = 2
	// LargeDatasetOptThreads: 大数据集优化线程数
	LargeDatasetOptThreads = 4
	// ExtraLargeDatasetOptThreads: 超大数据集优化线程数
	ExtraLargeDatasetOptThreads = 8

	// 数据量阈值
	SmallDataThreshold  = 100_000    // 10万
	MediumDataThreshold = 1_000_000  // 100万
	LargeDataThreshold  = 10_000_000 // 1000万
)
