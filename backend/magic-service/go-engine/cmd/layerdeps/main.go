// Command layerdeps 运行自定义 DDD 层依赖分析器。
package main

import (
	"golang.org/x/tools/go/analysis/multichecker"

	"magic/internal/tools/analyzers/layerdeps"
	"magic/internal/tools/analyzers/rpcroutes"
)

func main() {
	multichecker.Main(
		layerdeps.NewAnalyzer(),
		rpcroutes.NewAnalyzer(),
	)
}
