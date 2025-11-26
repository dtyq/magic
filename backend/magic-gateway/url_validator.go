package main

import (
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"
)

// TargetURLRuleType 定义匹配规则的类型
type TargetURLRuleType string

const (
	// RuleTypeExact 精确匹配完整URL
	RuleTypeExact TargetURLRuleType = "exact"
	// RuleTypeDomain 匹配整个域名及其所有子域名
	RuleTypeDomain TargetURLRuleType = "domain"
	// RuleTypePrefix 匹配以指定前缀开头的URL
	RuleTypePrefix TargetURLRuleType = "prefix"
	// RuleTypeRegex 使用正则表达式匹配URL
	RuleTypeRegex TargetURLRuleType = "regex"
)

// TargetURLRule 定义目标URL的白名单规则
type TargetURLRule struct {
	Type        TargetURLRuleType // 规则类型
	Pattern     string            // 匹配模式
	Description string            // 规则描述
	regex       *regexp.Regexp    // 编译后的正则表达式（用于regex类型）
}

// loadAllowedTargetURLs 从环境变量加载并解析URL白名单规则
func loadAllowedTargetURLs() {
	// 首先尝试从envVars获取（用于测试），然后从系统环境变量获取
	whitelistEnv := ""
	if val, exists := envVars["MAGIC_GATEWAY_ALLOWED_TARGET_URLS"]; exists {
		whitelistEnv = val
	} else {
		whitelistEnv = getEnvWithDefault("MAGIC_GATEWAY_ALLOWED_TARGET_URLS", "")
	}

	if whitelistEnv == "" {
		logger.Println("警告: 未设置 MAGIC_GATEWAY_ALLOWED_TARGET_URLS 环境变量，target参数将被禁用")
		allowedTargetRules = []*TargetURLRule{}
		return
	}

	// 从环境变量解析规则
	// 格式: type:pattern@description|type:pattern@description|...
	// 注意: 使用@分隔描述，以避免与URL中的:冲突
	// 示例: domain:example.com@允许example.com|prefix:https://api.test.com/@允许test API
	rules := strings.Split(whitelistEnv, "|")
	allowedTargetRules = make([]*TargetURLRule, 0, len(rules))

	for i, ruleStr := range rules {
		ruleStr = strings.TrimSpace(ruleStr)
		if ruleStr == "" {
			continue
		}

		// 解析规则组件
		// 格式: type:pattern@description (@和描述是可选的)
		// 查找第一个冒号来分隔类型
		firstColon := strings.Index(ruleStr, ":")
		if firstColon == -1 {
			logger.Printf("警告: 白名单规则格式错误 (规则 %d): %s", i+1, ruleStr)
			continue
		}

		ruleType := TargetURLRuleType(strings.TrimSpace(ruleStr[:firstColon]))
		remaining := ruleStr[firstColon+1:]

		// 查找@来分隔模式和描述
		atIndex := strings.Index(remaining, "@")
		var pattern, description string

		if atIndex > 0 {
			// 提供了描述
			pattern = strings.TrimSpace(remaining[:atIndex])
			description = strings.TrimSpace(remaining[atIndex+1:])
		} else {
			// 没有描述
			pattern = strings.TrimSpace(remaining)
		}

		// 验证规则类型
		switch ruleType {
		case RuleTypeExact, RuleTypeDomain, RuleTypePrefix:
			// 有效的类型
		case RuleTypeRegex:
			// 编译正则表达式
			re, err := regexp.Compile(pattern)
			if err != nil {
				logger.Printf("警告: 正则表达式编译失败 (规则 %d): %s, 错误: %v", i+1, pattern, err)
				continue
			}
			rule := &TargetURLRule{
				Type:        ruleType,
				Pattern:     pattern,
				Description: description,
				regex:       re,
			}
			allowedTargetRules = append(allowedTargetRules, rule)
			continue
		default:
			logger.Printf("警告: 未知的规则类型 (规则 %d): %s", i+1, ruleType)
			continue
		}

		rule := &TargetURLRule{
			Type:        ruleType,
			Pattern:     pattern,
			Description: description,
		}
		allowedTargetRules = append(allowedTargetRules, rule)
	}

	logger.Printf("已加载 %d 个目标URL白名单规则", len(allowedTargetRules))
	if debugMode {
		for i, rule := range allowedTargetRules {
			desc := rule.Description
			if desc == "" {
				desc = "无描述"
			}
			logger.Printf("  规则 %d: [%s] %s - %s", i+1, rule.Type, rule.Pattern, desc)
		}
	}
}

// isPrivateIP 检查IP地址是否为私有/内网地址
func isPrivateIP(ip net.IP) bool {
	// 检查是否为环回地址
	if ip.IsLoopback() {
		return true
	}

	// 检查私有IP范围
	privateRanges := []string{
		"10.0.0.0/8",     // 私有网络
		"172.16.0.0/12",  // 私有网络
		"192.168.0.0/16", // 私有网络
		"169.254.0.0/16", // 链路本地地址
		"127.0.0.0/8",    // 环回地址
		"::1/128",        // IPv6环回地址
		"fc00::/7",       // IPv6私有地址
		"fe80::/10",      // IPv6链路本地地址
	}

	for _, cidr := range privateRanges {
		_, subnet, _ := net.ParseCIDR(cidr)
		if subnet != nil && subnet.Contains(ip) {
			return true
		}
	}

	return false
}

// validateTargetURL 对目标URL执行全面验证
func validateTargetURL(targetURL string) error {
	if targetURL == "" {
		return nil // 允许空目标（将使用其他方法）
	}

	// 解析URL
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return fmt.Errorf("URL格式错误: %v", err)
	}

	// 检查协议 - 仅允许http和https
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("不支持的协议: %s (仅支持 http/https)", parsedURL.Scheme)
	}

	// 提取主机名
	hostname := parsedURL.Hostname()
	if hostname == "" {
		return fmt.Errorf("URL中缺少主机名")
	}

	// Prevent URL tricks like @, :, etc
	if strings.Contains(hostname, "@") {
		return fmt.Errorf("主机名包含非法字符")
	}

	// 检查端口号是否在合理范围内
	if port := parsedURL.Port(); port != "" {
		// Block common internal/admin ports
		blockedPorts := []string{"22", "23", "25", "3306", "5432", "6379", "27017", "9200"}
		for _, blocked := range blockedPorts {
			if port == blocked {
				return fmt.Errorf("禁止访问的端口: %s", port)
			}
		}
	}

	// 检查是否为IP地址
	if ip := net.ParseIP(hostname); ip != nil {
		// 检查是否为私有IP
		if isPrivateIP(ip) {
			return fmt.Errorf("禁止访问内网IP地址: %s", hostname)
		}
	} else {
		// 解析主机名以检查私有IP (防止DNS rebinding攻击)
		ips, err := net.LookupIP(hostname)
		if err != nil {
			// DNS解析失败，但我们允许继续
			// 如果域名不存在，实际请求仍然会失败
			if debugMode {
				logger.Printf("DNS解析失败: %s, 错误: %v", hostname, err)
			}
		} else {
			// 检查解析的IP是否为私有IP
			for _, ip := range ips {
				if isPrivateIP(ip) {
					return fmt.Errorf("域名 %s 解析到内网IP地址: %s", hostname, ip.String())
				}
			}
		}
	}
	logger.Printf("targetURL: %s, allowedTargetRules: %v", targetURL, allowedTargetRules)
	// 检查白名单规则
	if len(allowedTargetRules) == 0 {
		return fmt.Errorf("未配置URL白名单，禁止使用target参数")
	}

	for _, rule := range allowedTargetRules {
		if matchTargetURL(targetURL, parsedURL, rule) {
			if debugMode {
				logger.Printf("URL匹配白名单规则: [%s] %s", rule.Type, rule.Pattern)
			}
			return nil // URL被允许
		}
	}

	return fmt.Errorf("URL未在白名单中")
}

// matchTargetURL 检查目标URL是否匹配白名单规则
func matchTargetURL(targetURL string, parsedURL *url.URL, rule *TargetURLRule) bool {
	switch rule.Type {
	case RuleTypeExact:
		// 精确匹配（忽略尾部斜杠）
		pattern := strings.TrimSuffix(rule.Pattern, "/")
		target := strings.TrimSuffix(targetURL, "/")
		return pattern == target

	case RuleTypeDomain:
		// 匹配域名和所有子域名
		hostname := parsedURL.Hostname()
		pattern := strings.TrimPrefix(rule.Pattern, ".")

		// 精确域名匹配或子域名匹配
		return hostname == pattern || strings.HasSuffix(hostname, "."+pattern)

	case RuleTypePrefix:
		// 前缀匹配
		return strings.HasPrefix(targetURL, rule.Pattern)

	case RuleTypeRegex:
		// 正则表达式匹配
		if rule.regex != nil {
			return rule.regex.MatchString(targetURL)
		}
		return false

	default:
		return false
	}
}

// isTargetURLAllowed 检查目标URL是否被允许（用于向后兼容的包装函数）
func isTargetURLAllowed(targetURL string) bool {
	err := validateTargetURL(targetURL)
	if err != nil {
		if debugMode {
			logger.Printf("目标URL验证失败: %s, 原因: %v", targetURL, err)
		}
		return false
	}
	return true
}
