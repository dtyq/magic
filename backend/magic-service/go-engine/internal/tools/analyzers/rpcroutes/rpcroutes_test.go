package rpcroutes_test

import (
	"go/ast"
	"go/parser"
	"go/token"
	"go/types"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/tools/go/analysis"

	rpcroutes "magic/internal/tools/analyzers/rpcroutes"
)

func mustParseFile(t *testing.T, fset *token.FileSet, filename, code string) *ast.File {
	t.Helper()
	file, err := parser.ParseFile(fset, filename, code, 0)
	if err != nil {
		t.Fatalf("parse file failed: %v", err)
	}
	return file
}

func TestRunReportsMissingRegistration(t *testing.T) {
	t.Parallel()

	diags := runAnalyzerForTest(t,
		map[string]string{
			"internal/interfaces/rpc/jsonrpc/knowledge/routes/document_routes.go": `package routes
import "magic/internal/constants"
func RegisterDocumentRoutes(router RPCRouter, h HandlerProvider) {
	registerHandlers(router, h, []string{
		constants.MethodDocumentCreate,
	})
}`,
			"internal/interfaces/rpc/jsonrpc/knowledge/service/handler_provider.go": `package service
import (
	"magic/internal/constants"
	jsonrpc "magic/internal/pkg/jsonrpc"
)
func (h *DocumentRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	return map[string]jsonrpc.ServerHandler{
		constants.MethodDocumentCreate: nil,
		constants.MethodDocumentGetOriginalFileLink: nil,
	}
}`,
		},
	)

	if len(diags) != 1 {
		t.Fatalf("expected 1 diagnostic, got %d: %+v", len(diags), diags)
	}
	if !strings.Contains(diags[0], "document routes missing registration for constants.MethodDocumentGetOriginalFileLink") {
		t.Fatalf("unexpected diagnostic: %q", diags[0])
	}
}

func TestRunReportsUnknownRegistration(t *testing.T) {
	t.Parallel()

	diags := runAnalyzerForTest(t,
		map[string]string{
			"internal/interfaces/rpc/jsonrpc/knowledge/routes/document_routes.go": `package routes
import "magic/internal/constants"
func RegisterDocumentRoutes(router RPCRouter, h HandlerProvider) {
	registerHandlers(router, h, []string{
		constants.MethodDocumentCreate,
		constants.MethodDocumentFoo,
	})
}`,
			"internal/interfaces/rpc/jsonrpc/knowledge/service/handler_provider.go": `package service
import (
	"magic/internal/constants"
	jsonrpc "magic/internal/pkg/jsonrpc"
)
func (h *DocumentRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	return map[string]jsonrpc.ServerHandler{
		constants.MethodDocumentCreate: nil,
	}
}`,
		},
	)

	if len(diags) != 1 {
		t.Fatalf("expected 1 diagnostic, got %d: %+v", len(diags), diags)
	}
	if !strings.Contains(diags[0], "document routes register unknown method constants.MethodDocumentFoo") {
		t.Fatalf("unexpected diagnostic: %q", diags[0])
	}
}

func TestRunIgnoresNonTargetPackage(t *testing.T) {
	t.Parallel()

	fset := token.NewFileSet()
	file := mustParseFile(t, fset, "server.go", `package httpapi`)
	analyzer := rpcroutes.NewAnalyzer()
	pass := &analysis.Pass{
		Fset:  fset,
		Files: []*ast.File{file},
		Pkg:   types.NewPackage("magic/internal/interfaces/http", "httpapi"),
	}

	if _, err := analyzer.Run(pass); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}

func runAnalyzerForTest(t *testing.T, files map[string]string) []string {
	t.Helper()

	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "internal/interfaces/rpc/jsonrpc/knowledge/routes"), 0o750); err != nil {
		t.Fatalf("mkdir routes dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "go.mod"), []byte("module magic\n\ngo 1.26\n"), 0o600); err != nil {
		t.Fatalf("write go.mod: %v", err)
	}

	fset := token.NewFileSet()
	routeFiles := make([]*ast.File, 0, len(files))
	for relPath, code := range files {
		absPath := filepath.Join(root, relPath)
		if err := os.MkdirAll(filepath.Dir(absPath), 0o750); err != nil {
			t.Fatalf("mkdir file dir: %v", err)
		}
		if err := os.WriteFile(absPath, []byte(code), 0o600); err != nil {
			t.Fatalf("write file: %v", err)
		}
		if strings.HasSuffix(relPath, ".go") && hasTargetPackage(filepath.Dir(absPath)) {
			routeFiles = append(routeFiles, mustParseFile(t, fset, absPath, code))
		}
	}

	diags := make([]string, 0)
	analyzer := rpcroutes.NewAnalyzer()
	pass := &analysis.Pass{
		Fset:  fset,
		Files: routeFiles,
		Pkg:   types.NewPackage("magic/internal/interfaces/rpc/jsonrpc/knowledge/routes", "routes"),
		Report: func(d analysis.Diagnostic) {
			diags = append(diags, d.Message)
		},
	}

	if _, err := analyzer.Run(pass); err != nil {
		t.Fatalf("run analyzer failed: %v", err)
	}

	return diags
}

func hasTargetPackage(path string) bool {
	normalized := filepath.ToSlash(path)
	return strings.HasSuffix(normalized, "/internal/interfaces/rpc/jsonrpc/knowledge/routes")
}
