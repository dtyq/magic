package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

// 全局变量
var (
	// Redis客户端
	redisClient *redis.Client
	jwtSecret   []byte
	envVars     map[string]string
	logger      *log.Logger
	debugMode   bool
	ctx         = context.Background()

	// Redis连接状态
	redisAvailable bool

	// 内存令牌存储（作为Redis的后备方案）
	inMemoryTokenStore = make(map[string]TokenInfo)

	// 支持的服务列表
	supportedServices = []string{"OPENAI", "MAGIC", "DEEPSEEK"}
)

// TokenInfo 存储令牌相关信息
type TokenInfo struct {
	ContainerID string    `json:"container_id"`
	Created     time.Time `json:"created"`
	Expires     time.Time `json:"expires"`
}

// JWTClaims 定义JWT的声明
type JWTClaims struct {
	jwt.RegisteredClaims
	ContainerID string `json:"container_id"`
}

// ServiceInfo 存储服务配置信息
type ServiceInfo struct {
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	ApiKey  string `json:"api_key,omitempty"`
	Model   string `json:"default_model,omitempty"`
}

// 初始化函数
func init() {
	// 设置日志
	logger = log.New(os.Stdout, "[API网关] ", log.LstdFlags)
	logger.Println("初始化服务...")

	// 加载.env文件
	err := godotenv.Load()
	if err != nil {
		logger.Println("警告: 无法加载.env文件:", err)
	}

	// 获取JWT密钥
	jwtSecret = []byte(getEnvWithDefault("JWT_SECRET", "your-secret-key-change-me"))

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

	logger.Printf("已加载 %d 个环境变量", len(envVars))

	// 初始化Redis客户端
	initRedisClient()

	// 检测可用的API服务
	detectAvailableServices()
}

// 初始化Redis客户端
func initRedisClient() {
	// 如果在Docker环境中运行，使用容器名称连接Redis
	redisHost := getEnvWithDefault("REDIS_HOST", "magic-redis")
	redisPort := getEnvWithDefault("REDIS_PORT", "6379")
	redisAddr := fmt.Sprintf("%s:%s", redisHost, redisPort)

	// 向后兼容，如果直接设置了REDIS_ADDR则优先使用
	if directAddr := getEnvWithDefault("REDIS_ADDR", ""); directAddr != "" {
		redisAddr = directAddr
	}

	redisPassword := getEnvWithDefault("REDIS_PASSWORD", "")

	// 根据环境确定使用的Redis数据库
	env := getEnvWithDefault("ENV", "test")
	redisDB := 0 // 默认使用DB 0

	// 为不同环境使用不同的数据库
	switch env {
	case "test":
		redisDB = 0
	case "pre":
		redisDB = 1
	case "prod":
		redisDB = 2
	default:
		// 未知环境默认使用test环境的数据库
		redisDB = 0
		logger.Printf("未知环境: %s, 将使用test环境的Redis数据库", env)
	}

	// 如果明确指定了DB，则使用指定的
	if dbStr := getEnvWithDefault("REDIS_DB", ""); dbStr != "" {
		if db, err := strconv.Atoi(dbStr); err == nil {
			redisDB = db
		}
	}

	logger.Printf("连接Redis: %s (DB: %d, 环境: %s)", redisAddr, redisDB, env)

	redisClient = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       redisDB,
	})

	// 测试连接
	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		logger.Printf("警告: 无法连接到Redis: %v", err)
		logger.Printf("将使用内存存储作为后备方案")
		redisAvailable = false
	} else {
		logger.Printf("成功连接到Redis服务器，使用数据库: %d", redisDB)
		redisAvailable = true
	}
}

// 检测可用的API服务
func detectAvailableServices() {
	availableServices := []ServiceInfo{}

	for _, service := range supportedServices {
		baseUrlKey := fmt.Sprintf("%s_API_BASE_URL", service)
		apiKeyKey := fmt.Sprintf("%s_API_KEY", service)
		modelKey := fmt.Sprintf("%s_MODEL", service)

		baseUrl, hasBaseUrl := envVars[baseUrlKey]
		apiKey, hasApiKey := envVars[apiKeyKey]
		model, _ := envVars[modelKey]

		if hasBaseUrl && hasApiKey {
			availableServices = append(availableServices, ServiceInfo{
				Name:    service,
				BaseURL: baseUrl,
				ApiKey:  apiKey,
				Model:   model,
			})
			logger.Printf("检测到可用API服务: %s (%s)", service, baseUrl)
		}
	}

	if len(availableServices) == 0 {
		logger.Println("警告: 未检测到任何可用的API服务")
	}
}

// 辅助函数：获取环境变量，如果不存在则使用默认值
func getEnvWithDefault(key, defaultValue string) string {
	value, exists := os.LookupEnv(key)
	if !exists {
		return defaultValue
	}
	return value
}

// 主函数
func main() {
	// 设置服务端口
	port := getEnvWithDefault("MAGIC_GATEWAY_PORT", "8000")

	// 注册路由
	http.HandleFunc("/auth", authHandler)
	http.HandleFunc("/env", envHandler)
	http.HandleFunc("/status", statusHandler)
	http.HandleFunc("/revoke", revokeHandler)
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

// 保存令牌到存储
func saveToken(tokenID string, tokenInfo TokenInfo) error {
	if redisAvailable {
		// 尝试保存到Redis
		err := saveTokenToRedis(tokenID, tokenInfo)
		if err != nil {
			logger.Printf("保存到Redis失败，回退到内存存储: %v", err)
			// 如果Redis保存失败，回退到内存存储
			inMemoryTokenStore[tokenID] = tokenInfo
		}
		return nil
	} else {
		// 直接使用内存存储
		inMemoryTokenStore[tokenID] = tokenInfo
		if debugMode {
			logger.Printf("令牌已保存到内存: %s", tokenID)
		}
		return nil
	}
}

// 从存储获取令牌
func getToken(tokenID string) (TokenInfo, bool) {
	if redisAvailable {
		// 首先尝试从Redis获取
		tokenInfo, found := getTokenFromRedis(tokenID)
		if found {
			return tokenInfo, true
		}
	}

	// 如果Redis不可用或Redis中未找到，从内存中获取
	tokenInfo, found := inMemoryTokenStore[tokenID]
	return tokenInfo, found
}

// 从存储中删除令牌
func deleteToken(tokenID string) error {
	if redisAvailable {
		// 尝试从Redis删除
		err := deleteTokenFromRedis(tokenID)
		if err != nil {
			logger.Printf("从Redis删除令牌失败: %v", err)
		}
	}

	// 无论Redis操作是否成功，都从内存中删除
	delete(inMemoryTokenStore, tokenID)
	if debugMode {
		logger.Printf("令牌已从内存删除: %s", tokenID)
	}

	return nil
}

// 获取活跃令牌数量
func getActiveTokenCount() int64 {
	var count int64 = 0

	if redisAvailable {
		// 尝试从Redis获取令牌数量
		redisCount, err := getTokenCount()
		if err == nil {
			count = redisCount
		}
	}

	// 如果Redis不可用或获取失败，使用内存存储的数量
	if count == 0 {
		count = int64(len(inMemoryTokenStore))
	}

	return count
}

// 保存令牌到Redis
func saveTokenToRedis(tokenID string, tokenInfo TokenInfo) error {
	// 将TokenInfo序列化为JSON
	tokenJSON, err := json.Marshal(tokenInfo)
	if err != nil {
		return err
	}

	// 设置过期时间（比令牌本身多1天，确保Redis中的数据在令牌有效期内始终可用）
	expiration := time.Until(tokenInfo.Expires) + 24*time.Hour

	// 保存到Redis
	err = redisClient.Set(ctx, "token:"+tokenID, tokenJSON, expiration).Err()
	if err != nil {
		return err
	}

	if debugMode {
		logger.Printf("令牌已保存到Redis: %s, 过期时间: %v", tokenID, expiration)
	}

	return nil
}

// 从Redis获取令牌信息
func getTokenFromRedis(tokenID string) (TokenInfo, bool) {
	var tokenInfo TokenInfo

	// 从Redis获取令牌
	tokenJSON, err := redisClient.Get(ctx, "token:"+tokenID).Result()
	if err != nil {
		if err != redis.Nil {
			logger.Printf("从Redis获取令牌出错: %v", err)
		}
		return tokenInfo, false
	}

	// 反序列化JSON
	err = json.Unmarshal([]byte(tokenJSON), &tokenInfo)
	if err != nil {
		logger.Printf("解析令牌JSON出错: %v", err)
		return tokenInfo, false
	}

	return tokenInfo, true
}

// 从Redis删除令牌
func deleteTokenFromRedis(tokenID string) error {
	err := redisClient.Del(ctx, "token:"+tokenID).Err()
	if err != nil {
		return err
	}

	if debugMode {
		logger.Printf("令牌已从Redis删除: %s", tokenID)
	}

	return nil
}

// 获取Redis中的所有令牌数量
func getTokenCount() (int64, error) {
	count, err := redisClient.Keys(ctx, "token:*").Result()
	if err != nil {
		return 0, err
	}
	return int64(len(count)), nil
}

// 认证处理程序
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

	// 只允许本地请求（127.0.0.1或::1）
	//isLocalhost := clientIP == "127.0.0.1" || clientIP == "::1" || clientIP == "localhost" || clientIP == "::ffff:127.0.0.1"
	// if !isLocalhost {
	// 	logger.Printf("拒绝来自非本地地址的令牌请求: %s", clientIP)
	// 	http.Error(w, "只允许从本地主机请求临时令牌", http.StatusForbidden)
	// 	return
	// }

	// 验证 Gateway API Key
	gatewayAPIKey := r.Header.Get("X-Gateway-API-Key")
	expectedAPIKey, exists := envVars["MAGIC_GATEWAY_API_KEY"]

	if !exists {
		logger.Printf("环境变量中未找到 MAGIC_GATEWAY_API_KEY，API密钥验证失败")
		http.Error(w, "服务器配置错误", http.StatusInternalServerError)
		return
	}

	if gatewayAPIKey == "" || gatewayAPIKey != expectedAPIKey {
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


	logger.Printf("认证请求来自本地用户: %s", userID)

	// 创建唯一标识
	tokenID := fmt.Sprintf("%d-%s", time.Now().UnixNano(), userID)

	// 创建JWT声明 - 设置30天过期时间
	claims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        tokenID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30天后过期
		},
		ContainerID: userID, // 保持字段名不变，但存储用户ID
	}

	// 创建令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		logger.Printf("生成令牌失败: %v", err)
		http.Error(w, "生成令牌失败", http.StatusInternalServerError)
		return
	}

	// 存储令牌信息
	tokenInfo := TokenInfo{
		ContainerID: userID,
		Created:     time.Now(),
		Expires:     time.Now().Add(30 * 24 * time.Hour), // 30天后过期
	}

	err = saveToken(tokenID, tokenInfo)
	if err != nil {
		logger.Printf("保存令牌失败: %v", err)
		http.Error(w, "保存令牌失败", http.StatusInternalServerError)
		return
	}

	logger.Printf("生成30天有效令牌: %s (用户: %s)", tokenID, userID)

	// 返回令牌
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token":   tokenString,
		"header":  "Magic-Authorization",
		"example": fmt.Sprintf("Magic-Authorization: Bearer %s", tokenString),
		"note":    "请确保在使用令牌时添加Bearer前缀，否则网关将自动添加",
	})
}

// 验证令牌函数
func validateToken(tokenString string) (*JWTClaims, bool) {
	// 移除Bearer前缀
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	// 解析令牌，包括验证过期时间
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名算法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("意外的签名方法: %v", token.Header["alg"])
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
		// 检查令牌是否在存储中
		if _, exists := getToken(claims.ID); !exists {
			logger.Printf("令牌未找到或已被吊销: %s", claims.ID)
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
					logger.Printf("自动为Magic-Authorization头添加Bearer前缀: %s", authHeader)
				}
			}
		}

		//super-magic代码有问题，暂时去掉 验证令牌
		// claims, valid := validateToken(authHeader)
		// if !valid {
		// 	http.Error(w, "无效或过期的令牌", http.StatusUnauthorized)
		// 	return
		// }

		// 将令牌信息存储在请求上下文中
		// r.Header.Set("X-USER-ID", claims.ContainerID)
		// r.Header.Set("X-TOKEN-ID", claims.ID)

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

// 获取可用的环境变量名称
func getAvailableEnvVarNames() []string {
	allowedVarNames := []string{}
	allowedPrefixes := []string{"OPENAI_", "MAGIC_", "DEEPSEEK_", "API_", "PUBLIC_"}

	for key := range envVars {
		for _, prefix := range allowedPrefixes {
			if strings.HasPrefix(key, prefix) {
				allowedVarNames = append(allowedVarNames, key)
				break
			}
		}
	}

	return allowedVarNames
}

// 状态处理程序
func statusHandler(w http.ResponseWriter, r *http.Request) {
	// 在调试模式下记录完整请求信息
	if debugMode {
		logger.Printf("STATUS请求:")
		logFullRequest(r)
	}

	// 获取活跃令牌数量
	tokenCount := getActiveTokenCount()

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
		"status":             "ok",
		"version":            getEnvWithDefault("API_GATEWAY_VERSION", "1.0.0"),
		"active_tokens":      tokenCount,
		"redis_available":    redisAvailable,
		"token_validity":     "30天",
		"env_vars_available": allowedVarNames,
		"services_available": availableServices,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// 吊销令牌处理程序
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

		// 检查令牌是否存在
		if _, exists := getToken(requestBody.TokenID); !exists {
			http.Error(w, "令牌未找到", http.StatusNotFound)
			return
		}

		// 删除令牌
		err = deleteToken(requestBody.TokenID)
		if err != nil {
			logger.Printf("删除令牌失败: %v", err)
			http.Error(w, "删除令牌失败", http.StatusInternalServerError)
			return
		}

		logger.Printf("吊销令牌: %s", requestBody.TokenID)

		// 返回成功
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{
			"success": true,
		})
	})

	handler(w, r)
}

// 清理过期令牌 - Redis会自动处理过期，仅清理内存存储
func cleanupExpiredTokens() {
	// Redis会自动清理过期的键
	// 仅清理内存存储中的过期令牌
	now := time.Now()
	for tokenID, tokenInfo := range inMemoryTokenStore {
		if tokenInfo.Expires.Before(now) {
			delete(inMemoryTokenStore, tokenID)
			if debugMode {
				logger.Printf("内存存储清理过期令牌: %s", tokenID)
			}
		}
	}
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
	if path == "auth" || path == "env" || path == "status" || path == "revoke" || path == "services" {
		http.Error(w, "无效的端点", http.StatusNotFound)
		return
	}

	// 需要认证
	handler := withAuth(func(w http.ResponseWriter, r *http.Request) {
		// 获取用户信息
		userID := r.Header.Get("X-USER-ID")
		magicUserID := r.Header.Get("magic-user-id")
		magicOrganizationCode := r.Header.Get("magic-organization-code")

		// 如果X-USER-ID为空但magic-user-id存在，使用magic-user-id
		if userID == "" && magicUserID != "" {
			userID = magicUserID
		}

		logger.Printf("代理请求来自用户: %s, 组织: %s, 路径: %s", userID, magicOrganizationCode, path)

		// 在调试模式下记录完整请求信息
		if debugMode {
			logger.Printf("PROXY请求:")
			logFullRequest(r)
		}

		// 读取请求体
		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "读取请求体失败", http.StatusInternalServerError)
			return
		}
		r.Body.Close()

		// 处理JSON请求
		contentType := r.Header.Get("Content-Type")
		if strings.Contains(contentType, "application/json") {
			var data interface{}
			if err := json.Unmarshal(bodyBytes, &data); err == nil {
				// 记录原始请求体
				//if originalJSON, err := json.Marshal(data); err == nil {
					// logger.Printf("原始请求体: %s", string(originalJSON))
				//}

				// 替换环境变量引用
				data = replaceEnvVars(data)

				// 记录替换后的请求体
				if newBody, err := json.Marshal(data); err == nil {
					// logger.Printf("替换环境变量后的请求体: %s", string(newBody))
					bodyBytes = newBody
				}
			} else {
				logger.Printf("解析JSON请求体失败: %v", err)
			}
		}

		// 创建新请求体
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		// 构建请求头，替换环境变量引用
		proxyHeaders := make(http.Header)
		for key, values := range r.Header {
			if shouldSkipHeader(key) {
				continue
			}

			for _, value := range values {
				// 特殊处理 Authorization 头
				if key == "Authorization" {
					// 处理 Bearer env:XXX 格式
					if strings.HasPrefix(value, "Bearer env:") {
						envKey := strings.TrimPrefix(value, "Bearer env:")
						if envValue, exists := envVars[envKey]; exists {
							proxyHeaders.Add(key, "Bearer "+envValue)
							if debugMode {
								logger.Printf("替换环境变量引用 (Bearer env:): %s => Bearer %s", envKey, envValue)
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
								logger.Printf("替换环境变量引用 (直接引用): Bearer %s => Bearer %s", tokenValue, envValue)
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
						logger.Printf("替换请求头中的环境变量名称: %s: %s => %s", key, value, envValue)
					}
					continue
				}

				// 替换字符串中的环境变量引用
				newValue := replaceEnvVarsInString(value)
				proxyHeaders.Add(key, newValue)
				if debugMode && newValue != value {
					logger.Printf("替换请求头中的环境变量引用: %s: %s => %s", key, value, newValue)
				}
			}
		}

		// 确定目标服务URL
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

			// 检查是否是环境变量名
			if envVarValue, exists := envVars[envVarName]; exists {
				targetBase = envVarValue
				path = remainingPath
				logger.Printf("通过环境变量名称访问: %s => %s", envVarName, targetBase)

				// 如果是API_BASE_URL类型的变量，尝试找到对应的API_KEY
				if strings.HasSuffix(envVarName, "_API_BASE_URL") {
					servicePrefix := strings.TrimSuffix(envVarName, "_API_BASE_URL")
					apiKeyVarName := servicePrefix + "_API_KEY"

					if apiKey, exists := envVars[apiKeyVarName]; exists {
						targetApiKey = apiKey
						shouldAddApiKey = true
						logger.Printf("找到对应的API密钥: %s", apiKeyVarName)
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

		// 4. 尝试从环境变量中获取默认API基础URL
		if targetBase == "" {
			targetBase = getEnvWithDefault("DEFAULT_API_URL", "")
			if targetBase != "" {
				logger.Printf("使用默认API URL: %s", targetBase)
			}
		}

		// 如果没有目标URL，返回错误
		if targetBase == "" {
			logger.Printf("未指定目标API URL: %s", path)
			http.Error(w, "未指定目标API URL", http.StatusBadRequest)
			return
		}

		// 替换URL中的环境变量
		targetBase = replaceEnvVarsInString(targetBase)

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
							logger.Printf("替换URL参数中的环境变量名称: %s=%s => %s=%s", key, value, key, envValue)
						}
					} else {
						// 替换参数值中的环境变量引用
						newValue := replaceEnvVarsInString(value)
						if newValue != value {
							values[i] = newValue
							hasChanges = true
							if debugMode {
								logger.Printf("替换URL参数中的环境变量引用: %s=%s => %s=%s", key, value, key, newValue)
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
		if magicUserID != "" {
			proxyReq.Header.Set("magic-user-id", magicUserID)
			if debugMode {
				logger.Printf("透传magic-user-id: %s", magicUserID)
			}
		}

		if magicOrganizationCode != "" {
			proxyReq.Header.Set("magic-organization-code", magicOrganizationCode)
			if debugMode {
				logger.Printf("透传magic-organization-code: %s", magicOrganizationCode)
			}
		}

		// 如果需要添加API密钥且请求头中没有Authorization
		if shouldAddApiKey && !headerExists(proxyHeaders, "Authorization") {
			proxyReq.Header.Set("Authorization", "Bearer "+targetApiKey)
			logger.Printf("已添加目标服务API密钥")
		}

		// 发送请求
		client := &http.Client{Timeout: 30 * time.Minute}
		resp, err := client.Do(proxyReq)
		if err != nil {
			logger.Printf("代理错误: %v", err)
			http.Error(w, fmt.Sprintf("代理错误: %v", err), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		logger.Printf("代理响应状态码: %d", resp.StatusCode)

		// 在调试模式下记录完整响应信息
		if debugMode {
			logFullResponse(resp, targetURL)
		}

		// 读取响应体
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			logger.Printf("读取响应体失败: %v", err)
			http.Error(w, "读取响应体失败", http.StatusInternalServerError)
			return
		}


		// 判断respBody 大小，如果超过100kb 则不打印
		if len(respBody) > 100*1024 {
			logger.Printf("响应体大小超过100kb，不打印")
		} else {
			logger.Printf("响应体内容: %s", string(respBody))
		}


		// 重新构建响应体供后续使用
		resp.Body = io.NopCloser(bytes.NewBuffer(respBody))

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

		// 转发响应体
		w.Write(respBody)
	})

	handler(w, r)
}

// 检查是否应跳过请求头
func shouldSkipHeader(key string) bool {
	key = strings.ToLower(key)
	skipHeaders := []string{"host", "content-length", "connection", "x-forwarded-for"}
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
				logger.Printf("环境变量替换: env:%s => %s", envKey, value)
				return value
			}
			return v
		}

		// 直接检查是否是环境变量名称（支持所有在.env文件中定义的环境变量）
		if value, exists := envVars[v]; exists {
			// 检查是否是全匹配的环境变量名称(没有其他内容)
			// 只有字符串完全等于环境变量名称时才替换，避免误替换
			logger.Printf("环境变量名称替换: %s => %s", v, value)
			return value
		}

		// 替换其他格式的环境变量引用
		newValue := replaceEnvVarsInString(v)
		if newValue != originalValue {
			logger.Printf("字符串环境变量替换: %s => %s", originalValue, newValue)
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
			logger.Printf("%s: %s", key, value)
		}
	}

	// 读取并记录请求体，然后重置
	logger.Printf("--- 请求体 ---")
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		logger.Printf("读取请求体失败: %v", err)
	} else {
		// 尝试格式化JSON请求体
		contentType := r.Header.Get("Content-Type")
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

		// 重置请求体以便后续处理
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}
	logger.Printf("=====================================")
}
