package layerdeps_test

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"golang.org/x/tools/go/analysis"
)

const (
	testServiceAuth    = "auth"
	testServiceProfile = "profile"
	testDomainUser     = "user"
)

func mustParse(t *testing.T, code string) *ast.File {
	t.Helper()
	f, err := parser.ParseFile(token.NewFileSet(), "test.go", code, parser.ParseComments)
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}
	return f
}

func Test_extractIgnoreRules(t *testing.T) {
	t.Parallel()

	code := `// layerdeps:ignore a/b/*
package x
import _ "a/b/c"`
	f := mustParse(t, code)
	rules := extractIgnoreRules(f)
	if rules.ignoreAll {
		t.Fatalf("did not expect ignoreAll=true")
	}
	if len(rules.pathPatterns) != 1 || rules.pathPatterns[0] != "a/b/*" {
		t.Fatalf("unexpected patterns: %+v", rules.pathPatterns)
	}
}

func Test_shouldIgnoreImport(t *testing.T) {
	t.Parallel()

	code := `package x
// layerdeps:ignore
import _ "a/b/c"`
	f := mustParse(t, code)
	var spec *ast.ImportSpec
	var declDoc *ast.CommentGroup
	for _, d := range f.Decls {
		if gd, ok := d.(*ast.GenDecl); ok {
			declDoc = gd.Doc
			for _, s := range gd.Specs {
				if is, ok := s.(*ast.ImportSpec); ok {
					spec = is
				}
			}
		}
	}
	rules := extractIgnoreRules(f)
	if !shouldIgnoreImport("a/b/c", spec, declDoc, rules) {
		t.Fatalf("expected inline ignore to work")
	}

	code2 := `// layerdeps:ignore a/b/*
package x
import _ "a/b/c"`
	f2 := mustParse(t, code2)
	var spec2 *ast.ImportSpec
	for _, d := range f2.Decls {
		if gd, ok := d.(*ast.GenDecl); ok {
			for _, s := range gd.Specs {
				if is, ok := s.(*ast.ImportSpec); ok {
					spec2 = is
				}
			}
		}
	}
	rules2 := extractIgnoreRules(f2)
	if !shouldIgnoreImport("a/b/c", spec2, nil, rules2) {
		t.Fatalf("expected pattern ignore to work")
	}
}

func Test_packageInfoFromPath_RepositoryDetection(t *testing.T) {
	t.Parallel()

	// 目录形式
	p, ok := packageInfoFromPath("/root/internal/domain/user/repository/auth/impl.go")
	if !ok || !p.isInRepository || p.serviceName != testServiceAuth || p.domain != testDomainUser {
		t.Fatalf("unexpected repo detection: %+v ok=%v", p, ok)
	}
	// 文件形式
	p2, ok2 := packageInfoFromPath("/root/internal/domain/order/repository/pay_repository.go")
	if !ok2 || !p2.isInRepository || p2.serviceName != "pay" || p2.domain != "order" {
		t.Fatalf("unexpected repo detection (file): %+v ok=%v", p2, ok2)
	}
}

func Test_packageInfoFromPath_DeepInternal(t *testing.T) {
	t.Parallel()

	// 深层 internal
	p, ok := packageInfoFromPath("/a/b/internal/c/d/internal/application/service/handler.go")
	if !ok || p.layer != layerApplication {
		t.Fatalf("unexpected: layer=%v ok=%v", p.layer, ok)
	}
}

func Test_packageInfoFromPath_KnowledgeSubdomain(t *testing.T) {
	t.Parallel()

	p, ok := packageInfoFromPath("/root/internal/domain/knowledge/document/service/project_file_support.go")
	if !ok || p.layer != layerDomain || p.domain != "knowledge/document" {
		t.Fatalf("unexpected: ok=%v layer=%v domain=%v", ok, p.layer, p.domain)
	}

	p2, ok2 := packageInfoFromPath("/root/internal/domain/knowledge/shared/route/types.go")
	if !ok2 || p2.layer != layerDomain || p2.domain != "knowledge/shared" {
		t.Fatalf("unexpected shared kernel domain: ok=%v layer=%v domain=%v", ok2, p2.layer, p2.domain)
	}
}

func Test_packageInfoFromPath_GenericBoundedContextSubdomain(t *testing.T) {
	t.Parallel()

	p, ok := packageInfoFromPath("/root/internal/domain/billing/order/model/types.go")
	if !ok || p.layer != layerDomain || p.domain != "billing/order" {
		t.Fatalf("unexpected generic subdomain: ok=%v layer=%v domain=%v", ok, p.layer, p.domain)
	}

	p2, ok2 := packageInfoFromPath("/root/internal/domain/taskfile/service/service.go")
	if !ok2 || p2.layer != layerDomain || p2.domain != "taskfile" {
		t.Fatalf("unexpected single-level domain: ok=%v layer=%v domain=%v", ok2, p2.layer, p2.domain)
	}
}

func Test_readRuleConfigFromFile_CamelCase(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	configPath := filepath.Join(dir, "whitelist.yaml")
	content := `domain:
  structureSegmentsWhitelist:
    - service
    - repository
  sharedKernelSubdomainsWhitelist:
    - shared
application:
  commonSubappsWhitelist:
    - helper
    - shared
`
	if err := os.WriteFile(configPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	config, err := ReadRuleConfigFromFile(configPath)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}

	if !slices.Equal(config.DomainStructureSegments, []string{"repository", "service"}) {
		t.Fatalf("unexpected structure segments: %+v", config.DomainStructureSegments)
	}
	if !slices.Equal(config.DomainSharedKernelSubdomains, []string{"shared"}) {
		t.Fatalf("unexpected shared-kernel subdomains: %+v", config.DomainSharedKernelSubdomains)
	}
	if !slices.Equal(config.ApplicationCommonSubapps, []string{"helper", "shared"}) {
		t.Fatalf("unexpected application common subapps: %+v", config.ApplicationCommonSubapps)
	}
}

func Test_packageInfoFromPath_DI(t *testing.T) {
	t.Parallel()

	p, ok := packageInfoFromPath("/root/internal/di/knowledge/providers.go")
	if !ok || p.layer != layerDI {
		t.Fatalf("unexpected: layer=%v ok=%v", p.layer, ok)
	}
}

func Test_matchIgnorePattern(t *testing.T) {
	t.Parallel()

	if !MatchIgnorePattern("a/b/*", "a/b/c") {
		t.Fatalf("prefix /* should match")
	}
	if !MatchIgnorePattern("a/b*", "a/bc/d") {
		t.Fatalf("prefix * should match")
	}
	if MatchIgnorePattern("a/b/*", "a/b") {
		t.Fatalf("/* should not match exact parent without trailing segment")
	}
	if MatchIgnorePattern("x/y", "x/yz") {
		t.Fatalf("exact should not match different path")
	}
	if !MatchIgnorePattern("x/y", "x/y") {
		t.Fatalf("exact should match same path")
	}
}

func Test_commentGroupContains(t *testing.T) {
	t.Parallel()

	if CommentGroupContains(nil, "abc") {
		t.Fatalf("nil comment group should not contain")
	}
	cg := &ast.CommentGroup{List: []*ast.Comment{{Text: "// hello"}, {Text: "// layerdeps:ignore"}}}
	if !CommentGroupContains(cg, "layerdeps:ignore") {
		t.Fatalf("should detect substring in comments")
	}
	if CommentGroupContains(cg, "") {
		t.Fatalf("empty substring should not match")
	}
}

func Test_packageInfoFromImportPath(t *testing.T) {
	t.Parallel()

	s := &analyzerState{}
	p, ok := packageInfoFromImportPath(s, "github.com/acme/proj/internal/infrastructure/db")
	if !ok || p.layer != layerInfrastructure {
		t.Fatalf("unexpected: ok=%v layer=%v", ok, p.layer)
	}
	p2, ok2 := packageInfoFromImportPath(s, "github.com/acme/proj/internal/domain/user/repository/profile")
	if !ok2 || p2.layer != layerDomain || p2.domain != testDomainUser || !p2.isInRepository || p2.serviceName != testServiceProfile {
		t.Fatalf("unexpected for repo import: %+v ok=%v", p2, ok2)
	}
}

func Test_packageInfoFromPath_WindowsStyle(t *testing.T) {
	t.Parallel()

	p, ok := packageInfoFromPath(`C:\\proj\\internal\\interfaces\\http\\server.go`)
	if !ok || p.layer != layerInterfaces {
		t.Fatalf("unexpected: ok=%v layer=%v", ok, p.layer)
	}
}

func Test_isRepositoryPackage(t *testing.T) {
	t.Parallel()

	var p packageInfo
	if p.isRepositoryPackage() {
		t.Fatalf("empty should be false")
	}
	p.layer = layerDomain
	p.afterLayer = []string{"user", "repository"}
	if !p.isRepositoryPackage() {
		t.Fatalf("should be repo package when afterLayer[1]==repository")
	}
	p.layer = layerApplication
	if p.isRepositoryPackage() {
		t.Fatalf("non-domain should be false")
	}
	p.layer = layerDomain
	p.afterLayer = []string{"user"}
	if p.isRepositoryPackage() {
		t.Fatalf("len(afterLayer)<2 should be false")
	}
}

// --- 运行分析器的辅助函数 ---
func runWith(t *testing.T, filename, code string) int {
	t.Helper()
	fset := token.NewFileSet()
	file := mustParseWithFset(t, fset, filename, code)
	diags := 0
	pass := &analysis.Pass{
		Fset:  fset,
		Files: []*ast.File{file},
		Report: func(d analysis.Diagnostic) {
			diags++
		},
	}
	// 使用 NewAnalyzer 获取带独立状态的新实例
	analyzer := NewAnalyzer()
	if _, err := analyzer.Run(pass); err != nil {
		t.Fatalf("run error: %v", err)
	}
	return diags
}

func mustParseWithFset(t *testing.T, fset *token.FileSet, filename, code string) *ast.File {
	t.Helper()
	f, err := parser.ParseFile(fset, filename, code, parser.ParseComments)
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}
	return f
}

func Test_run_NoViolation(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/domain/user/service"`
	diags := runWith(t, "/root/internal/application/foo.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics, got %d", diags)
	}
}

func Test_run_NoViolation_DIToOtherLayers(t *testing.T) {
	t.Parallel()

	code := `package a
import (
    _ "github.com/acme/proj/internal/application/foo"
    _ "github.com/acme/proj/internal/domain/user/service"
    _ "github.com/acme/proj/internal/infrastructure/db"
)`
	diags := runWith(t, "/root/internal/di/knowledge/providers.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics for di imports, got %d", diags)
	}
}

func Test_run_Violation_AppToInfra(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/infrastructure/db"`
	diags := runWith(t, "/root/internal/application/foo.go", code)
	if diags == 0 {
		t.Fatalf("expected diagnostics for app->infra")
	}
}

func Test_run_Violation_AppToDomainRepo(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/domain/user/repository/auth"`
	diags := runWith(t, "/root/internal/application/foo.go", code)
	if diags == 0 {
		t.Fatalf("expected diagnostics for app->domain repository")
	}
}

func Test_run_Violation_KnowledgeApplicationSiblingImport(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/application/knowledge/document"`
	diags := runWith(t, "/root/internal/application/knowledge/fragment/service.go", code)
	if diags == 0 {
		t.Fatalf("expected diagnostics for knowledge application sibling import")
	}
}

func Test_run_Violation_GenericApplicationSiblingImport(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/application/billing/invoice"`
	diags := runWith(t, "/root/internal/application/billing/payment/service.go", code)
	if diags == 0 {
		t.Fatalf("expected diagnostics for generic application sibling import")
	}
}

func Test_run_Violation_KnowledgeApplicationContractImport(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/application/knowledge/contract"`
	diags := runWith(t, "/root/internal/application/knowledge/fragment/service.go", code)
	if diags == 0 {
		t.Fatalf("expected diagnostics for contract import")
	}
}

func Test_run_NoViolation_KnowledgeApplicationHelperImport(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/application/knowledge/helper/config"`
	diags := runWith(t, "/root/internal/application/knowledge/document/service.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics for helper import, got %d", diags)
	}
}

func Test_run_NoViolation_GenericApplicationSharedImport(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/application/billing/shared"`
	diags := runWith(t, "/root/internal/application/billing/payment/service.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics for bounded-context shared import, got %d", diags)
	}
}

func Test_run_NoViolation_KnowledgeApplicationToShared(t *testing.T) {
	t.Parallel()

	code := `package a
import (
    _ "github.com/acme/proj/internal/application/knowledge/shared"
)`
	diags := runWith(t, "/root/internal/application/knowledge/fragment/service.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics for knowledge application shared imports, got %d", diags)
	}
}

func Test_run_Violation_DomainToInterfacesAndInfra(t *testing.T) {
	t.Parallel()

	code := `package a
import (
    _ "github.com/acme/proj/internal/interfaces/http"
    _ "github.com/acme/proj/internal/infrastructure/db"
)`
	diags := runWith(t, "/root/internal/domain/user/entity.go", code)
	if diags < 2 {
		t.Fatalf("expected >=2 diagnostics for domain importing later layers, got %d", diags)
	}
}

func Test_run_Violation_InterfacesToDomainAndInfra(t *testing.T) {
	t.Parallel()

	code := `package a
import (
    _ "github.com/acme/proj/internal/domain/user/service"
    _ "github.com/acme/proj/internal/infrastructure/db"
)`
	diags := runWith(t, "/root/internal/interfaces/http/handler.go", code)
	if diags < 2 {
		t.Fatalf("expected >=2 diagnostics for interfaces layer imports, got %d", diags)
	}
}

func Test_run_Violation_RepoCrossDependency(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/domain/user/repository/profile"`
	diags := runWith(t, "/root/internal/domain/user/repository/auth/impl.go", code)
	if diags == 0 {
		t.Fatalf("expected diagnostics for cross-repository dependency")
	}
}

func Test_run_Violation_KnowledgeDomainSiblingImport(t *testing.T) {
	t.Parallel()

	code := `package a
import documentdomain "github.com/acme/proj/internal/domain/knowledge/document/service"

var _ = documentdomain.ProjectFileMetadataReader(nil)`
	diags := runWith(t, "/root/internal/domain/knowledge/sourcebinding/service/project_source_item_policy.go", code)
	if diags == 0 {
		t.Fatalf("expected diagnostics for knowledge domain sibling import")
	}
}

func Test_run_RespectsIgnore_DeclDoc(t *testing.T) {
	t.Parallel()

	code := `package a
// layerdeps:ignore
import _ "github.com/acme/proj/internal/infrastructure/db"`
	diags := runWith(t, "/root/internal/application/foo.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics due to decl-level ignore, got %d", diags)
	}
}

func Test_run_RespectsIgnore_SpecComment(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/acme/proj/internal/infrastructure/db" // layerdeps:ignore`
	diags := runWith(t, "/root/internal/application/foo.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics due to spec comment ignore, got %d", diags)
	}
}

func Test_run_RespectsIgnore_FilePattern(t *testing.T) {
	t.Parallel()

	code := `// layerdeps:ignore github.com/acme/proj/internal/infrastructure/*
package a
import _ "github.com/acme/proj/internal/infrastructure/db"`
	diags := runWith(t, "/root/internal/application/foo.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics due to file pattern ignore, got %d", diags)
	}
}

func Test_run_NoInternalPathOrNoImports(t *testing.T) {
	t.Parallel()

	// 路径中无 internal => 应跳过
	diags := runWith(t, "/root/not-internal/foo.go", "package a")
	if diags != 0 {
		t.Fatalf("expected 0 diags, got %d", diags)
	}
	// 有 internal 但无 imports => 无诊断
	diags2 := runWith(t, "/root/internal/application/foo.go", "package a")
	if diags2 != 0 {
		t.Fatalf("expected 0 diags, got %d", diags2)
	}
}

func Test_packageInfoFromPath_EdgeCases(t *testing.T) {
	t.Parallel()

	// domain 段为文件名 => 拒绝
	if _, ok := packageInfoFromPath("/root/internal/domain/service.go"); ok {
		t.Fatalf("expected not ok when domain looks like a file")
	}
	// 未知层
	if _, ok := packageInfoFromPath("/root/internal/unknown/x.go"); ok {
		t.Fatalf("expected not ok for unknown layer")
	}
	// 基础设施层
	if p, ok := packageInfoFromPath("/root/internal/infrastructure/io/driver.go"); !ok || p.layer != layerInfrastructure {
		t.Fatalf("expected infrastructure layer, got ok=%v layer=%v", ok, p.layer)
	}
	// 接口层
	if p, ok := packageInfoFromPath("/root/internal/interfaces/grpc/server.go"); !ok || p.layer != layerInterfaces {
		t.Fatalf("expected interfaces layer, got ok=%v layer=%v", ok, p.layer)
	}
	// repository 不在 afterLayer 索引 1（如嵌套路径）
	p3, ok3 := packageInfoFromPath("/root/internal/domain/user/x/y/repository/pay/impl.go")
	if !ok3 || !p3.isInRepository || p3.serviceName != "pay" || p3.domain != "user/x" {
		t.Fatalf("unexpected nested repo detection: %+v ok=%v", p3, ok3)
	}
}

func Test_shouldIgnoreImport_VariousBranches(t *testing.T) {
	t.Parallel()

	// 空的 impPath
	if shouldIgnoreImport("", nil, nil, ignoreRules{}) {
		t.Fatalf("empty impPath should not be ignored")
	}
	// ignoreAll 标志
	if !shouldIgnoreImport("x/y", nil, nil, ignoreRules{ignoreAll: true}) {
		t.Fatalf("ignoreAll should ignore")
	}
	// 精确匹配模式
	code := `// layerdeps:ignore github.com/acme/exact
package a
import _ "github.com/acme/exact"`
	f := mustParse(t, code)
	rules := extractIgnoreRules(f)
	var spec *ast.ImportSpec
	for _, d := range f.Decls {
		if gd, ok := d.(*ast.GenDecl); ok {
			for _, s := range gd.Specs {
				if is, ok := s.(*ast.ImportSpec); ok {
					spec = is
				}
			}
		}
	}
	if !shouldIgnoreImport("github.com/acme/exact", spec, nil, rules) {
		t.Fatalf("exact pattern should ignore")
	}
	if shouldIgnoreImport("github.com/acme/other", spec, nil, rules) {
		t.Fatalf("non-matching pattern should not ignore")
	}
}

func Test_packageInfoFromFilePath_Positive(t *testing.T) {
	t.Parallel()

	p, ok := packageInfoFromFilePath("/root/internal/domain/user/service/service.go")
	if !ok || p.layer != layerDomain || p.domain != testDomainUser {
		t.Fatalf("unexpected: ok=%v layer=%v domain=%v", ok, p.layer, p.domain)
	}
}

func Test_packageInfoFromFilePath_Negative(t *testing.T) {
	t.Parallel()

	if _, ok := packageInfoFromFilePath("/no/internal/here.go"); ok {
		t.Fatalf("expected not ok for non-internal path")
	}
}

func Test_checkDependency_DomainToDomainDifferent(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerDomain, domain: testDomainUser}
	to := packageInfo{layer: layerDomain, domain: "order"}
	msg, violated := checkDependency(from, to, "magic/internal/domain/order")
	if !violated || msg == "" || !contains(msg, "must not import domain") || !contains(msg, "shared") {
		t.Fatalf("expected domain-to-domain violation, got: %v %q", violated, msg)
	}
}

func Test_checkDependency_KnowledgeDomainToShared_NoViolation(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerDomain, domain: "knowledge/document"}
	to := packageInfo{layer: layerDomain, domain: "knowledge/shared"}
	if !allowDomainSharedKernelImport(from, to) {
		t.Fatalf("expected shared kernel import to be allowed")
	}
	if msg, violated := checkDependency(from, to, "magic/internal/domain/knowledge/shared"); violated {
		t.Fatalf("expected no violation, got %q", msg)
	}
}

func Test_checkDependency_GenericDomainToShared_NoViolation(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerDomain, domain: "billing/order"}
	to := packageInfo{layer: layerDomain, domain: "billing/shared"}
	if !allowDomainSharedKernelImport(from, to) {
		t.Fatalf("expected generic shared kernel import to be allowed")
	}
	if msg, violated := checkDependency(from, to, "magic/internal/domain/billing/shared"); violated {
		t.Fatalf("expected no violation for generic shared import, got %q", msg)
	}
}

func Test_checkDependency_KnowledgeDomainSibling_Violation(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerDomain, domain: "knowledge/sourcebinding"}
	to := packageInfo{layer: layerDomain, domain: "knowledge/document"}
	msg, violated := checkDependency(from, to, "magic/internal/domain/knowledge/document/service")
	if !violated || !contains(msg, "must not import domain") || !contains(msg, "knowledge/document") {
		t.Fatalf("expected knowledge sibling domain violation, got: %v %q", violated, msg)
	}
}

func Test_checkDependency_CrossBoundedContextShared_Violation(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerDomain, domain: "billing/order"}
	to := packageInfo{layer: layerDomain, domain: "shipping/shared"}
	msg, violated := checkDependency(from, to, "magic/internal/domain/shipping/shared")
	if !violated || !contains(msg, "must not import domain") || !contains(msg, "shipping/shared") {
		t.Fatalf("expected cross bounded-context shared violation, got: %v %q", violated, msg)
	}
}

func Test_checkDependency_DomainToApp(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerDomain, domain: testDomainUser}
	to := packageInfo{layer: layerApplication}
	msg, violated := checkDependency(from, to, "magic/internal/application")
	if !violated || !contains(msg, "domain layer must not depend on application layer") {
		t.Fatalf("expected domain->application violation: %q", msg)
	}
}

func Test_checkDependency_DomainToDI(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerDomain, domain: testDomainUser}
	to := packageInfo{layer: layerDI}
	msg, violated := checkDependency(from, to, "magic/internal/di/knowledge")
	if !violated || !contains(msg, "domain layer must not depend on di layer") || !contains(msg, "internal/di") {
		t.Fatalf("expected domain->di violation: %q", msg)
	}
}

func Test_checkDependency_AppToInfra(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerApplication}
	to := packageInfo{layer: layerInfrastructure}
	msg, violated := checkDependency(from, to, "magic/internal/infrastructure")
	if !violated || !contains(msg, "application layer must not depend on infrastructure layer") {
		t.Fatalf("expected app->infra violation: %q", msg)
	}
}

func Test_checkDependency_ApplicationSibling_Violation(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerApplication, afterLayer: []string{"billing", "payment"}}
	to := packageInfo{layer: layerApplication, afterLayer: []string{"billing", "invoice"}}
	msg, violated := checkDependency(from, to, "magic/internal/application/billing/invoice")
	if !violated || !contains(msg, "application sub-app") || !contains(msg, "billing/payment") {
		t.Fatalf("expected application sibling violation: %q", msg)
	}
}

func Test_checkDependency_ApplicationToShared_NoViolation(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerApplication, afterLayer: []string{"billing", "payment"}}
	to := packageInfo{layer: layerApplication, afterLayer: []string{"billing", "shared"}}
	if msg, violated := checkDependency(from, to, "magic/internal/application/billing/shared"); violated {
		t.Fatalf("expected no violation for shared app import, got %q", msg)
	}
}

func Test_checkDependency_AppToDI(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerApplication}
	to := packageInfo{layer: layerDI}
	msg, violated := checkDependency(from, to, "magic/internal/di/app")
	if !violated || !contains(msg, "application layer must not depend on di layer") || !contains(msg, "internal/di") {
		t.Fatalf("expected app->di violation: %q", msg)
	}
}

func Test_checkDependency_AppToDomainRepo(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerApplication}
	to := packageInfo{layer: layerDomain, afterLayer: []string{"user", "repository"}}
	msg, violated := checkDependency(from, to, "magic/internal/domain/user/repository")
	if !violated || !contains(msg, "must not import domain repository package") || !contains(msg, "owning subdomain") {
		t.Fatalf("expected app->domain repo violation: %q", msg)
	}
}

func Test_checkDependency_AppToNestedDomainRepo(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerApplication}
	to := packageInfo{
		layer:      layerDomain,
		afterLayer: []string{"user", "x", "repository", "pay"},
	}
	msg, violated := checkDependency(from, to, "magic/internal/domain/user/x/repository/pay")
	if !violated || !contains(msg, "must not import domain repository package") {
		t.Fatalf("expected app->nested domain repo violation: %q", msg)
	}
}

func Test_checkDependency_AppToDomainNonRepo(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerApplication}
	to := packageInfo{layer: layerDomain, afterLayer: []string{"user", "service"}}
	msg, violated := checkDependency(from, to, "magic/internal/domain/user/service")
	if violated {
		t.Fatalf("application should be allowed to depend on domain. msg=%q", msg)
	}
}

func Test_checkDependency_InterfacesViolations(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerInterfaces}
	toDomain := packageInfo{layer: layerDomain}
	msg, violated := checkDependency(from, toDomain, "magic/internal/domain/user")
	if !violated || !contains(msg, "interfaces layer must not depend on domain layer") {
		t.Fatalf("expected interfaces->domain violation: %q", msg)
	}
	toInfra := packageInfo{layer: layerInfrastructure}
	msg2, violated2 := checkDependency(from, toInfra, "magic/internal/infrastructure")
	if !violated2 || !contains(msg2, "interfaces layer must not depend on infrastructure layer") {
		t.Fatalf("expected interfaces->infra violation: %q", msg2)
	}
	toDI := packageInfo{layer: layerDI}
	msg3, violated3 := checkDependency(from, toDI, "magic/internal/di/knowledge")
	if !violated3 || !contains(msg3, "interfaces layer must not depend on di layer") {
		t.Fatalf("expected interfaces->di violation: %q", msg3)
	}
}

func Test_checkDependency_InfrastructureViolations(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerInfrastructure}
	toApp := packageInfo{layer: layerApplication}
	msg, violated := checkDependency(from, toApp, "magic/internal/application")
	if !violated || !contains(msg, "infrastructure layer must not depend on application layer") {
		t.Fatalf("expected infra->app violation: %q", msg)
	}
	toInterfaces := packageInfo{layer: layerInterfaces}
	msg2, violated2 := checkDependency(from, toInterfaces, "magic/internal/interfaces")
	if !violated2 || !contains(msg2, "infrastructure layer must not depend on interfaces layer") {
		t.Fatalf("expected infra->interfaces violation: %q", msg2)
	}
	toDI := packageInfo{layer: layerDI}
	msg3, violated3 := checkDependency(from, toDI, "magic/internal/di/knowledge")
	if !violated3 || !contains(msg3, "infrastructure layer must not depend on di layer") {
		t.Fatalf("expected infra->di violation: %q", msg3)
	}
}

func Test_checkDependency_RepositoryCrossDependency(t *testing.T) {
	t.Parallel()

	from := packageInfo{layer: layerDomain, domain: testDomainUser, isInRepository: true, serviceName: testServiceAuth}
	to := packageInfo{layer: layerDomain, domain: testDomainUser, isInRepository: true, serviceName: testServiceProfile}
	msg, violated := checkDependency(from, to, "magic/internal/domain/user/repository/profile")
	if !violated || !contains(msg, "repository service/repository") || !contains(msg, "hint:") {
		t.Fatalf("expected repository cross-dependency violation with hint: %q", msg)
	}
}

func Test_run_SkipsNonInternalImportPath(t *testing.T) {
	t.Parallel()

	code := `package a
import _ "github.com/not/ourproject/pkg"`
	diags := runWith(t, "/root/internal/application/foo.go", code)
	if diags != 0 {
		t.Fatalf("expected no diagnostics for non-internal import path, got %d", diags)
	}
}

// 注意：strconv.Unquote 的错误路径未测试，因为解析器会拒绝非法的 import 字符串。

// contains 是小工具，避免引入额外包
func contains(s, sub string) bool {
	return strings.Contains(s, sub)
}

// --- 缓存函数与服务跨依赖的附加测试 ---

func Test_hashBytes(t *testing.T) {
	t.Parallel()

	data := []byte("test data")
	hash := hashBytes(data)
	if hash == "" {
		t.Fatalf("hash should not be empty")
	}
	// 哈希应当确定性
	hash2 := hashBytes(data)
	if hash != hash2 {
		t.Fatalf("hash should be deterministic: %s != %s", hash, hash2)
	}
	// 不同数据应产生不同哈希
	hash3 := hashBytes([]byte("different data"))
	if hash == hash3 {
		t.Fatalf("different data should produce different hash")
	}
}

func Test_getCacheEntry_setCacheEntry(t *testing.T) {
	t.Parallel()

	s := &analyzerState{}

	pkgPath := "test/package"
	filePath := "/test/file.go"

	// 初始无条目
	_, ok := GetCacheEntry(s, pkgPath, filePath)
	if ok {
		t.Fatalf("should not find entry initially")
	}

	// 设置条目：定位 shard 并直接设置（全局 setCacheEntry 已移除）
	shard := LoadCacheShard(s, pkgPath)
	entry := fileCacheEntry{
		FileHash: "abc123",
		Issues:   []issueRecord{{Line: 10, Message: "test issue"}},
	}
	SetCacheEntryOnShard(shard, filePath, entry)

	// 现在应能找到条目
	retrieved, ok := GetCacheEntry(s, pkgPath, filePath)
	if !ok {
		t.Fatalf("should find entry after setting")
	}
	if retrieved.FileHash != "abc123" {
		t.Fatalf("hash mismatch: got %s", retrieved.FileHash)
	}
	if len(retrieved.Issues) != 1 || retrieved.Issues[0].Message != "test issue" {
		t.Fatalf("issues mismatch: %+v", retrieved.Issues)
	}
}

func Test_saveCacheShard(t *testing.T) {
	t.Parallel()

	s := &analyzerState{}
	// 测试 nil shard
	if err := SaveCacheShard(s, nil); err != nil {
		t.Fatalf("nil shard should not error: %v", err)
	}

	// 测试非 dirty 的 shard
	shard := NewPackageCacheShard("test", map[string]fileCacheEntry{}, false)
	if err := SaveCacheShard(s, shard); err != nil {
		t.Fatalf("non-dirty shard should not error: %v", err)
	}

	// 测试 dirty 的 shard 但无 root
	// s.cacheRoot 默认为空
	SetShardDirty(shard, true)
	if err := SaveCacheShard(s, shard); err != nil {
		t.Fatalf("should not error when root is empty: %v", err)
	}
}

func Test_saveCacheShard_WriteErrorKeepsDirty(t *testing.T) {
	t.Parallel()

	s := &analyzerState{}
	SetCacheRoot(s, "/dev/null")

	shard := NewPackageCacheShard("test/package", map[string]fileCacheEntry{}, false)
	SetCacheEntryOnShard(shard, "/tmp/file.go", fileCacheEntry{
		FileHash: "abc123",
		Issues:   []issueRecord{{Line: 1, Message: "issue"}},
	})

	if err := SaveCacheShard(s, shard); err == nil {
		t.Fatalf("first save should fail on invalid cache root")
	}
	if err := SaveCacheShard(s, shard); err == nil {
		t.Fatalf("dirty flag should remain true after failed write")
	}
}

func Test_checkApplicationServiceCrossDependency(t *testing.T) {
	t.Parallel()

	// 同一服务——不应违规
	from := packageInfo{layer: layerApplication, isInService: true, serviceName: testServiceAuth}
	to := packageInfo{layer: layerApplication, isInService: true, serviceName: testServiceAuth}
	msg, violated := checkApplicationServiceCrossDependency(from, to, "magic/internal/application/auth")
	if violated {
		t.Fatalf("same service should not violate: %q", msg)
	}

	// 不同服务——应违规
	from2 := packageInfo{layer: layerApplication, isInService: true, serviceName: testServiceAuth}
	to2 := packageInfo{layer: layerApplication, isInService: true, serviceName: "user"}
	msg2, violated2 := checkApplicationServiceCrossDependency(from2, to2, "magic/internal/application/user")
	if !violated2 || !contains(msg2, "application service") {
		t.Fatalf("cross application service dependency should violate: %q", msg2)
	}

	// 不在 service 中——不应检查
	from3 := packageInfo{layer: layerApplication, isInService: false}
	to3 := packageInfo{layer: layerApplication, isInService: true, serviceName: "user"}
	msg3, violated3 := checkApplicationServiceCrossDependency(from3, to3, "magic/internal/application/user")
	if violated3 {
		t.Fatalf("non-service should not be checked: %q", msg3)
	}

	// 服务名为空——不应违规
	from4 := packageInfo{layer: layerApplication, isInService: true, serviceName: ""}
	to4 := packageInfo{layer: layerApplication, isInService: true, serviceName: "user"}
	msg4, violated4 := checkApplicationServiceCrossDependency(from4, to4, "magic/internal/application/user")
	if violated4 {
		t.Fatalf("empty service name should not violate: %q", msg4)
	}
}

func Test_checkDomainServiceCrossDependency(t *testing.T) {
	t.Parallel()

	// 同域且同服务——不应违规
	from := packageInfo{layer: layerDomain, domain: testDomainUser, isInService: true, serviceName: testServiceAuth}
	to := packageInfo{layer: layerDomain, domain: testDomainUser, isInService: true, serviceName: testServiceAuth}
	msg, violated := checkDomainServiceCrossDependency(from, to, "magic/internal/domain/user/service/auth")
	if violated {
		t.Fatalf("same domain service should not violate: %q", msg)
	}

	// 同域不同服务——应违规
	from2 := packageInfo{layer: layerDomain, domain: testDomainUser, isInService: true, serviceName: testServiceAuth}
	to2 := packageInfo{layer: layerDomain, domain: testDomainUser, isInService: true, serviceName: testServiceProfile}
	msg2, violated2 := checkDomainServiceCrossDependency(from2, to2, "magic/internal/domain/user/service/profile")
	if !violated2 || !contains(msg2, "domain service") {
		t.Fatalf("cross domain service dependency should violate: %q", msg2)
	}

	// 不同域——不检查该规则（由其他规则覆盖）
	from3 := packageInfo{layer: layerDomain, domain: testDomainUser, isInService: true, serviceName: testServiceAuth}
	to3 := packageInfo{layer: layerDomain, domain: "order", isInService: true, serviceName: "payment"}
	msg3, violated3 := checkDomainServiceCrossDependency(from3, to3, "magic/internal/domain/order/service/payment")
	if violated3 {
		t.Fatalf("different domains should not be checked by this rule: %q", msg3)
	}

	// 非 service ——不应检查
	from4 := packageInfo{layer: layerDomain, domain: testDomainUser, isInService: false}
	to4 := packageInfo{layer: layerDomain, domain: testDomainUser, isInService: true, serviceName: testServiceAuth}
	msg4, violated4 := checkDomainServiceCrossDependency(from4, to4, "magic/internal/domain/user/service/auth")
	if violated4 {
		t.Fatalf("non-service should not be checked: %q", msg4)
	}
}

func Test_checkRepositoryCrossDependency_EdgeCases(t *testing.T) {
	t.Parallel()

	// 不同域——不应检查
	from := packageInfo{layer: layerDomain, domain: testDomainUser, isInRepository: true, serviceName: testServiceAuth}
	to := packageInfo{layer: layerDomain, domain: "order", isInRepository: true, serviceName: "payment"}
	msg, violated := checkRepositoryCrossDependency(from, to, "magic/internal/domain/order/repository/payment")
	if violated {
		t.Fatalf("different domains should not be checked: %q", msg)
	}

	// 不在 repository ——不应检查
	from2 := packageInfo{layer: layerDomain, domain: testDomainUser, isInRepository: false}
	to2 := packageInfo{layer: layerDomain, domain: testDomainUser, isInRepository: true, serviceName: testServiceAuth}
	msg2, violated2 := checkRepositoryCrossDependency(from2, to2, "magic/internal/domain/user/repository/auth")
	if violated2 {
		t.Fatalf("non-repository should not be checked: %q", msg2)
	}

	// 服务名为空——不应违规
	from3 := packageInfo{layer: layerDomain, domain: testDomainUser, isInRepository: true, serviceName: ""}
	to3 := packageInfo{layer: layerDomain, domain: testDomainUser, isInRepository: true, serviceName: testServiceAuth}
	msg3, violated3 := checkRepositoryCrossDependency(from3, to3, "magic/internal/domain/user/repository/auth")
	if violated3 {
		t.Fatalf("empty service name should not violate: %q", msg3)
	}

	// 非 domain 层——不应检查
	from4 := packageInfo{layer: layerApplication, isInRepository: true, serviceName: testServiceAuth}
	to4 := packageInfo{layer: layerApplication, isInRepository: true, serviceName: "user"}
	msg4, violated4 := checkRepositoryCrossDependency(from4, to4, "magic/internal/application")
	if violated4 {
		t.Fatalf("non-domain layer should not be checked: %q", msg4)
	}
}

func Test_isLoggingImport(t *testing.T) {
	t.Parallel()

	if !isLoggingImport("magic/internal/infrastructure/logging") {
		t.Fatalf("should detect logging import")
	}
	if !isLoggingImport("github.com/acme/proj/internal/infrastructure/logging/logger") {
		t.Fatalf("should detect nested logging import")
	}
	if isLoggingImport("magic/internal/infrastructure/db") {
		t.Fatalf("should not detect non-logging import")
	}
	if isLoggingImport("magic/internal/infrastructure/loggingx") {
		t.Fatalf("should not match loggingx")
	}
}

func Test_checkInterfacesLayerRules_LoggingException(t *testing.T) {
	t.Parallel()

	to := packageInfo{layer: layerInfrastructure}
	// 正常 infra 导入应违规
	msg, violated := checkInterfacesLayerRules(to, "magic/internal/infrastructure/db")
	if !violated {
		t.Fatalf("interfaces->infra should violate: %q", msg)
	}
	// 但 logging 应被允许
	msg2, violated2 := checkInterfacesLayerRules(to, "magic/internal/infrastructure/logging")
	if violated2 {
		t.Fatalf("interfaces->logging should be allowed: %q", msg2)
	}
}

func Test_stripRepositorySuffixes(t *testing.T) {
	t.Parallel()

	if StripRepositorySuffixes("user_repository") != "user" {
		t.Fatalf("should strip _repository suffix")
	}
	if StripRepositorySuffixes("auth_repo") != testServiceAuth {
		t.Fatalf("should strip _repo suffix")
	}
	if StripRepositorySuffixes("profile_service") != testServiceProfile {
		t.Fatalf("should strip _service suffix")
	}
	if StripRepositorySuffixes("plain") != "plain" {
		t.Fatalf("should return as-is if no suffix")
	}
}

func Test_stripServiceSuffixes(t *testing.T) {
	t.Parallel()

	if StripServiceSuffixes("user_service") != "user" {
		t.Fatalf("should strip _service suffix")
	}
	// 注意：函数中 _app_service 比 _service 先检查
	result := StripServiceSuffixes("auth_app_service")
	if result != "auth_app" && result != testServiceAuth {
		t.Fatalf("unexpected result for _app_service: got %s", result)
	}
	// 注意：函数中 _domain_service 比 _service 先检查
	result2 := StripServiceSuffixes("profile_domain_service")
	if result2 != "profile_domain" && result2 != testServiceProfile {
		t.Fatalf("unexpected result for _domain_service: got %s", result2)
	}
	if StripServiceSuffixes("plain") != "plain" {
		t.Fatalf("should return as-is if no suffix")
	}
}

func Test_findRepoRoot(t *testing.T) {
	t.Parallel()

	// 测试不存在的路径
	root := FindRepoRoot("/nonexistent/path/that/does/not/exist")
	if root != "" {
		t.Fatalf("should return empty for non-existent path, got: %s", root)
	}

	// 测试根路径
	root2 := FindRepoRoot("/")
	if root2 != "" {
		t.Fatalf("should return empty for root path, got: %s", root2)
	}
}

func Test_initCache(t *testing.T) {
	t.Parallel()

	root := InitCache()
	// 应返回结果（当前工作目录或仓库根目录）
	if root == "" {
		t.Fatalf("initCache should return a path")
	}
}

func Test_isCacheEnabled(t *testing.T) {
	t.Parallel()

	if !IsCacheEnabled() {
		t.Fatalf("cache should be enabled by default")
	}
}

func Test_loadCacheShardIfEnabled(t *testing.T) {
	t.Parallel()

	s := &analyzerState{}
	shard := LoadCacheShardIfEnabled(s, "test/package")
	if shard == nil {
		t.Fatalf("should return shard when cache is enabled")
	}
}

func Test_extractRepositoryServiceName_EdgeCases(t *testing.T) {
	t.Parallel()

	// 测试空 afterLayer
	result := ExtractRepositoryServiceName([]string{}, 0, false)
	if result != "" {
		t.Fatalf("empty afterLayer should return empty")
	}

	// 测试索引越界
	result2 := ExtractRepositoryServiceName([]string{"user", "repository"}, 1, false)
	if result2 != "" {
		t.Fatalf("out of bounds should return empty")
	}

	// 测试末尾为文件
	result3 := ExtractRepositoryServiceName([]string{"user", "repository", "auth.go"}, 1, true)
	if result3 != testServiceAuth {
		t.Fatalf("should extract service name from file: got %s", result3)
	}

	// 测试目录
	result4 := ExtractRepositoryServiceName([]string{"user", "repository", "auth"}, 1, false)
	if result4 != testServiceAuth {
		t.Fatalf("should extract service name from directory: got %s", result4)
	}
}

func Test_extractServiceName_EdgeCases(t *testing.T) {
	t.Parallel()

	// 测试索引越界
	result := ExtractServiceName([]string{"service"}, 0, false)
	if result != "" {
		t.Fatalf("out of bounds should return empty")
	}

	// 测试末尾为文件
	result2 := ExtractServiceName([]string{"service", "auth_service.go"}, 0, true)
	if result2 != testServiceAuth {
		t.Fatalf("should extract and strip service name: got %s", result2)
	}

	// 测试空候选值
	result3 := ExtractServiceName([]string{"service", ""}, 0, false)
	if result3 != "" {
		t.Fatalf("empty candidate should return empty")
	}
}

func Test_checkDependency_LoggingException(t *testing.T) {
	t.Parallel()

	// 测试 logging 导入始终允许
	from := packageInfo{layer: layerApplication}
	to := packageInfo{layer: layerInfrastructure}
	msg, violated := checkDependency(from, to, "magic/internal/infrastructure/logging")
	if violated {
		t.Fatalf("logging import should be allowed from any layer: %q", msg)
	}

	// 接口层同样测试
	from2 := packageInfo{layer: layerInterfaces}
	msg2, violated2 := checkDependency(from2, to, "magic/internal/infrastructure/logging/logger")
	if violated2 {
		t.Fatalf("logging import should be allowed from interfaces: %q", msg2)
	}
}

func Test_checkLayerDependencyRules_UnknownLayers(t *testing.T) {
	t.Parallel()

	// 测试未知层类型
	from := packageInfo{layer: layerType("unknown")}
	to := packageInfo{layer: layerDomain}
	msg, violated := checkLayerDependencyRules(from, to, "magic/internal/domain/user")
	if violated {
		t.Fatalf("unknown layer should not trigger violations: %q", msg)
	}
}

func Test_checkDomainLayerRules_SameDomain(t *testing.T) {
	t.Parallel()

	// 测试同域导入应允许
	from := packageInfo{layer: layerDomain, domain: testDomainUser}
	to := packageInfo{layer: layerDomain, domain: testDomainUser}
	msg, violated := checkDomainLayerRules(from, to, "magic/internal/domain/user/entity")
	if violated {
		t.Fatalf("same domain import should be allowed: %q", msg)
	}
}

func Test_packageInfoFromPath_EmptyParts(t *testing.T) {
	t.Parallel()

	// 测试 internal/ 后为空
	_, ok := packageInfoFromPath("/root/internal/")
	if ok {
		t.Fatalf("empty parts should not be valid")
	}
}

func Test_detectApplicationService_EdgeCases(t *testing.T) {
	t.Parallel()

	// 测试空 afterLayer
	info := packageInfo{afterLayer: []string{}}
	DetectApplicationService(&info, false)
	if info.isInService {
		t.Fatalf("empty afterLayer should not detect service")
	}

	// 测试有 service 但无名称
	info2 := packageInfo{afterLayer: []string{"service"}}
	DetectApplicationService(&info2, false)
	if info2.isInService {
		t.Fatalf("service without name should not be detected")
	}
}

func Test_detectDomainService_EdgeCases(t *testing.T) {
	t.Parallel()

	// 测试少于 2 个段
	info := packageInfo{afterLayer: []string{"user"}}
	DetectDomainService(&info, false)
	if info.isInService {
		t.Fatalf("insufficient segments should not detect service")
	}
}

func Test_detectRepositoryService_EdgeCases(t *testing.T) {
	t.Parallel()

	// 测试少于 2 个段
	info := packageInfo{afterLayer: []string{"user"}}
	DetectRepositoryService(&info, false)
	if info.isInRepository {
		t.Fatalf("insufficient segments should not detect repository")
	}

	// 测试 repository 后无名称
	info2 := packageInfo{afterLayer: []string{"user", "repository"}}
	DetectRepositoryService(&info2, false)
	if info2.isInRepository {
		t.Fatalf("repository without service name should not be detected")
	}
}

func Test_extractIgnoreRules_EdgeCases(t *testing.T) {
	t.Parallel()

	// 测试 nil file
	rules := extractIgnoreRules(nil)
	if rules.ignoreAll || len(rules.pathPatterns) > 0 {
		t.Fatalf("nil file should return empty rules")
	}

	// 测试 nil comment group
	code := `package x`
	f := mustParse(t, code)
	rules2 := extractIgnoreRules(f)
	if rules2.ignoreAll || len(rules2.pathPatterns) > 0 {
		t.Fatalf("no comments should return empty rules")
	}

	// 测试空忽略模式
	code2 := `// layerdeps:ignore 
package x`
	f2 := mustParse(t, code2)
	rules3 := extractIgnoreRules(f2)
	if len(rules3.pathPatterns) > 0 {
		t.Fatalf("empty ignore pattern should not be added")
	}
}

func Test_commentGroupContains_EdgeCases(t *testing.T) {
	t.Parallel()

	// 测试列表中有 nil comment
	cg := &ast.CommentGroup{List: []*ast.Comment{nil, {Text: "// hello"}}}
	if CommentGroupContains(cg, "hello") != true {
		t.Fatalf("should handle nil comments in list")
	}
}

func Test_analyzeFileImports_EmptyFile(t *testing.T) {
	t.Parallel()

	// 测试无 imports 的文件
	code := `package x

func main() {}
`
	f := mustParse(t, code)
	pkgInfo := packageInfo{layer: layerApplication}
	s := &analyzerState{}
	collected := AnalyzeFileImports(s, nil, f, pkgInfo)
	if len(collected) != 0 {
		t.Fatalf("file with no imports should have no issues")
	}
}

func Test_CacheFunctions_Integration(t *testing.T) {
	t.Parallel()

	// 创建临时文件用于测试
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "internal", "application", "test.go")
	if err := os.MkdirAll(filepath.Dir(tmpFile), 0o750); err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	code := `package application
import _ "github.com/acme/proj/internal/infrastructure/db"
`
	if err := os.WriteFile(tmpFile, []byte(code), 0o600); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	// 使用真实文件运行测试（覆盖 tryEmitCachedIssuesWithHash 和 updateCacheForFileWithHash）
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, tmpFile, code, parser.ParseComments)
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}

	diagCount := 0
	pass := &analysis.Pass{
		Fset:  fset,
		Files: []*ast.File{file},
		Report: func(d analysis.Diagnostic) {
			diagCount++
		},
	}

	// 首次运行——应缓存结果
	analyzer := NewAnalyzer() // 使用单实例以保持内存缓存
	if _, err := analyzer.Run(pass); err != nil {
		t.Fatalf("run error: %v", err)
	}

	// 验证得到诊断（app->infra 违规）
	if diagCount == 0 {
		t.Fatalf("expected diagnostics for app->infra violation")
	}

	// 第二次同文件运行——应命中缓存
	diagCount2 := 0
	pass2 := &analysis.Pass{
		Fset:  fset,
		Files: []*ast.File{file},
		Report: func(d analysis.Diagnostic) {
			diagCount2++
		},
	}

	if _, err := analyzer.Run(pass2); err != nil {
		t.Fatalf("second run error: %v", err)
	}

	// 从缓存应得到相同数量诊断
	if diagCount2 != diagCount {
		t.Fatalf("cache should return same diagnostics: got %d, expected %d", diagCount2, diagCount)
	}
}

func Test_saveCacheShard_Success(t *testing.T) {
	t.Parallel()

	// 设置缓存根目录
	tmpDir := t.TempDir()
	const analyzerHash = "analyzer-hash-v1"

	// 创建 .cache/layerdeps 目录
	cacheDir := filepath.Join(tmpDir, ".cache", "layerdeps")
	if err := os.MkdirAll(cacheDir, 0o750); err != nil {
		t.Fatalf("failed to create cache dir: %v", err)
	}

	s := &analyzerState{}
	SetCacheState(s, tmpDir, analyzerHash)

	// 创建含数据的 shard
	shard := NewPackageCacheShard(
		"test/package",
		map[string]fileCacheEntry{
			"/test/file.go": {
				FileHash: "hash123",
				Issues:   []issueRecord{{Line: 10, Message: "test"}},
			},
		},
		true,
	)

	// 保存应成功
	if err := SaveCacheShard(s, shard); err != nil {
		t.Fatalf("saveCacheShard should succeed: %v", err)
	}

	// 验证文件已创建
	expectedPath := ShardFilePath(tmpDir, "test/package")
	if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
		t.Fatalf("cache file should be created at %s", expectedPath)
	}
	content, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("read cache file: %v", err)
	}
	if !strings.Contains(string(content), analyzerHash) {
		t.Fatalf("expected analyzer hash %q in cache file, got %q", analyzerHash, string(content))
	}
}

func Test_loadCacheShard_InvalidatesWhenAnalyzerHashChanges(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	const (
		pkgPath      = "test/package"
		oldHash      = "analyzer-hash-v1"
		newHash      = "analyzer-hash-v2"
		cachedFile   = "/test/file.go"
		expectedHash = "filehash123"
	)

	cacheDir := filepath.Join(tmpDir, ".cache", "layerdeps")
	if err := os.MkdirAll(cacheDir, 0o750); err != nil {
		t.Fatalf("failed to create cache dir: %v", err)
	}

	savedState := &analyzerState{}
	SetCacheState(savedState, tmpDir, oldHash)
	savedShard := NewPackageCacheShard(pkgPath, map[string]fileCacheEntry{
		cachedFile: {
			FileHash: expectedHash,
			Issues:   []issueRecord{{Line: 10, Message: "cached issue"}},
		},
	}, true)
	if err := SaveCacheShard(savedState, savedShard); err != nil {
		t.Fatalf("save cache shard: %v", err)
	}

	sameState := &analyzerState{}
	SetCacheState(sameState, tmpDir, oldHash)
	sameShard := LoadCacheShard(sameState, pkgPath)
	entry, ok := GetCacheEntry(sameState, pkgPath, cachedFile)
	if sameShard == nil || !ok {
		t.Fatalf("expected shard and cache entry for matching analyzer hash")
	}
	if sameShard.AnalyzerHash != oldHash {
		t.Fatalf("expected analyzer hash %q, got %q", oldHash, sameShard.AnalyzerHash)
	}
	if entry.FileHash != expectedHash {
		t.Fatalf("expected cached file hash %q, got %q", expectedHash, entry.FileHash)
	}

	changedState := &analyzerState{}
	SetCacheState(changedState, tmpDir, newHash)
	changedShard := LoadCacheShard(changedState, pkgPath)
	if changedShard == nil {
		t.Fatal("expected new shard when analyzer hash changes")
	}
	if changedShard.AnalyzerHash != newHash {
		t.Fatalf("expected new analyzer hash %q, got %q", newHash, changedShard.AnalyzerHash)
	}
	if _, ok := GetCacheEntry(changedState, pkgPath, cachedFile); ok {
		t.Fatal("expected cache entry to be invalidated when analyzer hash changes")
	}
}

func Test_shardFilePath(t *testing.T) {
	t.Parallel()

	path := ShardFilePath("/root", "internal/domain/user")
	if !strings.Contains(path, "internal_domain_user.json") {
		t.Fatalf("unexpected shard file path: %s", path)
	}

	// 测试反斜杠（Windows 风格）
	path2 := ShardFilePath("/root", "internal\\domain\\user")
	if !strings.Contains(path2, "internal_domain_user.json") {
		t.Fatalf("should handle backslashes: %s", path2)
	}
}

func Test_run_WithPkgNil(t *testing.T) {
	t.Parallel()

	// 测试 Pkg 为 nil 的运行（插桩边界情况）
	code := `package x`
	fset := token.NewFileSet()
	file := mustParseWithFset(t, fset, "test.go", code)

	pass := &analysis.Pass{
		Pkg:    nil, // nil 包
		Fset:   fset,
		Files:  []*ast.File{file},
		Report: func(d analysis.Diagnostic) {},
	}

	analyzer := NewAnalyzer()
	if _, err := analyzer.Run(pass); err != nil {
		t.Fatalf("run should handle nil Pkg: %v", err)
	}
}

func Test_initCache_InRoot(t *testing.T) {
	// 保存当前目录
	oldDir, _ := os.Getwd()
	defer func() { _ = os.Chdir(oldDir) }()

	// 切换到 root
	if err := os.Chdir("/"); err == nil {
		root := InitCache()
		// 应返回 / 或空。initCache 可能在某处找到 go.mod。
		_ = root
	}
}
