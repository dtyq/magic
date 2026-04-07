package deployer

import (
	"context"
	"fmt"
	"strings"
)

const defaultMagicWebURL = "http://localhost:38080"

// SummaryStage prints the deployment completion message.
type SummaryStage struct {
	BaseStage
	d *Deployer
}

func newSummaryStage(d *Deployer) *SummaryStage {
	return &SummaryStage{BaseStage: BaseStage{"print summary"}, d: d}
}

func (s *SummaryStage) Exec(_ context.Context) error {
	webURL := stringAtPath(
		mapValue(mapValue(s.d.merged[releaseNameMagic])["magic-web"]),
		"proxy", "webBaseURL",
	)
	if webURL == "" {
		webURL = defaultMagicWebURL
	}

	fmt.Println()
	fmt.Println("✓ Deployment complete!")
	fmt.Printf("  Access magic-web: %s\n", webURL)
	if strings.Contains(webURL, "localhost") {
		fmt.Println("  To access from another machine, set MAGICREW_CLI_WEB_BASE_URL, e.g. export MAGICREW_CLI_WEB_BASE_URL=http://your-server:38080")
	}
	fmt.Println()
	fmt.Println("To remove the cluster, run: magicrew teardown")
	return nil
}
