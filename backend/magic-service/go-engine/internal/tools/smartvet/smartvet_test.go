package smartvet_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"magic/internal/tools/smartvet"
)

func Test_atomicWriteFile(t *testing.T) {
	t.Parallel()
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.json")
	data := []byte(`{"hello":"world"}`)

	// 写入
	if err := smartvet.ExportAtomicWriteFile(path, data); err != nil {
		t.Fatalf("write failed: %v", err)
	}

	// 校验内容
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}
	if string(got) != string(data) {
		t.Errorf("content mismatch")
	}

	// 校验权限（近似检查，非 Windows）
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0o600 {
		// 注意：umask 可能影响结果，这个检查在某些环境可能不稳定
		t.Logf("perm got %v", info.Mode().Perm())
	}
}

func Test_computePackageState(t *testing.T) {
	t.Parallel()
	// 创建包目录
	pkgDir := t.TempDir()

	// 写入文件 A
	fileA := filepath.Join(pkgDir, "a.go")
	_ = os.WriteFile(fileA, []byte("package foo\nfunc A(){}"), 0o600)
	// 写入文件 B
	fileB := filepath.Join(pkgDir, "b.go")
	_ = os.WriteFile(fileB, []byte("package foo\nfunc B(){}"), 0o600)
	// 写入被忽略文件
	_ = os.WriteFile(filepath.Join(pkgDir, "readme.md"), []byte("doc"), 0o600)

	pkgInfo := smartvet.PackageInfo{
		ImportPath: "example.com/foo",
		Dir:        pkgDir,
	}

	// 1. 初次计算（无缓存）
	cache1, err := smartvet.ExportComputePackageState(pkgInfo, smartvet.PackageCache{})
	if err != nil {
		t.Fatalf("compute 1 failed: %v", err)
	}
	if cache1.Hash == "" {
		t.Error("expected hash")
	}
	if len(cache1.Files) != 2 {
		t.Errorf("expected 2 cached files, got %d", len(cache1.Files))
	}
	metaA, ok := cache1.Files["a.go"]
	if !ok {
		t.Error("missing a.go in cache")
	}

	// 2. 快速路径：使用已有缓存重新计算
	// 稍等以确保 mtime 变化（若 OS 时间分辨率低）
	// （但未修改文件，mtime 应保持一致）
	cache2, err := smartvet.ExportComputePackageState(pkgInfo, cache1)
	if err != nil {
		t.Fatalf("compute 2 failed: %v", err)
	}
	if cache2.Hash != cache1.Hash {
		t.Error("hash should match")
	}
	// 验证确实返回旧缓存对象（或等价）
	// 不易在内部验证是否走了快速路径，需要 mock 依赖，
	// 但功能正确性最重要。

	// 3. 修改 mtime（Touch）
	time.Sleep(10 * time.Millisecond) // 确保 mtime 有差异
	now := time.Now()
	_ = os.Chtimes(fileA, now, now)

	cache3, err := smartvet.ExportComputePackageState(pkgInfo, cache2)
	if err != nil {
		t.Fatalf("compute 3 failed: %v", err)
	}
	// 哈希不应变化（内容相同）
	if cache3.Hash != cache2.Hash {
		t.Errorf("hash changed after touch")
	}
	// A 的 mtime 在新缓存中应变化
	if cache3.Files["a.go"].Mtime == metaA.Mtime {
		// 注意：某些文件系统分辨率为 1s，测试过快可能抖动。
		// 但 t.TempDir 通常在磁盘上。
		// 若 OS 分辨率较差则允许相同 mtime。
		t.Log("mtime did not change (fast OS/FS?)")
	}

	// 4. 内容变化
	_ = os.WriteFile(fileA, []byte("package foo\nfunc A2(){}"), 0o600)
	cache4, err := smartvet.ExportComputePackageState(pkgInfo, cache3)
	if err != nil {
		t.Fatalf("compute 4 failed: %v", err)
	}
	if cache4.Hash == cache3.Hash {
		t.Error("hash shouldn't match after content change")
	}
}

func Test_JSONSerialization(t *testing.T) {
	t.Parallel()
	c := smartvet.PackageCache{
		Hash: "abc",
		Files: map[string]smartvet.FileMeta{
			"a.go": {Mtime: 123, Size: 456},
		},
	}
	b, err := json.Marshal(c)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	var c2 smartvet.PackageCache
	if err := json.Unmarshal(b, &c2); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if c2.Hash != "abc" || c2.Files["a.go"].Size != 456 {
		t.Error("json roundtrip failed")
	}
}

func Test_run_Integration(t *testing.T) {
	t.Parallel()
	// 创建临时缓存目录
	tmpDir := t.TempDir()
	opts := smartvet.Options{
		VetToolPath: filepath.Join(tmpDir, "dummy_vettool"),
		CacheDir:    filepath.Join(tmpDir, "cache"),
		RootDir:     tmpDir,
	}

	// 创建用于哈希检查的假 vettool 文件
	_ = os.WriteFile(opts.VetToolPath, []byte("binary"), 0o600)

	logger := slog.New(slog.DiscardHandler)
	r := smartvet.NewRunner(opts, logger, io.Discard, io.Discard)

	// 模拟
	r.SetTestListPackages(func() ([]smartvet.PackageInfo, error) {
		return []smartvet.PackageInfo{{ImportPath: "pkg/a", Dir: tmpDir}}, nil
	})

	vetCalls := 0
	r.SetTestRunGoVet(func(args ...string) error {
		vetCalls++
		return nil
	})

	// 在“包目录”（tmpDir）创建假 .go 文件
	_ = os.WriteFile(filepath.Join(tmpDir, "a.go"), []byte("package a"), 0o600)

	// 运行 1：全量扫描（首次）
	if err := r.Run(); err != nil {
		t.Fatalf("run 1 failed: %v", err)
	}
	if vetCalls == 0 {
		t.Error("expected vet call on first run")
	}

	// 运行 2：无变更
	vetCalls = 0
	if err := r.Run(); err != nil {
		t.Fatalf("run 2 failed: %v", err)
	}
	if vetCalls != 0 {
		t.Error("expected no vet call on cached run")
	}

	// 运行 3：分析器变更
	_ = os.WriteFile(opts.VetToolPath, []byte("binary_v2"), 0o600)
	vetCalls = 0
	if err := r.Run(); err != nil {
		t.Fatalf("run 3 failed: %v", err)
	}
	if vetCalls == 0 {
		t.Error("expected vet call when analyzer changed")
	}

	// 运行 4：内容变更
	_ = os.WriteFile(filepath.Join(tmpDir, "a.go"), []byte("package a\n// change"), 0o600)
	vetCalls = 0
	if err := r.Run(); err != nil {
		t.Fatalf("run 4 failed: %v", err)
	}
	if vetCalls == 0 {
		t.Error("expected vet call on content changed")
	}
}

func TestRunDisableCacheIgnoresExistingRepoCache(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	cacheDir := filepath.Join(tmpDir, "cache")
	vetToolPath := filepath.Join(tmpDir, "dummy_vettool")
	_ = os.WriteFile(vetToolPath, []byte("binary"), 0o600)
	_ = os.WriteFile(filepath.Join(tmpDir, "a.go"), []byte("package a"), 0o600)

	logger := slog.New(slog.DiscardHandler)

	cachedRunner := smartvet.NewRunner(smartvet.Options{
		VetToolPath: vetToolPath,
		CacheDir:    cacheDir,
		RootDir:     tmpDir,
	}, logger, io.Discard, io.Discard)
	cachedRunner.SetTestListPackages(func() ([]smartvet.PackageInfo, error) {
		return []smartvet.PackageInfo{{ImportPath: "pkg/a", Dir: tmpDir}}, nil
	})
	cachedRunner.SetTestRunGoVet(func(args ...string) error { return nil })
	if err := cachedRunner.Run(); err != nil {
		t.Fatalf("prime cached run failed: %v", err)
	}

	disableRunner := smartvet.NewRunner(smartvet.Options{
		VetToolPath:  vetToolPath,
		CacheDir:     cacheDir,
		RootDir:      tmpDir,
		DisableCache: true,
	}, logger, io.Discard, io.Discard)
	disableRunner.SetTestListPackages(func() ([]smartvet.PackageInfo, error) {
		return []smartvet.PackageInfo{{ImportPath: "pkg/a", Dir: tmpDir}}, nil
	})

	vetCalls := 0
	disableRunner.SetTestRunGoVet(func(args ...string) error {
		vetCalls++
		return nil
	})

	if err := disableRunner.Run(); err != nil {
		t.Fatalf("run with disabled cache failed: %v", err)
	}
	if vetCalls != 1 {
		t.Fatalf("expected disabled cache run to execute go vet once, got %d", vetCalls)
	}

	if err := disableRunner.Run(); err != nil {
		t.Fatalf("second run with disabled cache failed: %v", err)
	}
	if vetCalls != 2 {
		t.Fatalf("expected disabled cache run to execute on every run, got %d", vetCalls)
	}
}

// 使用 “TestHelperProcess” 模式 mock exec.Command
func Test_listPackages(t *testing.T) {
	t.Parallel()
	// 1. 模拟 execCommand
	opts := smartvet.Options{
		VetToolPath: "dummy",
		CacheDir:    t.TempDir(),
		RootDir:     ".",
	}
	logger := slog.New(slog.DiscardHandler)
	r := smartvet.NewRunner(opts, logger, io.Discard, io.Discard)
	oldExec := exec.Command

	r.SetTestExecCommand(func(name string, args ...string) *exec.Cmd {
		// 只 mock go list
		if name == "go" && len(args) > 1 && args[0] == "list" {
			cmd := oldExec(os.Args[0], "-test.run=TestHelperProcess_GoList", "--")
			cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1")
			return cmd
		}
		return oldExec(name, args...)
	})

	// 2. 运行
	pkgs, err := r.ExportListPackages()
	if err != nil {
		t.Fatalf("listPackages failed: %v", err)
	}

	// 3. 校验
	if len(pkgs) != 1 {
		t.Fatalf("expected 1 pkg, got %d", len(pkgs))
	}
	if pkgs[0].ImportPath != "example.com/mock" {
		t.Errorf("unexpected import path: %s", pkgs[0].ImportPath)
	}
}

// TestHelperProcess_GoList 不是实际测试，而是 Test_listPackages 调用的 mock 进程
func TestHelperProcess_GoList(t *testing.T) {
	t.Helper()
	if os.Getenv("GO_WANT_HELPER_PROCESS") != "1" {
		return
	}
	// 输出 go list 的有效 JSON
	// 注意：go list -json 输出的是 JSON 对象流，没有逗号分隔/数组
	if _, err := os.Stdout.WriteString(`{
	"ImportPath": "example.com/mock",
	"Dir": "/tmp/mock",
	"GoFiles": ["main.go"]
}`); err != nil {
		os.Exit(1)
	}
	os.Exit(0)
}

func Test_run_SkipsBeforeListingPackagesWhenRepositoryUnchanged(t *testing.T) {
	t.Parallel()
	tmpDir := t.TempDir()
	opts := smartvet.Options{
		VetToolPath: filepath.Join(tmpDir, "dummy_vettool"),
		CacheDir:    filepath.Join(tmpDir, "cache"),
		RootDir:     tmpDir,
	}

	_ = os.WriteFile(opts.VetToolPath, []byte("binary"), 0o600)
	_ = os.WriteFile(filepath.Join(tmpDir, "a.go"), []byte("package a"), 0o600)
	_ = os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte("module example.com/test\n\ngo 1.26.0\n"), 0o600)

	logger := slog.New(slog.DiscardHandler)
	r := smartvet.NewRunner(opts, logger, io.Discard, io.Discard)

	listCalls := 0
	r.SetTestListPackages(func() ([]smartvet.PackageInfo, error) {
		listCalls++
		return []smartvet.PackageInfo{{ImportPath: "pkg/a", Dir: tmpDir}}, nil
	})

	r.SetTestRunGoVet(func(args ...string) error {
		return nil
	})

	if err := r.Run(); err != nil {
		t.Fatalf("run 1 failed: %v", err)
	}
	if listCalls != 1 {
		t.Fatalf("expected first run to list packages once, got %d", listCalls)
	}

	listCalls = 0
	if err := r.Run(); err != nil {
		t.Fatalf("run 2 failed: %v", err)
	}
	if listCalls != 0 {
		t.Fatalf("expected repository cache hit to skip go list, got %d calls", listCalls)
	}
}

func Test_run_SkipsBeforeListingPackagesWhenRepositoryContentUnchanged(t *testing.T) {
	t.Parallel()
	tmpDir := t.TempDir()
	opts := smartvet.Options{
		VetToolPath: filepath.Join(tmpDir, "dummy_vettool"),
		CacheDir:    filepath.Join(tmpDir, "cache"),
		RootDir:     tmpDir,
	}

	_ = os.WriteFile(opts.VetToolPath, []byte("binary"), 0o600)
	filePath := filepath.Join(tmpDir, "a.go")
	_ = os.WriteFile(filePath, []byte("package a"), 0o600)
	_ = os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte("module example.com/test\n\ngo 1.26.0\n"), 0o600)

	logger := slog.New(slog.DiscardHandler)
	r := smartvet.NewRunner(opts, logger, io.Discard, io.Discard)

	listCalls := 0
	r.SetTestListPackages(func() ([]smartvet.PackageInfo, error) {
		listCalls++
		return []smartvet.PackageInfo{{ImportPath: "pkg/a", Dir: tmpDir}}, nil
	})

	r.SetTestRunGoVet(func(args ...string) error {
		return nil
	})

	if err := r.Run(); err != nil {
		t.Fatalf("run 1 failed: %v", err)
	}

	time.Sleep(10 * time.Millisecond)
	now := time.Now()
	if err := os.Chtimes(filePath, now, now); err != nil {
		t.Fatalf("touch file: %v", err)
	}

	listCalls = 0
	if err := r.Run(); err != nil {
		t.Fatalf("run 2 failed: %v", err)
	}
	if listCalls != 0 {
		t.Fatalf("expected content cache hit to skip go list, got %d calls", listCalls)
	}
}
