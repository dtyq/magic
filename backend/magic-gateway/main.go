package main

import (
	"api-gateway/internal/handler"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync/atomic"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
)

// 全局变量
var (
	jwtSecret   []byte
	jwtSecretID string // 密钥版本标识
	envVars     map[string]string
	logger      *log.Logger
	debugMode   bool
	ctx         = context.Background()

	// 支持的服务列表
	supportedServices = []string{"OPENAI", "MAGIC", "DEEPSEEK"}

	// 全局令牌版本计数器（用于吊销）
	tokenVersionCounter int64 = 0

	// 全局吊销时间戳
	globalRevokeTimestamp int64 = 0

	// JWT相关安全配置
	keyRotationInterval = 24 * time.Hour // 密钥轮换间隔
	lastKeyRotation     time.Time

	// 预编译的正则表达式
	byteAPMAppKeyRegex = regexp.MustCompile(`X-ByteAPM-AppKey=[^\s,;]*`)

	// URL白名单规则
	allowedTargetRules []*TargetURLRule

	// 特殊API配置：需要在请求体中替换API密钥的服务
	specialApiKeys map[string]string

	// 安全限制
	maxRequestBodySize  int64 = 10 * 1024 * 1024  // 10MB 请求体限制
	maxResponseBodySize int64 = 100 * 1024 * 1024 // 100MB 响应体限制
)

// JWTClaims 定义JWT的声明 - 增强版
type JWTClaims struct {
	jwt.RegisteredClaims
	ContainerID           string `json:"container_id"`
	MagicUserID           string `json:"magic_user_id,omitempty"`
	MagicOrganizationCode string `json:"magic_organization_code,omitempty"`
	// 添加令牌版本用于吊销
	TokenVersion int64 `json:"token_version"`
	// 添加创建时间
	CreatedAt int64 `json:"created_at"`
	// 添加安全相关字段
	KeyID string `json:"kid,omitempty"`   // 密钥版本标识
	Nonce string `json:"nonce,omitempty"` // 防重放攻击
	Scope string `json:"scope,omitempty"` // 权限范围
}

// ServiceInfo 存储服务配置信息
type ServiceInfo struct {
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	ApiKey  string `json:"api_key,omitempty"`
	Model   string `json:"default_model,omitempty"`
}

// 初始化JWT安全配置 - 从MAGIC_GATEWAY_API_KEY获取密钥
func initJWTSecurity() {
	// 从MAGIC_GATEWAY_API_KEY获取JWT密钥
	apiKey := getEnvWithDefault("MAGIC_GATEWAY_API_KEY", "")
	if apiKey == "" {
		logger.Fatal("错误: 必须设置MAGIC_GATEWAY_API_KEY环境变量")
	}

	// 验证API密钥强度
	// if len(apiKey) < 32 {
	// 	logger.Printf("警告: MAGIC_GATEWAY_API_KEY长度不足，建议至少32字符")
	// }

	// 使用API密钥作为JWT密钥
	jwtSecret = []byte(apiKey)

	// 创建密钥版本标识（使用API密钥的哈希）
	hash := sha256.Sum256([]byte(apiKey))
	jwtSecretID = hex.EncodeToString(hash[:8]) // 使用前8字节作为版本标识

	lastKeyRotation = time.Now()

	logger.Printf("JWT安全配置已初始化，使用MAGIC_GATEWAY_API_KEY作为密钥")
}

// 生成防重放攻击的随机数
func generateNonce() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// sanitizeLogString 清理用户输入以防止日志注入攻击
func sanitizeLogString(s string) string {
	// 移除换行符和回车符以防止日志注入
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "\\r")
	// 限制长度以防止日志洪水攻击
	if len(s) > 200 {
		s = s[:200] + "...[truncated]"
	}
	return s
}

// maskSensitiveValue 对敏感值进行掩码处理用于日志记录（仅显示前4个和后4个字符）
func maskSensitiveValue(s string) string {
	if len(s) <= 8 {
		return "***"
	}
	return s[:4] + "***" + s[len(s)-4:]
}

// 检查密钥轮换
func checkKeyRotation() {
	if time.Since(lastKeyRotation) > keyRotationInterval {
		// 这里可以实现密钥轮换逻辑
		logger.Printf("密钥轮换检查: 当前密钥已使用 %v", time.Since(lastKeyRotation))
	}
}

// loadEnvFile 尝试从多个位置加载 .env 文件
func loadEnvFile() error {
	// 尝试多个位置查找 .env 文件
	envPaths := []string{
		".env",                    // 当前工作目录
		filepath.Join(".", ".env"), // 显式当前目录
	}

	// 尝试获取可执行文件目录并在那里查找 .env
	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		envPaths = append(envPaths, filepath.Join(exeDir, ".env"))
		// 也尝试父目录（以防可执行文件在子目录中）
		envPaths = append(envPaths, filepath.Join(filepath.Dir(exeDir), ".env"))
	}

	// 尝试获取当前工作目录
	if wd, err := os.Getwd(); err == nil {
		envPaths = append(envPaths, filepath.Join(wd, ".env"))
		// 尝试父目录
		envPaths = append(envPaths, filepath.Join(filepath.Dir(wd), ".env"))
	}

	// 尝试每个路径
	var lastErr error
	for _, envPath := range envPaths {
		err := godotenv.Load(envPath)
		if err == nil {
			logger.Printf("成功加载.env文件: %s", envPath)
			return nil
		}
		lastErr = err
	}

	// 如果所有尝试都失败，返回最后一个错误
	return lastErr
}

// 初始化函数
func init() {
	// 设置日志
	logger = log.New(os.Stdout, "[API网关] ", log.LstdFlags)
	logger.Println("初始化服务...")

	// 加载.env文件（支持多个位置）
	err := loadEnvFile()
	if err != nil {
		// 始终记录警告，不仅仅在调试模式下，以便用户知道 .env 文件未加载
		logger.Printf("警告: 无法加载.env文件: %v (将仅使用系统环境变量)", err)
	} else {
		logger.Println("已成功加载.env文件")
	}

	// 初始化JWT安全配置
	initJWTSecurity()

	// 缓存环境变量
	envVars = make(map[string]string)
	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			envVars[parts[0]] = parts[1]
		}
	}

	// 设置调试模式
	debugMode = getEnvWithDefault("MAGIC_GATEWAY_DEBUG", "false") == "true"
	if debugMode {
		logger.Println("调试模式已启用")
	}

	// 加载URL白名单
	loadAllowedTargetURLs()

	// 加载特殊API配置
	loadSpecialApiKeys()

	logger.Printf("已加载 %d 个环境变量", len(envVars))
}

// 辅助函数：获取环境变量，如果不存在则使用默认值
func getEnvWithDefault(key, defaultValue string) string {
	value, exists := os.LookupEnv(key)
	if !exists {
		return defaultValue
	}
	return value
}

// loadSpecialApiKeys 从环境变量加载特殊API配置
// 这些API需要在请求体中自动替换API密钥
func loadSpecialApiKeys() {
	specialApiKeys = make(map[string]string)

	// 从环境变量 MAGIC_GATEWAY_SPECIAL_API_KEYS 读取配置
	// 格式: BASE_URL_KEY:API_KEY_KEY|BASE_URL_KEY2:API_KEY_KEY2
	// 例如: TEXT_TO_IMAGE_API_BASE_URL:TEXT_TO_IMAGE_ACCESS_KEY|VOICE_UNDERSTANDING_API_BASE_URL:VOICE_UNDERSTANDING_API_KEY
	configStr := getEnvWithDefault("MAGIC_GATEWAY_SPECIAL_API_KEYS", "")

	if configStr == "" {
		// 未配置特殊API密钥
		specialApiKeys = make(map[string]string)
		logger.Printf("未配置特殊API，如需启用请设置 MAGIC_GATEWAY_SPECIAL_API_KEYS 环境变量")
		logger.Printf("格式示例: BASE_URL_KEY:API_KEY_KEY|BASE_URL_KEY2:API_KEY_KEY2")
		return
	}

	// 解析配置字符串
	pairs := strings.Split(configStr, "|")
	for _, pair := range pairs {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}

		parts := strings.Split(pair, ":")
		if len(parts) != 2 {
			logger.Printf("警告: 特殊API配置格式错误: %s (应为 BASE_URL_KEY:API_KEY_KEY)", pair)
			continue
		}

		baseUrlKey := strings.TrimSpace(parts[0])
		apiKeyKey := strings.TrimSpace(parts[1])

		if baseUrlKey == "" || apiKeyKey == "" {
			logger.Printf("警告: 特殊API配置为空: %s", pair)
			continue
		}

		specialApiKeys[baseUrlKey] = apiKeyKey
	}

	logger.Printf("已加载特殊API配置: %d 个", len(specialApiKeys))
	if debugMode {
		for baseUrl, apiKey := range specialApiKeys {
			logger.Printf("  - %s => %s", sanitizeLogString(baseUrl), sanitizeLogString(apiKey))
		}
	}
}

// 主函数
func main() {
	// 设置服务端口
	port := getEnvWithDefault("MAGIC_GATEWAY_PORT", "8000")

	// 初始化GPG签名处理器
	signHandler, err := handler.NewSignHandler(logger)
	if err != nil {
		logger.Fatalf("Failed to initialize GPG sign handler: %v", err)
	}

	// 初始化用户信息处理器
	userHandler := handler.NewUserHandler(logger)

	// 注册签名路由 (需要认证)
	http.HandleFunc("/api/ai-generated/sign", withAuth(signHandler.Sign))
	logger.Println("GPG signing service enabled:")
	logger.Println("  - Unified signing at: /api/ai-generated/sign")

	// 注册用户信息路由 (需要认证)
	http.HandleFunc("/api/user/info", withAuth(userHandler.GetUserInfo))
	logger.Println("User info service enabled:")
	logger.Println("  - User info at: /api/user/info")

	// 注册路由
	http.HandleFunc("/auth", authHandler)
	http.HandleFunc("/env", envHandler)
	http.HandleFunc("/status", statusHandler)
	http.HandleFunc("/revoke", revokeHandler)
	http.HandleFunc("/revoke-all", revokeAllTokensHandler) // 新增吊销所有令牌的端点
	http.HandleFunc("/services", servicesHandler)
	http.HandleFunc("/", proxyHandler)

	// 启动服务器
	serverAddr := fmt.Sprintf(":%s", port)
	logger.Printf("API网关服务启动于 http://localhost%s", serverAddr)
	logger.Fatal(http.ListenAndServe(serverAddr, nil))
}

// 可用服务处理程序
func servicesHandler(w http.ResponseWriter, r *http.Request) {
	// 需要认证
	handler := withAuth(func(w http.ResponseWriter, r *http.Request) {
		// 在调试模式下记录完整请求信息
		if debugMode {
			logger.Printf("SERVICES请求:")
			logFullRequest(r)
		}

		containerID := r.Header.Get("X-Container-ID")
		magicUserID := r.Header.Get("magic-user-id")
		magicOrganizationCode := r.Header.Get("magic-organization-code")

		// 如果X-Container-ID为空但magic-user-id存在，使用magic-user-id
		if containerID == "" && magicUserID != "" {
			containerID = magicUserID
		}

		logger.Printf("服务列表请求来自容器: %s, 用户: %s, 组织: %s", containerID, magicUserID, magicOrganizationCode)

		// 获取可用服务列表
		services := []ServiceInfo{}

		for _, service := range supportedServices {
			baseUrlKey := fmt.Sprintf("%s_API_BASE_URL", service)
			apiKeyExists := false
			modelKey := fmt.Sprintf("%s_MODEL", service)

			baseUrl, hasBaseUrl := envVars[baseUrlKey]

			// 检查是否存在API密钥
			apiKeyKey := fmt.Sprintf("%s_API_KEY", service)
			_, apiKeyExists = envVars[apiKeyKey]

			// 如果有基础URL和API密钥，则添加到服务列表
			if hasBaseUrl && apiKeyExists {
				// 不返回真实的API密钥，只返回服务信息
				serviceInfo := ServiceInfo{
					Name:    service,
					BaseURL: strings.Split(baseUrl, "/")[2], // 只返回域名部分
				}

				// 如果存在默认模型，也包含在结果中
				if model, hasModel := envVars[modelKey]; hasModel {
					serviceInfo.Model = model
				}

				services = append(services, serviceInfo)
			}
		}

		result := map[string]interface{}{
			"available_services": services,
			"message":            "可以通过API代理请求使用这些服务，使用格式: /{service}/path 或 使用 env: 引用",
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	handler(w, r)
}

// 认证处理程序 - 修改为无状态认证
func authHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	// 在调试模式下记录完整请求信息
	if debugMode {
		logger.Printf("AUTH请求:")
		logFullRequest(r)
	}

	// 检查请求是否来自本地主机
	clientIP := r.RemoteAddr
	logger.Printf("认证请求来自原始地址: %s", clientIP)

	// 提取IP地址部分（去除端口）
	// 处理IPv6和IPv4格式
	if strings.HasPrefix(clientIP, "[") {
		// IPv6格式: [::1]:12345
		ipEnd := strings.LastIndex(clientIP, "]")
		if ipEnd > 0 {
			clientIP = clientIP[1:ipEnd]
		}
	} else if strings.Contains(clientIP, ":") {
		// IPv4格式: 127.0.0.1:12345
		clientIP = strings.Split(clientIP, ":")[0]
	}

	logger.Printf("提取的客户端IP: %s", clientIP)

	// 验证 Gateway API Key (使用常量时间比较防止时序攻击)
	gatewayAPIKey := r.Header.Get("X-Gateway-API-Key")
	expectedAPIKey := string(jwtSecret) // 直接使用JWT密钥作为期望的API密钥

	if gatewayAPIKey == "" || subtle.ConstantTimeCompare([]byte(gatewayAPIKey), []byte(expectedAPIKey)) != 1 {
		logger.Printf("API密钥验证失败: 提供的密钥不匹配或为空")
		http.Error(w, "无效的API密钥", http.StatusUnauthorized)
		return
	}

	// 获取用户ID
	userID := r.Header.Get("X-USER-ID")
	magicUserID := r.Header.Get("magic-user-id")
	magicOrganizationCode := r.Header.Get("magic-organization-code")
	if userID == "" && magicUserID != "" {
		userID = magicUserID
	}

	if userID == "" {
		userID = "default-user"
	}

	if magicOrganizationCode == "" {
		magicOrganizationCode = ""
	}

	logger.Printf("认证请求来自本地用户: %s, 组织: %s", userID, magicOrganizationCode)

	// 检查密钥轮换
	checkKeyRotation()

	// 生成防重放攻击的随机数
	nonce := generateNonce()

	// 创建唯一标识
	tokenID := fmt.Sprintf("%d-%s", time.Now().UnixNano(), userID)

	// 增加令牌版本
	atomic.AddInt64(&tokenVersionCounter, 1)
	currentVersion := atomic.LoadInt64(&tokenVersionCounter)

	// 创建JWT声明
	claims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        tokenID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30天后过期
			NotBefore: jwt.NewNumericDate(time.Now()),                          // 立即生效
		},
		ContainerID:           userID, // 保持字段名不变，但存储用户ID
		MagicUserID:           magicUserID,
		MagicOrganizationCode: magicOrganizationCode,
		TokenVersion:          currentVersion,
		CreatedAt:             time.Now().Unix(),
		KeyID:                 jwtSecretID,
		Nonce:                 nonce,
		Scope:                 "api_gateway", // 定义权限范围
	}

	// 创建令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 设置头部信息
	token.Header["kid"] = jwtSecretID
	token.Header["alg"] = "HS256"
	token.Header["typ"] = "JWT"

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		logger.Printf("生成令牌失败: %v", err)
		http.Error(w, "生成令牌失败", http.StatusInternalServerError)
		return
	}

	logger.Printf("生成安全令牌 (版本: %d, 密钥版本: %s) 用户: %s", currentVersion, jwtSecretID, userID)

	// 返回令牌
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token":    tokenString,
		"header":   "Magic-Authorization",
		"example":  fmt.Sprintf("Magic-Authorization: Bearer %s", tokenString),
		"note":     "请确保在使用令牌时添加Bearer前缀，否则网关将自动添加",
		"security": "令牌包含防重放保护和密钥版本控制",
	})
}

// 验证令牌函数 - 修改为无状态验证
func validateToken(tokenString string) (*JWTClaims, bool) {
	// 移除Bearer前缀
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	// 解析令牌，包括验证过期时间
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名算法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("意外的签名方法: %v", token.Header["alg"])
		}

		// 验证密钥版本
		if kid, ok := token.Header["kid"].(string); ok {
			if kid != jwtSecretID {
				return nil, fmt.Errorf("密钥版本不匹配: %s", kid)
			}
		}

		return jwtSecret, nil
	}) // 现在验证标准声明，包括过期时间验证

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			logger.Printf("令牌已过期")
		} else {
			//如果开启debug 打印完整的错误信息
			if debugMode {
				//打印token
				logger.Printf("token: %s", tokenString)
				logger.Printf("完整的错误信息: %+v", err)
			}
			logger.Printf("令牌验证错误: %v", err)
		}
		return nil, false
	}

	// 提取声明
	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		// 检查令牌是否在全局吊销时间之后创建
		if claims.CreatedAt < atomic.LoadInt64(&globalRevokeTimestamp) {
			logger.Printf("令牌已被全局吊销")
			return nil, false
		}

		// 验证权限范围
		if claims.Scope != "api_gateway" {
			logger.Printf("令牌权限范围无效: %s", claims.Scope)
			return nil, false
		}

		// 验证密钥版本
		if claims.KeyID != jwtSecretID {
			logger.Printf("令牌密钥版本不匹配: %s", claims.KeyID)
			return nil, false
		}

		return claims, true
	}

	return nil, false
}

// 中间件：验证令牌
func withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 获取令牌（优先使用Magic-Authorization头，其次使用标准Authorization头）
		authHeader := r.Header.Get("Magic-Authorization")
		if authHeader == "" {
			// 如果Magic-Authorization不存在，尝试标准Authorization头
			authHeader = r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "需要授权", http.StatusUnauthorized)
				return
			}

			// 检查标准Authorization头是否包含Bearer前缀
			if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
				// 如果没有Bearer前缀，则自动添加
				authHeader = "Bearer " + authHeader
				if debugMode {
					logger.Printf("自动为Authorization头添加Bearer前缀: %s", authHeader)
				}
			}
		} else {
			// 检查Magic-Authorization头是否包含Bearer前缀
			if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
				// 如果没有Bearer前缀，则自动添加
				authHeader = "Bearer " + authHeader
				if debugMode {
					//logger.Printf("自动为Magic-Authorization头添加Bearer前缀: %s", authHeader)
				}
			}
		}

		// 验证令牌
		claims, valid := validateToken(authHeader)
		if !valid {
			http.Error(w, "无效或过期的令牌", http.StatusUnauthorized)
			return
		}

		// 将令牌信息存储在请求上下文中
		r.Header.Set("X-User-Id", claims.ContainerID)
		r.Header.Set("magic-user-id", claims.MagicUserID)
		r.Header.Set("magic-organization-code", claims.MagicOrganizationCode)

		// 将JWT claims存储到请求上下文中，供后续处理程序使用
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		r = r.WithContext(ctx)

		// 调用下一个处理程序
		next(w, r)
	}
}

// 环境变量处理程序
func envHandler(w http.ResponseWriter, r *http.Request) {
	// 需要认证
	handler := withAuth(func(w http.ResponseWriter, r *http.Request) {
		// 在调试模式下记录完整请求信息
		if debugMode {
			logger.Printf("ENV请求:")
			logFullRequest(r)
		}

		// 获取请求的环境变量
		varsParam := r.URL.Query().Get("vars")
		userID := r.Header.Get("X-USER-ID")
		magicUserID := r.Header.Get("magic-user-id")
		magicOrganizationCode := r.Header.Get("magic-organization-code")

		// 如果X-USER-ID为空但magic-user-id存在，使用magic-user-id
		if userID == "" && magicUserID != "" {
			userID = magicUserID
		}

		logger.Printf("环境变量请求来自用户 %s, 组织: %s, 变量: %s", userID, magicOrganizationCode, varsParam)

		// 不再返回实际的环境变量值，而是返回可用的环境变量名称列表
		allowedVarNames := getAvailableEnvVarNames()

		// 如果请求了特定变量，只返回这些变量在可用列表中的存在状态
		var result map[string]interface{}

		if varsParam == "" {
			// 返回所有可用的环境变量名称
			result = map[string]interface{}{
				"available_vars": allowedVarNames,
				"message":        "不允许直接获取环境变量值，请通过API代理请求使用这些变量",
			}
		} else {
			// 返回请求的特定变量是否可用
			requestedVars := strings.Split(varsParam, ",")
			availableMap := make(map[string]bool)

			for _, varName := range requestedVars {
				varName = strings.TrimSpace(varName)
				// 检查变量是否在可用列表中
				found := false
				for _, allowedVar := range allowedVarNames {
					if varName == allowedVar {
						found = true
						break
					}
				}
				availableMap[varName] = found
			}

			result = map[string]interface{}{
				"available_status": availableMap,
				"message":          "不允许直接获取环境变量值，请通过API代理请求使用这些变量",
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	handler(w, r)
}

// getEnvVarBlacklist 从环境变量或默认值返回黑名单模式
func getEnvVarBlacklist() []string {
	blacklistStr := getEnvWithDefault("MAGIC_GATEWAY_ENV_BLACKLIST", "")
	if blacklistStr == "" {
		// 默认黑名单模式
		return []string{
			"MAGIC_GATEWAY_API_KEY",
			"JWT_SECRET",
			"SECRET",
			"PASSWORD",
			"PRIVATE_KEY",
			"CREDENTIAL",
		}
	}
	return strings.Split(blacklistStr, ",")
}

// getEnvVarWhitelistPrefixes 从环境变量返回白名单前缀
func getEnvVarWhitelistPrefixes() []string {
	whitelistStr := getEnvWithDefault("MAGIC_GATEWAY_ENV_WHITELIST_PREFIXES", "")
	if whitelistStr == "" {
		logger.Printf("警告: 未配置 MAGIC_GATEWAY_ENV_WHITELIST_PREFIXES，环境变量访问将被限制")
		return []string{}
	}

	// 如果存在，移除周围的引号
	whitelistStr = strings.Trim(whitelistStr, `"'`)

	prefixes := strings.Split(whitelistStr, ",")
	result := make([]string, 0, len(prefixes))

	// 去除空格和引号，过滤空字符串
	for _, prefix := range prefixes {
		prefix = strings.TrimSpace(prefix)
		prefix = strings.Trim(prefix, `"'`)
		if prefix != "" {
			result = append(result, prefix)
		}
	}

	if len(result) == 0 {
		logger.Printf("警告: MAGIC_GATEWAY_ENV_WHITELIST_PREFIXES 配置为空或无效")
	}

	return result
}

// isEnvVarAllowed 检查是否允许访问某个环境变量
func isEnvVarAllowed(varName string) bool {
	// 首先检查黑名单
	blacklist := getEnvVarBlacklist()
	varNameUpper := strings.ToUpper(varName)
	for _, blocked := range blacklist {
		if strings.Contains(varNameUpper, strings.ToUpper(blocked)) {
			return false
		}
	}

	// 检查白名单前缀
	allowedPrefixes := getEnvVarWhitelistPrefixes()
	if len(allowedPrefixes) == 0 {
		// 未配置白名单，拒绝访问
		return false
	}

	for _, prefix := range allowedPrefixes {
		if strings.HasPrefix(varName, prefix) {
			return true
		}
	}

	return false
}

// 获取可用的环境变量名称
func getAvailableEnvVarNames() []string {
	allowedVarNames := []string{}

	for key := range envVars {
		if isEnvVarAllowed(key) {
			allowedVarNames = append(allowedVarNames, key)
		}
	}

	return allowedVarNames
}

// 状态处理程序 - 修改为无状态认证
func statusHandler(w http.ResponseWriter, r *http.Request) {
	// 在调试模式下记录完整请求信息
	if debugMode {
		logger.Printf("STATUS请求:")
		logFullRequest(r)
	}

	// 获取可用的环境变量名称
	allowedVarNames := getAvailableEnvVarNames()

	// 获取可用的服务
	availableServices := []string{}
	for _, service := range supportedServices {
		baseUrlKey := fmt.Sprintf("%s_API_BASE_URL", service)
		apiKeyKey := fmt.Sprintf("%s_API_KEY", service)

		if _, hasBaseUrl := envVars[baseUrlKey]; hasBaseUrl {
			if _, hasApiKey := envVars[apiKeyKey]; hasApiKey {
				availableServices = append(availableServices, service)
			}
		}
	}

	// 返回状态信息
	status := map[string]interface{}{
		"status":                  "ok",
		"version":                 getEnvWithDefault("API_GATEWAY_VERSION", "1.0.0"),
		"auth_mode":               "stateless_jwt",
		"token_validity":          "30天",
		"env_vars_available":      allowedVarNames,
		"services_available":      availableServices,
		"current_token_version":   atomic.LoadInt64(&tokenVersionCounter),
		"global_revoke_timestamp": atomic.LoadInt64(&globalRevokeTimestamp),
		"jwt_key_id":              jwtSecretID,
		"jwt_algorithm":           "HS256",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// 吊销令牌处理程序 - 修改为基于版本吊销
func revokeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	// 需要认证
	handler := withAuth(func(w http.ResponseWriter, r *http.Request) {
		// 在调试模式下记录完整请求信息
		if debugMode {
			logger.Printf("REVOKE请求:")
			logFullRequest(r)
		}

		// 解析请求体
		var requestBody struct {
			TokenID string `json:"token_id"`
		}

		err := json.NewDecoder(r.Body).Decode(&requestBody)
		if err != nil {
			http.Error(w, "请求体无效", http.StatusBadRequest)
			return
		}

		// 对于无状态认证，我们无法吊销单个令牌
		// 但可以设置全局吊销时间戳来吊销所有令牌
		logger.Printf("单个令牌吊销请求: %s (无状态认证不支持单个吊销)", requestBody.TokenID)

		// 返回成功
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "无状态认证模式下，请使用 /revoke-all 端点吊销所有令牌",
		})
	})

	handler(w, r)
}

// 吊销所有令牌处理程序
func revokeAllTokensHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	// 需要认证
	handler := withAuth(func(w http.ResponseWriter, r *http.Request) {
		// 在调试模式下记录完整请求信息
		if debugMode {
			logger.Printf("REVOKE_ALL请求:")
			logFullRequest(r)
		}

		// 设置全局吊销时间戳为当前时间
		atomic.StoreInt64(&globalRevokeTimestamp, time.Now().Unix())

		logger.Printf("已吊销所有令牌")

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":          true,
			"message":          "所有令牌已被吊销",
			"revoke_timestamp": atomic.LoadInt64(&globalRevokeTimestamp),
		})
	})

	handler(w, r)
}

// 清理过期令牌 - 无状态认证不需要清理
func cleanupExpiredTokens() {
	// 无状态认证模式下，JWT会自动处理过期
	// 无需手动清理
}

// 获取服务信息
func getServiceInfo(service string) (string, string, bool) {
	baseUrlKey := fmt.Sprintf("%s_API_BASE_URL", strings.ToUpper(service))
	apiKeyKey := fmt.Sprintf("%s_API_KEY", strings.ToUpper(service))

	baseUrl, baseUrlExists := envVars[baseUrlKey]
	apiKey, apiKeyExists := envVars[apiKeyKey]

	if baseUrlExists && apiKeyExists {
		return baseUrl, apiKey, true
	}

	return "", "", false
}

// API代理处理程序
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	// 排除特定端点
	path := strings.Trim(r.URL.Path, "/")
	if path == "auth" || path == "env" || path == "status" || path == "revoke" || path == "revoke-all" || path == "services" {
		http.Error(w, "无效的端点", http.StatusNotFound)
		return
	}

	// 需要认证
	handler := withAuth(func(w http.ResponseWriter, r *http.Request) {
		// 从JWT claims中获取用户信息
		userID := r.Header.Get("X-USER-ID")
		// 从请求头中获取magic-task-id 和magic-topic-id
		magicTaskID := r.Header.Get("magic-task-id")
		magicTopicID := r.Header.Get("magic-topic-id")
		magicChatTopicID := r.Header.Get("magic-chat-topic-id")
		magicLanguage := r.Header.Get("magic-language")

		// 优先从原始请求头获取，避免被JWT覆盖
		magicUserID := r.Header.Get("magic-user-id")
		magicOrganizationCode := r.Header.Get("magic-organization-code")

		// 从请求上下文中获取JWT claims作为fallback
		if claims, ok := r.Context().Value("jwt_claims").(*JWTClaims); ok {
			// 只有当原始请求头中没有值时，才使用JWT中的值
			if magicUserID == "" {
				magicUserID = claims.MagicUserID
			}
			if magicOrganizationCode == "" {
				magicOrganizationCode = claims.MagicOrganizationCode
			}
		}

		if userID != "" {
			magicUserID = userID
		}

		if debugMode {
			logger.Printf("原始请求头 magic-user-id: %s", r.Header.Get("magic-user-id"))
			logger.Printf("原始请求头 magic-organization-code: %s", r.Header.Get("magic-organization-code"))
			logger.Printf("最终使用的 magicUserID: %s", magicUserID)
			logger.Printf("最终使用的 magicOrganizationCode: %s", magicOrganizationCode)
		}

		logger.Printf("代理请求来自用户: %s, 组织: %s, 路径: %s",
			sanitizeLogString(userID),
			sanitizeLogString(magicOrganizationCode),
			sanitizeLogString(path))

		// 在调试模式下记录完整请求信息
		if debugMode {
			logger.Printf("PROXY请求:")
			logFullRequest(r)
		}

		// 限制请求体大小以防止DoS攻击
		r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodySize)

		// 读取请求体
		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			if err.Error() == "http: request body too large" {
				http.Error(w, "请求体过大，最大限制为10MB", http.StatusRequestEntityTooLarge)
			} else {
				http.Error(w, "读取请求体失败", http.StatusInternalServerError)
			}
			return
		}
		r.Body.Close()

		// 确定目标服务URL（先确定目标，再决定是否处理body）
		targetBase := r.URL.Query().Get("target")

		var targetApiKey string
		shouldAddApiKey := false

		// 0. 检查是否直接使用环境变量名作为URL路径前缀
		if targetBase == "" {
			pathParts := strings.SplitN(path, "/", 2)
			envVarName := pathParts[0]
			remainingPath := ""
			if len(pathParts) > 1 {
				remainingPath = pathParts[1]
			}

			// 验证环境变量名是否允许访问
			if !isEnvVarAllowed(envVarName) {
				logger.Printf("拒绝访问未授权的环境变量: %s", sanitizeLogString(envVarName))
				http.Error(w, "Not Found", http.StatusNotFound)
				return
			}

			// 检查是否是环境变量名
			if envVarValue, exists := envVars[envVarName]; exists {
				targetBase = envVarValue
				path = remainingPath
				logger.Printf("通过环境变量名称访问: %s", sanitizeLogString(envVarName))

				// 如果是API_BASE_URL类型的变量，尝试找到对应的API_KEY
				if strings.HasSuffix(envVarName, "_API_BASE_URL") {
					servicePrefix := strings.TrimSuffix(envVarName, "_API_BASE_URL")
					apiKeyVarName := servicePrefix + "_API_KEY"

					if apiKey, exists := envVars[apiKeyVarName]; exists {
						targetApiKey = apiKey
						shouldAddApiKey = true
						logger.Printf("找到对应的API密钥: %s", sanitizeLogString(apiKeyVarName))
					}
				}
			}
		}

		// 1. 检查是否是直接引用服务名称的模式 "/service/path"
		if targetBase == "" && strings.Contains(path, "/") {
			parts := strings.SplitN(path, "/", 2)
			serviceName := strings.ToUpper(parts[0])

			// 检查是否是支持的服务
			for _, supportedService := range supportedServices {
				if serviceName == supportedService {
					if baseUrl, apiKey, found := getServiceInfo(serviceName); found {
						targetBase = baseUrl
						targetApiKey = apiKey
						path = parts[1]
						shouldAddApiKey = true
						logger.Printf("直接服务路径请求: %s => %s", serviceName, targetBase)
						break
					}
				}
			}
		}

		// 2. 如果没有通过服务名称找到目标，尝试从查询参数中获取服务名
		if targetBase == "" {
			serviceName := r.URL.Query().Get("service")
			if serviceName != "" {
				if baseUrl, apiKey, found := getServiceInfo(serviceName); found {
					targetBase = baseUrl
					targetApiKey = apiKey
					shouldAddApiKey = true
					logger.Printf("通过查询参数请求服务: %s => %s", serviceName, targetBase)
				}
			}
		}

		// 3. 如果仍未找到目标，尝试从路径中提取服务名用于环境变量查找
		if targetBase == "" && strings.Contains(path, "/") {
			serviceName := strings.SplitN(path, "/", 2)[0]
			envVarName := fmt.Sprintf("%s_API_URL", strings.ToUpper(serviceName))
			if envValue, exists := envVars[envVarName]; exists {
				targetBase = envValue
				path = strings.SplitN(path, "/", 2)[1]
				logger.Printf("从环境变量获取目标URL: %s=%s", envVarName, targetBase)

				// 尝试获取对应的API密钥
				apiKeyVarName := fmt.Sprintf("%s_API_KEY", strings.ToUpper(serviceName))
				if apiKey, exists := envVars[apiKeyVarName]; exists {
					targetApiKey = apiKey
					shouldAddApiKey = true
				}
			}
		}

		// 替换URL中的环境变量（必须在验证之前执行）
		targetBase = replaceEnvVarsInString(targetBase)

		// 根据白名单验证目标URL，提供详细错误信息
		if err := validateTargetURL(targetBase); err != nil {
			logger.Printf("拒绝访问未授权的目标URL: %s, 原因: %v", targetBase, err)
			http.Error(w, "Not Found", http.StatusNotFound)
			return
		}
		logger.Printf("目标URL验证通过: %s", targetBase)

		// 检查是否是特定API之一，只对这些API进行body替换
		isSpecialAPI := false
		for baseUrlKey := range specialApiKeys {
			if baseUrlValue, exists := envVars[baseUrlKey]; exists {
				if strings.HasPrefix(targetBase, baseUrlValue) {
					remainingPart := targetBase[len(baseUrlValue):]
					if remainingPart == "" || strings.HasPrefix(remainingPart, "/") {
						isSpecialAPI = true
						break
					}
				}
			}
		}

		// 处理JSON请求 - 只对特定API进行替换
		contentType := r.Header.Get("Content-Type")
		var jsonData interface{}
		if isSpecialAPI && strings.Contains(contentType, "application/json") {
			var data interface{}
			if err := json.Unmarshal(bodyBytes, &data); err == nil {
				jsonData = data
			} else {
				logger.Printf("解析JSON请求体失败: %v", err)
			}
		}

		// 创建新请求体（如果不需要替换，使用原始bodyBytes）
		if jsonData == nil {
			r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		// 构建请求头，替换环境变量引用
		proxyHeaders := make(http.Header)
		for key, values := range r.Header {
			if shouldSkipHeader(key) {
				continue
			}

			for _, value := range values {

				// 特殊处理 X-ByteAPM-AppKey= 格式
				if strings.Contains(value, "X-ByteAPM-AppKey=") {
					if otelHeaders, exists := envVars["OTEL_EXPORTER_OTLP_HEADERS"]; exists {
						// 使用预编译的正则表达式替换 X-ByteAPM-AppKey=xxx 为实际的值
						newValue := byteAPMAppKeyRegex.ReplaceAllString(value, otelHeaders)
						proxyHeaders.Add(key, newValue)
						if debugMode {
							logger.Printf("替换OTEL ByteAPM AppKey格式: %s: %s => %s", key, value, newValue)
						}
						continue
					}
				}

				// 特殊处理 Authorization 头
				if key == "Authorization" {
					// 处理 Bearer env:XXX 格式
					if strings.HasPrefix(value, "Bearer env:") {
						envKey := strings.TrimPrefix(value, "Bearer env:")
						if envValue, exists := envVars[envKey]; exists {
							proxyHeaders.Add(key, "Bearer "+envValue)
							if debugMode {
								logger.Printf("替换环境变量引用 (Bearer env:): %s", sanitizeLogString(envKey))
							}
							continue
						}
					}

					// 处理直接使用环境变量名的情况，如 Bearer OPENAI_API_KEY
					if strings.HasPrefix(value, "Bearer ") {
						tokenValue := strings.TrimPrefix(value, "Bearer ")
						if envValue, exists := envVars[tokenValue]; exists {
							proxyHeaders.Add(key, "Bearer "+envValue)
							if debugMode {
								logger.Printf("替换环境变量引用 (直接引用): Bearer %s", sanitizeLogString(tokenValue))
							}
							continue
						}
					}
				}

				// 检查所有头部值是否直接为环境变量名
				if envValue, exists := envVars[value]; exists {
					// 如果头部值完全等于某个环境变量名，则替换为环境变量的值
					proxyHeaders.Add(key, envValue)
					if debugMode {
						logger.Printf("替换请求头中的环境变量名称: %s: %s", sanitizeLogString(key), sanitizeLogString(value))
					}
					continue
				}

				// 替换字符串中的环境变量引用
				newValue := replaceEnvVarsInString(value)
				proxyHeaders.Add(key, newValue)
				if debugMode && newValue != value {
					logger.Printf("替换请求头中的环境变量引用: %s: %s", sanitizeLogString(key), sanitizeLogString(value))
				}
			}
		}

		// 处理JSON请求体中的特定API密钥替换
		if jsonData != nil {
			jsonData = processApiKeyInBody(jsonData, targetBase)
			// 重新序列化JSON数据
			if newBody, err := json.Marshal(jsonData); err == nil {
				bodyBytes = newBody
				// 更新请求体
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}
		}

		// 构建完整URL
		targetBase = strings.TrimSuffix(targetBase, "/")
		path = strings.TrimPrefix(path, "/")
		targetURL := fmt.Sprintf("%s/%s", targetBase, path)

		// 处理URL查询参数
		if r.URL.RawQuery != "" {
			// 处理URL查询参数中的环境变量
			queryValues := r.URL.Query()
			hasChanges := false

			for key, values := range queryValues {
				for i, value := range values {
					// 检查是否为环境变量名
					if envValue, exists := envVars[value]; exists {
						queryValues.Set(key, envValue)
						hasChanges = true
						if debugMode {
							logger.Printf("替换URL参数中的环境变量名称: %s=%s", sanitizeLogString(key), sanitizeLogString(value))
						}
					} else {
						// 替换参数值中的环境变量引用
						newValue := replaceEnvVarsInString(value)
						if newValue != value {
							values[i] = newValue
							hasChanges = true
							if debugMode {
								logger.Printf("替换URL参数中的环境变量引用: %s=%s", sanitizeLogString(key), sanitizeLogString(value))
							}
						}
					}
				}

				// 更新查询参数
				if hasChanges {
					queryValues[key] = values
				}
			}

			// 重建URL查询字符串
			if hasChanges {
				targetURL = fmt.Sprintf("%s?%s", targetURL, queryValues.Encode())
			} else {
				targetURL = fmt.Sprintf("%s?%s", targetURL, r.URL.RawQuery)
			}
		}

		logger.Printf("转发请求到: %s", targetURL)

		// 创建代理请求
		proxyReq, err := http.NewRequest(r.Method, targetURL, r.Body)
		if err != nil {
			http.Error(w, "创建代理请求失败", http.StatusInternalServerError)
			return
		}

		// 设置请求头
		proxyReq.Header = proxyHeaders

		// 透传magic-user-id和magic-organization-code到目标API
		// 只有当原始请求头中没有对应值时，才从JWT中设置，避免覆盖原始值
		if proxyReq.Header.Get("magic-user-id") == "" && magicUserID != "" {
			proxyReq.Header.Set("magic-user-id", magicUserID)
			if debugMode {
				logger.Printf("从JWT设置magic-user-id: %s", magicUserID)
			}
		} else if debugMode && proxyReq.Header.Get("magic-user-id") != "" {
			logger.Printf("保留原始magic-user-id: %s", proxyReq.Header.Get("magic-user-id"))
		}

		if proxyReq.Header.Get("magic-organization-code") == "" && magicOrganizationCode != "" {
			proxyReq.Header.Set("magic-organization-code", magicOrganizationCode)
			if debugMode {
				logger.Printf("从JWT设置magic-organization-code: %s", magicOrganizationCode)
			}
		} else if debugMode && proxyReq.Header.Get("magic-organization-code") != "" {
			logger.Printf("保留原始magic-organization-code: %s", proxyReq.Header.Get("magic-organization-code"))
		}

		if magicTaskID != "" {
			proxyReq.Header.Set("magic-task-id", magicTaskID)
			if debugMode {
				logger.Printf("透传magic-task-id: %s", magicTaskID)
			}
		}

		if magicTopicID != "" {
			proxyReq.Header.Set("magic-topic-id", magicTopicID)
			if debugMode {
				logger.Printf("透传magic-topic-id: %s", magicTopicID)
			}
		}

		if magicChatTopicID != "" {
			proxyReq.Header.Set("magic-chat-topic-id", magicChatTopicID)
			if debugMode {
				logger.Printf("透传magic-chat-topic-id: %s", magicChatTopicID)
			}
		}

		if magicLanguage != "" {
			proxyReq.Header.Set("magic-language", magicLanguage)
			if debugMode {
				logger.Printf("透传magic-language: %s", magicLanguage)
			}
		}

		// 如果需要添加API密钥且请求头中没有Authorization
		if shouldAddApiKey && !headerExists(proxyHeaders, "Authorization") {
			proxyReq.Header.Set("Authorization", "Bearer "+targetApiKey)
			logger.Printf("已添加目标服务API密钥")
		}

		// 发送请求（超时时间：2分钟，防止资源耗尽攻击）
		// 禁止自动跟随重定向，防止重定向到恶意URL绕过白名单
		client := &http.Client{
			Timeout: 2 * time.Minute,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				// 验证重定向目标URL是否在白名单中
				redirectURL := req.URL.String()
				if err := validateTargetURL(redirectURL); err != nil {
					logger.Printf("阻止重定向到未授权URL: %s, 原因: %v", redirectURL, err)
					return fmt.Errorf("重定向目标URL未在白名单中")
				}
				// 限制重定向次数，防止重定向循环
				if len(via) >= 5 {
					return fmt.Errorf("重定向次数超过限制")
				}
				logger.Printf("允许重定向到: %s", redirectURL)
				return nil
			},
		}
		resp, err := client.Do(proxyReq)
		if err != nil {
			logger.Printf("代理错误: %v", err)
			http.Error(w, fmt.Sprintf("代理错误: %v", err), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		logger.Printf("代理响应状态码: %d", resp.StatusCode)

		// 检查是否为SSE流式响应
		contentType = resp.Header.Get("Content-Type")
		isSSEResponse := strings.Contains(strings.ToLower(contentType), "text/event-stream") ||
			strings.Contains(strings.ToLower(contentType), "text/stream") ||
			strings.Contains(strings.ToLower(contentType), "application/stream")

		// 设置响应头
		for key, values := range resp.Header {
			if !shouldSkipHeader(key) {
				for _, value := range values {
					w.Header().Add(key, value)
				}
			}
		}

		// 设置状态码
		w.WriteHeader(resp.StatusCode)

		// 处理SSE流式响应
		if isSSEResponse {
			logger.Printf("检测到SSE流式响应，开始流式转发")

			// 确保连接保持活跃，设置必要的流式响应头
			if flusher, ok := w.(http.Flusher); ok {
				// 实时转发流式数据
				buffer := make([]byte, 4096)
				for {
					n, err := resp.Body.Read(buffer)
					if n > 0 {
						// 写入数据到客户端
						w.Write(buffer[:n])
						// 立即刷新缓冲区，确保数据实时传输
						flusher.Flush()

						if debugMode {
							logger.Printf("转发SSE数据块: %d 字节", n)
						}
					}
					if err != nil {
						if err == io.EOF {
							logger.Printf("SSE流结束")
						} else {
							logger.Printf("读取SSE流错误: %v", err)
						}
						break
					}
				}
			} else {
				logger.Printf("警告: ResponseWriter不支持Flush，降级为普通响应处理")
				// 降级处理：读取完整响应体
				respBody, err := io.ReadAll(resp.Body)
				if err != nil {
					logger.Printf("读取响应体失败: %v", err)
					return
				}
				w.Write(respBody)
			}
		} else {
			// 非流式响应的原有处理逻辑
			// 在调试模式下记录完整响应信息
			if debugMode {
				logFullResponse(resp, targetURL)
			}

			// 限制响应体大小以防止内存耗尽
			limitedReader := io.LimitReader(resp.Body, maxResponseBodySize)
			respBody, err := io.ReadAll(limitedReader)
			if err != nil {
				logger.Printf("读取响应体失败: %v", err)
				http.Error(w, "读取响应体失败", http.StatusInternalServerError)
				return
			}

			// 检查响应是否因大小限制而被截断
			if int64(len(respBody)) >= maxResponseBodySize {
				logger.Printf("警告: 响应体可能超过100MB限制，已截断")
			}

			// 仅在调试模式下记录响应体内容（防止敏感信息泄露）
			if debugMode {
				if len(respBody) > 100*1024 {
					logger.Printf("响应体大小超过100kb，不打印")
				} else {
					logger.Printf("响应体内容: %s", string(respBody))
				}
			}

			// 转发响应体
			w.Write(respBody)
		}
	})

	handler(w, r)
}

// 检查是否应跳过请求头
func shouldSkipHeader(key string) bool {
	key = strings.ToLower(key)
	// 对于流式响应，需要保留更多头部信息
	skipHeaders := []string{"host", "x-forwarded-for"}

	// 对于流式响应，不跳过connection相关的头部
	// content-length在流式响应中通常不需要或由服务器自动处理
	for _, h := range skipHeaders {
		if key == h {
			return true
		}
	}
	return false
}

// 检查请求头是否存在
func headerExists(headers http.Header, key string) bool {
	_, ok := headers[key]
	return ok
}

// 递归替换对象中的环境变量引用
func replaceEnvVars(data interface{}) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		result := make(map[string]interface{})
		for key, value := range v {
			result[key] = replaceEnvVars(value)
		}
		return result

	case []interface{}:
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = replaceEnvVars(item)
		}
		return result

	case string:
		originalValue := v

		// 检查是否使用 env: 前缀
		if strings.HasPrefix(v, "env:") {
			envKey := strings.TrimPrefix(v, "env:")
			if value, exists := envVars[envKey]; exists {
				if debugMode {
					logger.Printf("环境变量替换: env:%s => %s", sanitizeLogString(envKey), maskSensitiveValue(value))
				}
				return value
			}
			return v
		}

		// 直接检查是否是环境变量名称（支持所有在.env文件中定义的环境变量）
		if value, exists := envVars[v]; exists {
			// 检查是否是全匹配的环境变量名称(没有其他内容)
			// 只有字符串完全等于环境变量名称时才替换，避免误替换
			if debugMode {
				logger.Printf("环境变量名称替换: %s => %s", sanitizeLogString(v), maskSensitiveValue(value))
			}
			return value
		}

		// 替换其他格式的环境变量引用
		newValue := replaceEnvVarsInString(v)
		if newValue != originalValue && debugMode {
			logger.Printf("字符串环境变量替换: %s => %s", sanitizeLogString(originalValue), maskSensitiveValue(newValue))
		}
		return newValue

	default:
		return v
	}
}

// 替换字符串中的环境变量引用
func replaceEnvVarsInString(s string) string {
	// 替换${VAR}格式
	re1 := regexp.MustCompile(`\${([A-Za-z0-9_]+)}`)
	s = re1.ReplaceAllStringFunc(s, func(match string) string {
		varName := re1.FindStringSubmatch(match)[1]
		if value, exists := envVars[varName]; exists {
			return value
		}
		return match
	})

	// 替换$VAR格式
	re2 := regexp.MustCompile(`\$([A-Za-z0-9_]+)`)
	s = re2.ReplaceAllStringFunc(s, func(match string) string {
		varName := re2.FindStringSubmatch(match)[1]
		if value, exists := envVars[varName]; exists {
			return value
		}
		return match
	})

	// 替换{$VAR}格式
	re3 := regexp.MustCompile(`\{\$([A-Za-z0-9_]+)\}`)
	s = re3.ReplaceAllStringFunc(s, func(match string) string {
		varName := re3.FindStringSubmatch(match)[1]
		if value, exists := envVars[varName]; exists {
			return value
		}
		return match
	})

	return s
}

// 记录完整的响应信息
func logFullResponse(resp *http.Response, targetURL string) {
	logger.Printf("======= 调试模式 - 完整响应信息 =======")
	logger.Printf("目标URL: %s", targetURL)
	logger.Printf("响应状态: %s", resp.Status)
	logger.Printf("响应协议: %s", resp.Proto)

	// 记录所有响应头
	logger.Printf("--- 响应头 ---")
	for key, values := range resp.Header {
		for _, value := range values {
			logger.Printf("%s: %s", key, value)
		}
	}

	// 读取并记录响应体，然后重置
	logger.Printf("--- 响应体 ---")
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Printf("读取响应体失败: %v", err)
	} else {
		// 尝试格式化JSON响应体
		contentType := resp.Header.Get("Content-Type")
		if strings.Contains(contentType, "application/json") {
			var prettyJSON bytes.Buffer
			err = json.Indent(&prettyJSON, bodyBytes, "", "  ")
			if err == nil {
				logger.Printf("%s", prettyJSON.String())
			} else {
				logger.Printf("%s", string(bodyBytes))
			}
		} else {
			logger.Printf("%s", string(bodyBytes))
		}

		// 重置响应体以便后续处理
		resp.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}
	logger.Printf("====================================")
}

// 记录请求头
func logFullRequest(r *http.Request) {
	logger.Printf("======= 调试模式 - 完整请求信息 =======")
	logger.Printf("请求方法: %s", r.Method)
	logger.Printf("完整URL: %s", r.URL.String())
	logger.Printf("请求协议: %s", r.Proto)
	logger.Printf("远程地址: %s", r.RemoteAddr)

	// 记录所有请求头
	logger.Printf("--- 请求头 ---")
	for key, values := range r.Header {
		for _, value := range values {
			if debugMode {
				//过滤 Magic-Authorization 、X-Gateway-Api-Key
				if key != "Magic-Authorization" && key != "X-Gateway-Api-Key" {
					logger.Printf("%s: %s", key, value)
				}
			}
		}
	}

	// 读取并记录请求体，然后重置
	logger.Printf("--- 请求体 ---")
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		logger.Printf("读取请求体失败: %v", err)
	} else {
		// 尝试格式化JSON请求体
		// contentType := r.Header.Get("Content-Type")
		// if strings.Contains(contentType, "application/json") {
		// 	var prettyJSON bytes.Buffer
		// 	err = json.Indent(&prettyJSON, bodyBytes, "", "  ")
		// 	if err == nil {
		// 		logger.Printf("%s", prettyJSON.String())
		// 	} else {
		// 		if debugMode{
		// 			logger.Printf("%s", string(bodyBytes))
		// 		}
		// 	}
		// } else {
		// 	if debugMode{
		// 		logger.Printf("%s", string(bodyBytes))
		// 	}
		// }

		// 重置请求体以便后续处理
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}
	logger.Printf("=====================================")
}

// processApiKeyInBody 处理特定API_BASE_URL对应的API密钥在请求体中的替换
func processApiKeyInBody(data interface{}, targetBase string) interface{} {
	// 检查目标URL是否匹配特定的API_BASE_URL（使用全局配置）
	var matchedApiKey string
	for baseUrlKey, apiKeyKey := range specialApiKeys {
		if baseUrlValue, exists := envVars[baseUrlKey]; exists {
			// 检查目标URL是否精确匹配该API_BASE_URL的值
			// 使用更严格的匹配逻辑，确保域名完全匹配
			if strings.HasPrefix(targetBase, baseUrlValue) {
				// 额外的检查：确保下一个字符是路径分隔符或URL结束
				remainingPart := targetBase[len(baseUrlValue):]
				if remainingPart == "" || strings.HasPrefix(remainingPart, "/") {
					if apiKeyValue, exists := envVars[apiKeyKey]; exists {
						matchedApiKey = apiKeyValue
						if debugMode {
							logger.Printf("检测到特定API_BASE_URL匹配: %s => %s", baseUrlKey, apiKeyKey)
						}
						break
					}
				}
			}
		}
	}

	// 如果没有匹配到特定的API密钥，直接返回原数据
	if matchedApiKey == "" {
		return data
	}

	// 递归处理数据结构，查找并替换API密钥
	return replaceApiKeyInData(data, matchedApiKey)
}

// replaceApiKeyInData 递归替换数据结构中的API密钥
func replaceApiKeyInData(data interface{}, apiKey string) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		result := make(map[string]interface{})
		for key, value := range v {
			// 检查是否是API密钥相关的字段
			if isApiKeyField(key) {
				// 如果字段值为空或者是占位符，则替换为实际的API密钥
				if strValue, ok := value.(string); ok {
					// 检查各种占位符格式
					if strValue == "" ||
						strValue == "env:"+key ||
						strValue == "${"+key+"}" ||
						strValue == "$"+key ||
						strValue == "{$"+key+"}" ||
						strings.Contains(strValue, "${") ||
						strings.Contains(strValue, "$") {
						result[key] = apiKey
						if debugMode {
							logger.Printf("在请求体中替换API密钥: %s", sanitizeLogString(key))
						}
						continue
					}
				}
			}
			result[key] = replaceApiKeyInData(value, apiKey)
		}
		return result

	case []interface{}:
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = replaceApiKeyInData(item, apiKey)
		}
		return result

	default:
		return v
	}
}

// isApiKeyField 检查字段名是否是API密钥相关的字段
func isApiKeyField(fieldName string) bool {
	// 基础的通用API密钥字段名
	baseApiKeyFields := []string{
		"api_key", "apiKey", "access_key", "accessKey", "key", "token", "authorization",
	}

	// 从特殊API配置中提取API密钥环境变量名
	dynamicApiKeyFields := make([]string, 0, len(specialApiKeys))
	for _, apiKeyEnvName := range specialApiKeys {
		dynamicApiKeyFields = append(dynamicApiKeyFields, apiKeyEnvName)
	}

	fieldNameLower := strings.ToLower(fieldName)

	// 检查基础字段
	for _, apiField := range baseApiKeyFields {
		if strings.Contains(fieldNameLower, strings.ToLower(apiField)) {
			return true
		}
	}

	// 检查动态配置的字段
	for _, apiField := range dynamicApiKeyFields {
		if strings.Contains(fieldNameLower, strings.ToLower(apiField)) {
			return true
		}
	}

	return false
}
