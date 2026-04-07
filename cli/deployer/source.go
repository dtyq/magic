package deployer

import (
	"fmt"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/dtyq/magicrew-cli/chart"
	"github.com/dtyq/magicrew-cli/registry"
)

func normalizeChartSpecs(specs map[string]ChartSpec) map[string]ChartSpec {
	if specs == nil {
		return map[string]ChartSpec{}
	}
	out := make(map[string]ChartSpec, len(specs))
	for key, spec := range specs {
		if spec.Name == "" {
			spec.Name = key
		}
		out[key] = spec
	}
	return out
}

func (d *Deployer) resolveChartRefs() error {
	if len(d.opts.chartSpecs) == 0 {
		return fmt.Errorf("deploy.charts must not be empty")
	}

	refs := make(map[string]chart.ChartReference, len(d.opts.chartSpecs))
	repo := strings.TrimSpace(d.opts.chartRepo.URL)

	switch {
	case strings.HasPrefix(repo, "oci://"):
		normalizedRepo := normalizeOCIRepoForHost(repo, d.opts.registry)
		for release, spec := range d.opts.chartSpecs {
			refs[release] = chart.NewOCIReference(normalizedRepo, spec.Name, spec.Version, d.opts.chartRepo.PlainHTTP)
		}
	case strings.HasPrefix(repo, "https://"), strings.HasPrefix(repo, "http://"):
		for release, spec := range d.opts.chartSpecs {
			refs[release] = chart.NewHTTPReference(
				repo,
				spec.Name,
				spec.Version,
				d.opts.chartRepo.Username,
				d.opts.chartRepo.Password,
				d.opts.chartRepo.PassCredentialsAll,
			)
		}
	default:
		for release := range d.opts.chartSpecs {
			refs[release] = chart.NewLocalReference(filepath.Join(d.opts.chartsDir, release))
		}
	}

	d.chartRefs = refs
	return nil
}

func (d *Deployer) chartRef(release string) (chart.ChartReference, error) {
	if d.chartRefs == nil {
		return chart.ChartReference{}, fmt.Errorf("chart references are not initialized")
	}
	ref, ok := d.chartRefs[release]
	if !ok {
		return chart.ChartReference{}, fmt.Errorf("chart reference not found for release %q", release)
	}
	return ref, nil
}

func normalizeOCIRepoForHost(repo string, cfg registry.Config) string {
	u, err := url.Parse(repo)
	if err != nil {
		return repo
	}
	if u.Host != registry.ContainerEndpoint(cfg) {
		return repo
	}
	u.Host = registry.HostEndpoint(cfg)
	return u.String()
}
