package chart

import (
	"fmt"
	"os"

	"go.yaml.in/yaml/v3"
)

// MergeValues deep-merges the given YAML files in order.
// Later files have higher priority (override earlier ones).
// Files that do not exist are silently skipped.
func MergeValues(files ...string) (map[string]interface{}, error) {
	result := map[string]interface{}{}
	for _, f := range files {
		data, err := os.ReadFile(f)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("read values file %s: %w", f, err)
		}
		var parsed map[string]interface{}
		if err := yaml.Unmarshal(data, &parsed); err != nil {
			return nil, fmt.Errorf("parse values file %s: %w", f, err)
		}
		result = deepMerge(result, parsed)
	}
	return result, nil
}

// ExtractChartValues extracts the `global` and `chartName` nodes from merged
// values and returns them as a single flat map suitable for helm install.
func ExtractChartValues(merged map[string]interface{}, chartName string) map[string]interface{} {
	out := map[string]interface{}{}
	if g, ok := merged["global"]; ok {
		if gm, ok := g.(map[string]interface{}); ok {
			out["global"] = deepMerge(map[string]interface{}{}, gm)
		} else {
			out["global"] = g
		}
	}
	if cv, ok := merged[chartName]; ok {
		if m, ok := cv.(map[string]interface{}); ok {
			for k, v := range m {
				if k == "global" {
					chartGlobal, chartGlobalOK := v.(map[string]interface{})
					rootGlobal, rootGlobalOK := out["global"].(map[string]interface{})
					switch {
					case chartGlobalOK && rootGlobalOK:
						// Keep root global values higher-priority while preserving chart-level defaults.
						out["global"] = deepMerge(deepMerge(map[string]interface{}{}, chartGlobal), rootGlobal)
						continue
					case chartGlobalOK && !rootGlobalOK:
						out["global"] = deepMerge(map[string]interface{}{}, chartGlobal)
						continue
					}
				}
				out[k] = v
			}
		}
	}
	return out
}

// deepMerge merges src into dst recursively. src values take priority.
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
