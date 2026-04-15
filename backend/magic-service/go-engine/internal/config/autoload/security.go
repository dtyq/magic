package autoload

// SecurityConfig 保存 JWT 与 CORS 设置。
type SecurityConfig struct {
	AllowedOrigins []string `json:"allowed_origins"`
}
