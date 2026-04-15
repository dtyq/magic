package autoload

// StorageConfig 存储配置
type StorageConfig struct {
	Endpoint  string `json:"endpoint"`
	Region    string `json:"region"`
	Identity  string `mapstructure:"accessKey" json:"identity"`
	Signature string `mapstructure:"secretKey" json:"signature"`
	Bucket    string `json:"bucket"`
	Type      string `json:"type"`
}
