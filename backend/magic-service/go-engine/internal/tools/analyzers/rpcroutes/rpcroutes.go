// Package rpcroutes 提供 knowledge JSON-RPC 路由注册一致性检查。
package rpcroutes

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"reflect"
	"slices"

	"golang.org/x/tools/go/analysis"
)

const (
	analyzerName       = "rpcroutes"
	analyzerDoc        = "checks knowledge JSON-RPC handlers and routes stay in sync"
	targetPackagePath  = "magic/internal/interfaces/rpc/jsonrpc/knowledge/routes"
	handlerProviderRel = "internal/interfaces/rpc/jsonrpc/knowledge/service/handler_provider.go"
)

type routeSpec struct {
	ProviderReceiver string
	RouteFunc        string
	Label            string
}

type methodRefs struct {
	Methods map[string]token.Pos
	FuncPos token.Pos
}

// NewAnalyzer 构建 RPC 路由注册一致性分析器。
func NewAnalyzer() *analysis.Analyzer {
	return &analysis.Analyzer{
		Name:       analyzerName,
		Doc:        analyzerDoc,
		ResultType: reflect.TypeFor[struct{}](),
		Run:        run,
	}
}

func run(pass *analysis.Pass) (any, error) {
	if pass == nil || pass.Pkg == nil || pass.Pkg.Path() != targetPackagePath {
		return struct{}{}, nil
	}
	if len(pass.Files) == 0 {
		return struct{}{}, nil
	}

	repoRoot := findRepoRoot(pass, pass.Files[0])
	if repoRoot == "" {
		return struct{}{}, nil
	}

	handlerFilePath := filepath.Join(repoRoot, handlerProviderRel)
	handlerFile, err := parser.ParseFile(pass.Fset, handlerFilePath, nil, 0)
	if err != nil {
		return nil, fmt.Errorf("parse handler provider: %w", err)
	}

	handlerMethods := collectHandlerMethods(handlerFile)
	routeMethods := collectRouteMethods(pass.Files)

	for _, spec := range routeSpecs() {
		handlers, handlersOK := handlerMethods[spec.ProviderReceiver]
		routes, routesOK := routeMethods[spec.RouteFunc]
		if !handlersOK || !routesOK {
			continue
		}
		reportMissingRegistrations(pass, spec, handlers, routes)
		reportUnknownRegistrations(pass, spec, handlers, routes)
	}

	return struct{}{}, nil
}

func routeSpecs() []routeSpec {
	return []routeSpec{
		{
			ProviderReceiver: "KnowledgeBaseRPCService",
			RouteFunc:        "RegisterKnowledgeBaseRoutes",
			Label:            "knowledge routes",
		},
		{
			ProviderReceiver: "FragmentRPCService",
			RouteFunc:        "RegisterFragmentRoutes",
			Label:            "fragment routes",
		},
		{
			ProviderReceiver: "EmbeddingRPCService",
			RouteFunc:        "RegisterEmbeddingRoutes",
			Label:            "embedding routes",
		},
		{
			ProviderReceiver: "DocumentRPCService",
			RouteFunc:        "RegisterDocumentRoutes",
			Label:            "document routes",
		},
	}
}

func reportMissingRegistrations(pass *analysis.Pass, spec routeSpec, handlers, routes methodRefs) {
	for _, method := range sortedMethodNames(handlers.Methods) {
		if _, ok := routes.Methods[method]; ok {
			continue
		}
		pass.Reportf(routes.FuncPos, "%s missing registration for %s", spec.Label, method)
	}
}

func reportUnknownRegistrations(pass *analysis.Pass, spec routeSpec, handlers, routes methodRefs) {
	for _, method := range sortedMethodNames(routes.Methods) {
		pos := routes.Methods[method]
		if _, ok := handlers.Methods[method]; ok {
			continue
		}
		pass.Reportf(pos, "%s register unknown method %s", spec.Label, method)
	}
}

func sortedMethodNames(methods map[string]token.Pos) []string {
	names := make([]string, 0, len(methods))
	for name := range methods {
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}

func collectHandlerMethods(file *ast.File) map[string]methodRefs {
	collected := make(map[string]methodRefs)
	if file == nil {
		return collected
	}

	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Name == nil || fn.Name.Name != "Handlers" || fn.Recv == nil || len(fn.Recv.List) != 1 {
			continue
		}

		receiver := receiverName(fn.Recv.List[0].Type)
		if receiver == "" {
			continue
		}

		methods := collectMethodsFromHandlersFunc(fn)
		if len(methods) == 0 {
			continue
		}
		collected[receiver] = methodRefs{
			Methods: methods,
			FuncPos: fn.Name.Pos(),
		}
	}

	return collected
}

func collectMethodsFromHandlersFunc(fn *ast.FuncDecl) map[string]token.Pos {
	methods := make(map[string]token.Pos)
	if fn == nil || fn.Body == nil {
		return methods
	}

	for _, stmt := range fn.Body.List {
		ret, ok := stmt.(*ast.ReturnStmt)
		if !ok || len(ret.Results) != 1 {
			continue
		}
		lit, ok := ret.Results[0].(*ast.CompositeLit)
		if !ok {
			continue
		}
		for _, elt := range lit.Elts {
			kv, ok := elt.(*ast.KeyValueExpr)
			if !ok {
				continue
			}
			methodName := constantSelectorName(kv.Key)
			if methodName == "" {
				continue
			}
			methods[methodName] = kv.Key.Pos()
		}
	}

	return methods
}

func collectRouteMethods(files []*ast.File) map[string]methodRefs {
	collected := make(map[string]methodRefs)
	for _, file := range files {
		if file == nil {
			continue
		}
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Name == nil {
				continue
			}
			methods, ok := collectMethodsFromRouteFunc(fn)
			if !ok {
				continue
			}
			collected[fn.Name.Name] = methodRefs{
				Methods: methods,
				FuncPos: fn.Name.Pos(),
			}
		}
	}
	return collected
}

func collectMethodsFromRouteFunc(fn *ast.FuncDecl) (map[string]token.Pos, bool) {
	if fn == nil || fn.Body == nil {
		return nil, false
	}

	for _, stmt := range fn.Body.List {
		exprStmt, ok := stmt.(*ast.ExprStmt)
		if !ok {
			continue
		}
		call, ok := exprStmt.X.(*ast.CallExpr)
		if !ok || len(call.Args) != 3 {
			continue
		}
		if identName(call.Fun) != "registerHandlers" {
			continue
		}
		lit, ok := call.Args[2].(*ast.CompositeLit)
		if !ok {
			return nil, false
		}
		methods := make(map[string]token.Pos)
		for _, elt := range lit.Elts {
			methodName := constantSelectorName(elt)
			if methodName == "" {
				continue
			}
			methods[methodName] = elt.Pos()
		}
		return methods, true
	}

	return nil, false
}

func receiverName(expr ast.Expr) string {
	switch typed := expr.(type) {
	case *ast.StarExpr:
		return receiverName(typed.X)
	case *ast.Ident:
		return typed.Name
	default:
		return ""
	}
}

func identName(expr ast.Expr) string {
	ident, ok := expr.(*ast.Ident)
	if !ok {
		return ""
	}
	return ident.Name
}

func constantSelectorName(expr ast.Expr) string {
	selector, ok := expr.(*ast.SelectorExpr)
	if !ok {
		return ""
	}
	pkgIdent, ok := selector.X.(*ast.Ident)
	if !ok || pkgIdent.Name != "constants" || selector.Sel == nil {
		return ""
	}
	return "constants." + selector.Sel.Name
}

func findRepoRoot(pass *analysis.Pass, file *ast.File) string {
	if pass == nil || pass.Fset == nil || file == nil {
		return ""
	}
	filename := pass.Fset.Position(file.Pos()).Filename
	if filename == "" {
		return ""
	}
	dir := filepath.Dir(filename)
	for {
		if dir == "" || dir == "/" {
			return ""
		}
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}
