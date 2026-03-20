package deployer

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/dtyq/magicrew-cli/chart"
)

// PrepareValuesStage loads chart defaults and merges them with the user values file.
type PrepareValuesStage struct {
	BaseStage
	d *Deployer
}

func newPrepareValuesStage(d *Deployer) *PrepareValuesStage {
	return &PrepareValuesStage{BaseStage: BaseStage{"prepare values"}, d: d}
}

func (s *PrepareValuesStage) Exec(_ context.Context) error {
	defaultsByChart := map[string]map[string]interface{}{}
	for release := range s.d.chartSpecs {
		ref, err := s.d.chartRef(release)
		if err != nil {
			return err
		}
		defaults, err := chart.DefaultValues(ref)
		if err != nil {
			return fmt.Errorf("load default values for %s: %w", release, err)
		}
		defaultsByChart[release] = defaults
	}

	merged, err := buildDeployValues(defaultsByChart, s.d.valuesFile)
	if err != nil {
		return fmt.Errorf("merge values: %w", err)
	}
	injectWebBaseURL(merged, s.d.opts.WebBaseURL)
	s.d.merged = merged
	return nil
}

// injectWebBaseURL sets magic-web.proxy.webBaseURL in merged when url is non-empty.
func injectWebBaseURL(merged map[string]interface{}, url string) {
	if url == "" {
		return
	}
	magicV := mapValue(merged[releaseNameMagic])
	mw := mapValue(magicV["magic-web"])
	proxy := mapValue(mw["proxy"])
	proxy["webBaseURL"] = url
	mw["proxy"] = proxy
	magicV["magic-web"] = mw
	merged[releaseNameMagic] = magicV
}

// buildDeployValues merges chart default values with a single values file.
// The values path is resolved by the CLI (cli > config). Precedence: values file > chart defaults.
// Registry endpoint injection is NOT done here; each stage handles it independently based on
// whether the chart should route image pulls through the local registry proxy.
func buildDeployValues(
	defaultsByChart map[string]map[string]interface{},
	valuesPath string,
) (map[string]interface{}, error) {
	values, err := loadValues(valuesPath)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{}
	globalMerged := map[string]interface{}{}
	globalMerged = deepMerge(globalMerged, mapValue(values["global"]))
	if len(globalMerged) > 0 {
		result["global"] = globalMerged
	}

	for release, defaults := range defaultsByChart {
		merged := cloneMap(defaults)
		merged = applyChartOverrides(merged, values, release)
		result[release] = merged
	}
	return result, nil
}

// withRegistryEndpoint returns a deep copy of merged with global.imageRegistry overridden
// to endpoint. Used by stages that must route image pulls through the local registry proxy.
func withRegistryEndpoint(merged map[string]interface{}, endpoint string) map[string]interface{} {
	result := cloneMap(merged)
	global := mapValue(result["global"])
	global["imageRegistry"] = endpoint
	result["global"] = global
	return result
}

func loadValues(path string) (map[string]interface{}, error) {
	if strings.TrimSpace(path) == "" {
		return map[string]interface{}{}, nil
	}
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return map[string]interface{}{}, nil
		}
		return nil, fmt.Errorf("stat values file %s: %w", path, err)
	}
	values, err := chart.MergeValues(path)
	if err != nil {
		return nil, err
	}
	return values, nil
}

func applyChartOverrides(dst map[string]interface{}, values map[string]interface{}, chartName string) map[string]interface{} {
	globalOverride := mapValue(values["global"])
	if len(globalOverride) > 0 {
		dst["global"] = deepMerge(mapValue(dst["global"]), globalOverride)
	}
	chartOverride := mapValue(values[chartName])
	if len(chartOverride) == 0 {
		return dst
	}
	return deepMerge(dst, chartOverride)
}

func chartNamespace(merged map[string]interface{}, chartName, defaultNamespace string) string {
	chartValues := mapValue(merged[chartName])
	namespace := stringFromMap(chartValues, "namespace")
	if namespace == "" {
		return defaultNamespace
	}
	return namespace
}

func stringAtPath(root map[string]interface{}, path ...string) string {
	return stringValue(nodeAtPath(root, path...))
}

func nodeAtPath(root map[string]interface{}, path ...string) interface{} {
	var cur interface{} = root
	for _, key := range path {
		m, ok := cur.(map[string]interface{})
		if !ok {
			return nil
		}
		cur = m[key]
	}
	return cur
}

func stringFromMap(m map[string]interface{}, key string) string {
	return stringValue(m[key])
}

func stringValue(v interface{}) string {
	s, _ := v.(string)
	return s
}

func mapValue(v interface{}) map[string]interface{} {
	m, ok := v.(map[string]interface{})
	if !ok || m == nil {
		return map[string]interface{}{}
	}
	return m
}

func deepMerge(dst, src map[string]interface{}) map[string]interface{} {
	if dst == nil {
		dst = map[string]interface{}{}
	}
	for k, sv := range src {
		if sv == nil {
			continue
		}
		if dv, ok := dst[k]; ok {
			srcMap, srcIsMap := sv.(map[string]interface{})
			dstMap, dstIsMap := dv.(map[string]interface{})
			if srcIsMap && dstIsMap {
				dst[k] = deepMerge(dstMap, srcMap)
				continue
			}
		}
		dst[k] = sv
	}
	return dst
}

func cloneMap(src map[string]interface{}) map[string]interface{} {
	dst := make(map[string]interface{}, len(src))
	for k, v := range src {
		switch tv := v.(type) {
		case map[string]interface{}:
			dst[k] = cloneMap(tv)
		case []interface{}:
			dst[k] = cloneSlice(tv)
		default:
			dst[k] = v
		}
	}
	return dst
}

func cloneSlice(src []interface{}) []interface{} {
	dst := make([]interface{}, len(src))
	for i, v := range src {
		switch tv := v.(type) {
		case map[string]interface{}:
			dst[i] = cloneMap(tv)
		case []interface{}:
			dst[i] = cloneSlice(tv)
		default:
			dst[i] = v
		}
	}
	return dst
}
