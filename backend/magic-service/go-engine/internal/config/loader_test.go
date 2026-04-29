package config_test

import (
	"os"
	"path/filepath"
	"testing"

	config "magic/internal/config"
)

func TestNew_YAMLParse_NoEnv(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("server:\n  host: 127.0.0.1\n  port: 9000\n  basePath: /api/v9\nredis:\n  host: 127.0.0.1\n  port: 6380\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	t.Setenv("CONFIG_FILE", cfgPath)
	cfg := config.New()
	if cfg == nil {
		t.Fatalf("config is nil")
	}
	if cfg.Server.Host != "127.0.0.1" {
		t.Fatalf("unexpected server host: %q", cfg.Server.Host)
	}
	if cfg.Server.Port != 9000 {
		t.Fatalf("unexpected server port: %d", cfg.Server.Port)
	}
	if cfg.Server.BasePath != "/api/v9" {
		t.Fatalf("unexpected basePath: %q", cfg.Server.BasePath)
	}
}

func TestNew_ConfigEnvSubstitution_WithValue(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("server:\n  host: ${SERVER_HOST:-localhost}\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}

	t.Setenv("CONFIG_FILE", cfgPath)
	// 设置变量为非空，应该使用该值
	t.Setenv("SERVER_HOST", "1.2.3.4")

	cfg := config.New()
	if cfg == nil {
		t.Fatalf("config is nil")
	}
	if cfg.Server.Host != "1.2.3.4" {
		t.Fatalf("expected server.host to be 1.2.3.4, got %q", cfg.Server.Host)
	}
}

func TestNew_ConfigEnvSubstitution_DefaultFallback(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("qdrant:\n  host: ${QDRANT_HOST:-localhost}\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}

	t.Setenv("CONFIG_FILE", cfgPath)
	// 强制为空，模拟未设置或空值场景，触发默认值
	t.Setenv("QDRANT_HOST", "")

	cfg := config.New()
	if cfg == nil {
		t.Fatalf("config is nil")
	}
	if cfg.Qdrant.Host != "localhost" {
		t.Fatalf("expected qdrant.host to fallback to 'localhost', got %q", cfg.Qdrant.Host)
	}
}

func TestNew_WhenConfigFileMissing_UseDefaults(t *testing.T) {
	// 指向不存在的配置文件
	t.Setenv("CONFIG_FILE", filepath.Join(t.TempDir(), "no-such.yaml"))
	// 控制 DEBUG 以影响日志格式
	t.Setenv("DEBUG", "")
	cfg := config.New()
	if cfg == nil {
		t.Fatalf("config is nil")
	}
	if cfg.Server.Mode != "" {
		t.Fatalf("server.mode should stay empty when unset, got %q", cfg.Server.Mode)
	}
	if string(cfg.Logging.Level) != "info" {
		t.Fatalf("logging.level default should be info, got %q", cfg.Logging.Level)
	}
	if string(cfg.Logging.Format) != "json" {
		t.Fatalf("logging.format default should be json when DEBUG!=1, got %q", cfg.Logging.Format)
	}
}

func TestNew_LoggingFormat_TextWhenDebug(t *testing.T) {
	t.Setenv("CONFIG_FILE", filepath.Join(t.TempDir(), "nofile.yaml"))
	t.Setenv("DEBUG", "1")
	cfg := config.New()
	if string(cfg.Logging.Format) != "text" {
		t.Fatalf("expected text format when DEBUG=1, got %q", cfg.Logging.Format)
	}
}

func TestExpandEnvPlaceholders_DefaultColonEqual(t *testing.T) {
	t.Setenv("X", "")
	got := config.ExpandEnvPlaceholders("a=${X:=abc}")
	if got != "a=abc" {
		t.Fatalf("expected default when empty/unset, got %q", got)
	}
	t.Setenv("X", "VAL")
	got = config.ExpandEnvPlaceholders("a=${X:=abc}")
	if got != "a=VAL" {
		t.Fatalf("expected env value when set, got %q", got)
	}
}

func TestExpandEnvPlaceholders_DefaultColonDash(t *testing.T) {
	t.Setenv("Y", "")
	got := config.ExpandEnvPlaceholders("y=${Y:-def}")
	if got != "y=def" {
		t.Fatalf("expected default for empty with :-, got %q", got)
	}
}

func TestExpandEnvPlaceholders_DefaultDash_Unset(t *testing.T) {
	err := os.Unsetenv("Z")
	if err != nil {
		return
	}
	got := config.ExpandEnvPlaceholders("z=${Z-def}")
	if got != "z=def" {
		t.Fatalf("expected default for unset with -, got %q", got)
	}
}

func TestExpandEnvPlaceholders_SimpleVar(t *testing.T) {
	err := os.Unsetenv("S")
	if err != nil {
		return
	}
	got := config.ExpandEnvPlaceholders("s=${S}")
	if got != "s=" {
		t.Fatalf("expected empty for simple var when unset, got %q", got)
	}
}

func TestNew_PortEnvOverride_IntParsing(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	// server.port 使用带默认值的环境变量，确保整型解析正确
	content := []byte("server:\n  port: ${SERVER_PORT:=81}\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	t.Setenv("CONFIG_FILE", cfgPath)
	t.Setenv("SERVER_PORT", "9090")
	cfg := config.New()
	if cfg.Server.Port != 9090 {
		t.Fatalf("expected server.port=9090, got %d", cfg.Server.Port)
	}
}

func TestNew_RedisDBEnvOverride_IntParsing(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("redis:\n  db: ${REDIS_DB:=0}\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	t.Setenv("CONFIG_FILE", cfgPath)
	t.Setenv("REDIS_DB", "7")

	cfg := config.New()
	if cfg.Redis.DB != 7 {
		t.Fatalf("expected redis.db=7, got %d", cfg.Redis.DB)
	}
}

func TestNew_ServerEnabled_DefaultFalseWhenMissing(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("server:\n  host: 127.0.0.1\n  port: 9000\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	t.Setenv("CONFIG_FILE", cfgPath)

	cfg := config.New()
	if cfg.Server.Enabled == nil {
		t.Fatalf("expected server.enabled to default to false")
	}
	if *cfg.Server.Enabled {
		t.Fatalf("expected server.enabled to default to false")
	}
}

func TestNew_ServerEnabled_UsesEnvOverride(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("server:\n  enabled: ${SERVER_ENABLED:=false}\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	t.Setenv("CONFIG_FILE", cfgPath)
	t.Setenv("SERVER_ENABLED", "false")

	cfg := config.New()
	if cfg.Server.Enabled == nil {
		t.Fatalf("expected server.enabled to be parsed")
	}
	if *cfg.Server.Enabled {
		t.Fatalf("expected server.enabled=false, got true")
	}
}

func TestNew_ServerEnabled_UsesEnvOverrideTrue(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("server:\n  enabled: ${SERVER_ENABLED:=false}\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	t.Setenv("CONFIG_FILE", cfgPath)
	t.Setenv("SERVER_ENABLED", "true")

	cfg := config.New()
	if cfg.Server.Enabled == nil {
		t.Fatalf("expected server.enabled to be parsed")
	}
	if !*cfg.Server.Enabled {
		t.Fatalf("expected server.enabled=true, got false")
	}
}

func TestNew_QdrantBaseURIParse(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("qdrant:\n  baseUri: http://10.0.0.2:6333\n  host: localhost\n  port: 6334\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	t.Setenv("CONFIG_FILE", cfgPath)

	cfg := config.New()
	if cfg.Qdrant.BaseURI != "http://10.0.0.2:6333" {
		t.Fatalf("expected qdrant.baseUri parsed, got %q", cfg.Qdrant.BaseURI)
	}
}

func TestLoadDotEnvIfPresent_LoadsEnvFromCWD(t *testing.T) {
	// 创建包含 .env 的临时工作目录
	dir := t.TempDir()
	envPath := filepath.Join(dir, ".env")
	if err := os.WriteFile(envPath, []byte("FOO=BAR\n"), 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}
	// 切换到临时目录
	old, _ := os.Getwd()
	_ = os.Chdir(dir)
	defer func() { _ = os.Chdir(old) }()

	if err := os.Unsetenv("FOO"); err != nil {
		t.Fatalf("unset env: %v", err)
	}
	_ = config.New()
	if os.Getenv("FOO") != "BAR" {
		t.Fatalf("expected FOO to be loaded from .env, got %q", os.Getenv("FOO"))
	}
}

func TestNew_DefaultConfigPath_UsesConfigInCurrentWorkingDirectory(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "magic-go-engine-config.yaml")
	if err := os.WriteFile(cfgPath, []byte("server:\n  host: current-dir\n"), 0o600); err != nil {
		t.Fatalf("write magic-go-engine-config.yaml: %v", err)
	}

	old, _ := os.Getwd()
	_ = os.Chdir(dir)
	defer func() { _ = os.Chdir(old) }()

	if err := os.Unsetenv("CONFIG_FILE"); err != nil {
		t.Fatalf("unset CONFIG_FILE: %v", err)
	}

	cfg := config.New()
	if cfg.Server.Host != "current-dir" {
		t.Fatalf("expected current working directory magic-go-engine-config.yaml to be used, got %q", cfg.Server.Host)
	}
}

func TestNew_DefaultConfigPath_UsesMagicServiceParentConfig(t *testing.T) {
	root := t.TempDir()
	magicServiceDir := filepath.Join(root, "magic-service")
	goEngineDir := filepath.Join(magicServiceDir, "go-engine")
	if err := os.MkdirAll(goEngineDir, 0o750); err != nil {
		t.Fatalf("mkdir go-engine dir: %v", err)
	}
	if err := os.MkdirAll(magicServiceDir, 0o750); err != nil {
		t.Fatalf("mkdir magic-service dir: %v", err)
	}

	cfgPath := filepath.Join(magicServiceDir, "magic-go-engine-config.yaml")
	if err := os.WriteFile(cfgPath, []byte("server:\n  host: sibling-config\n"), 0o600); err != nil {
		t.Fatalf("write sibling config: %v", err)
	}

	old, _ := os.Getwd()
	_ = os.Chdir(goEngineDir)
	defer func() { _ = os.Chdir(old) }()

	if err := os.Unsetenv("CONFIG_FILE"); err != nil {
		t.Fatalf("unset CONFIG_FILE: %v", err)
	}

	cfg := config.New()
	if cfg.Server.Host != "sibling-config" {
		t.Fatalf("expected parent magic-service/magic-go-engine-config.yaml to be used, got %q", cfg.Server.Host)
	}
}

func TestLoadDotEnvIfPresent_LoadsEnvFromMagicServiceParent(t *testing.T) {
	root := t.TempDir()
	magicServiceDir := filepath.Join(root, "magic-service")
	goEngineDir := filepath.Join(magicServiceDir, "go-engine")
	if err := os.MkdirAll(goEngineDir, 0o750); err != nil {
		t.Fatalf("mkdir go-engine dir: %v", err)
	}
	if err := os.MkdirAll(magicServiceDir, 0o750); err != nil {
		t.Fatalf("mkdir magic-service dir: %v", err)
	}

	envPath := filepath.Join(magicServiceDir, ".env")
	if err := os.WriteFile(envPath, []byte("SIBLING_ENV=FROM_MAGIC_SERVICE\n"), 0o600); err != nil {
		t.Fatalf("write sibling .env: %v", err)
	}

	old, _ := os.Getwd()
	_ = os.Chdir(goEngineDir)
	defer func() { _ = os.Chdir(old) }()

	if err := os.Unsetenv("SIBLING_ENV"); err != nil {
		t.Fatalf("unset SIBLING_ENV: %v", err)
	}

	_ = config.New()
	if os.Getenv("SIBLING_ENV") != "FROM_MAGIC_SERVICE" {
		t.Fatalf("expected SIBLING_ENV to be loaded from parent magic-service/.env, got %q", os.Getenv("SIBLING_ENV"))
	}
}
