// Package config 提供配置加载器，与具体类型解耦。
package config

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/joho/godotenv"
	"github.com/mitchellh/mapstructure"
	"gopkg.in/yaml.v3"

	"magic/internal/config/autoload"
)

const (
	// 正则捕获组数量，用于满足 mnd linter
	matchWithDefaultGroupsCount = 3
	matchSimpleGroupsCount      = 2
)

// New 通过合并文件配置与环境变量创建配置。
func New() *autoload.Config {
	loadDotEnvIfPresent()
	path := resolveDefaultConfigPath()
	if rawPath, ok := os.LookupEnv("CONFIG_FILE"); ok {
		if trimmedPath := strings.TrimSpace(rawPath); trimmedPath != "" {
			path = trimmedPath
		}
	}

	var cfg autoload.Config
	// 清理路径以降低路径穿越风险；读取本地配置是有意为之。
	filePath := filepath.Clean(path)
	if data, err := os.ReadFile(filePath); err == nil {
		expanded := expandEnvPlaceholders(string(data))
		var raw map[string]any
		if err := yaml.Unmarshal([]byte(expanded), &raw); err == nil {
			dec, _ := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
				WeaklyTypedInput: true,
				Result:           &cfg,
			})
			_ = dec.Decode(raw)
		}
	}

	// 为启动阶段常用字段提供最小且合理的默认值
	if cfg.Server.Enabled == nil {
		serverEnabled := false
		cfg.Server.Enabled = &serverEnabled
	}
	if cfg.Server.Mode == "" {
		cfg.Server.Mode = autoload.RunModeDebug
	}
	if cfg.Logging.Level == "" {
		cfg.Logging.Level = autoload.LogLevelInfo
	}
	if cfg.Logging.Format == "" {
		if os.Getenv("DEBUG") == "1" {
			cfg.Logging.Format = autoload.LogFormatText
		} else {
			cfg.Logging.Format = autoload.LogFormatJSON
		}
	}
	return &cfg
}

func resolveDefaultConfigPath() string {
	candidates := []string{"magic-go-engine-config.yaml"}
	if cwd, err := os.Getwd(); err == nil {
		candidates = []string{
			filepath.Join(cwd, "magic-go-engine-config.yaml"),
			filepath.Join(cwd, "..", "magic-go-engine-config.yaml"),
		}
	}

	for _, candidate := range candidates {
		filePath := filepath.Clean(candidate)
		if _, err := os.Stat(filePath); err == nil {
			return filePath
		}
	}

	return filepath.Clean(candidates[0])
}

// expandEnvPlaceholders 将 ${VAR:-default}（以及 ${VAR-default}）替换为环境变量或默认值，
// 再将简单的 ${VAR} 替换为环境变量值（未设置则为空）。
func expandEnvPlaceholders(s string) string {
	// 处理 ${VAR:=default}、${VAR:-default} 与 ${VAR-default}
	reWithDefault := regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)(?::[-=]|-)([^}]*)}`)
	s = reWithDefault.ReplaceAllStringFunc(s, func(m string) string {
		sub := reWithDefault.FindStringSubmatch(m)
		if len(sub) != matchWithDefaultGroupsCount {
			return m
		}
		key := sub[1]
		def := sub[2]
		if v, ok := os.LookupEnv(key); ok && v != "" {
			return v
		}
		return def
	})
	// 处理 ${VAR}
	reSimple := regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)}`)
	s = reSimple.ReplaceAllStringFunc(s, func(m string) string {
		sub := reSimple.FindStringSubmatch(m)
		if len(sub) != matchSimpleGroupsCount {
			return m
		}
		return os.Getenv(sub[1])
	})
	return s
}

// loadDotEnvIfPresent 尝试从 .env 文件加载环境变量。
// 它优先读取当前工作目录的 .env，其次读取 sibling magic-service/.env。
// 该函数可被多次调用且安全。
func loadDotEnvIfPresent() {
	var candidates []string
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, ".env"),
			filepath.Join(cwd, "..", ".env"),
		)
	}
	if cwd, err := os.Getwd(); err == nil {
		dir := cwd
		for range 4 {
			candidates = append(candidates,
				filepath.Join(dir, "backend", "magic-service", ".env"),
			)
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			_ = godotenv.Load(p)
			break
		}
	}
}
