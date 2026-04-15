package qdrant

import (
	"strconv"
	"strings"

	shared "magic/internal/domain/knowledge/shared"
)

type hybridWriteTransport string

const (
	hybridWriteTransportGRPC hybridWriteTransport = "grpc"
	hybridWriteTransportREST hybridWriteTransport = "rest"
)

type sparseSearchAPI string

const (
	sparseSearchAPILegacy sparseSearchAPI = qdrantSparseAPILegacy
	sparseSearchAPIQuery  sparseSearchAPI = qdrantSparseAPIQuery
)

type compatibilityStrategy struct {
	name                            string
	snapshot                        capabilitySnapshot
	selectSparseBackendFn           func(capabilitySnapshot, string) shared.SparseBackendSelection
	hybridWriteTransportFn          func(capabilitySnapshot, string, string) hybridWriteTransport
	shouldFetchPointsCountViaRESTFn func(string, int64) bool
	sparseSearchPlanFn              func(capabilitySnapshot, string) sparseSearchPlan
}

type sparseSearchPlan struct {
	Primary              sparseSearchAPI
	LogSelectedAPI       string
	ImmediateUnsupported bool
}

func resolveCompatibilityStrategy(snapshot capabilitySnapshot) compatibilityStrategy {
	if isPreModernQdrantVersion(snapshot.Version) {
		return newCompatibilityStrategy("legacy_pre_1_12", snapshot, selectSparseBackendByCapability, legacyHybridWriteTransport, shouldFetchPointsCountViaREST, legacyPre112SparseSearchPlan)
	}
	return newCompatibilityStrategy("modern", snapshot, selectSparseBackendByCapability, modernHybridWriteTransport, shouldFetchPointsCountViaREST, modernSparseSearchPlan)
}

func newCompatibilityStrategy(
	name string,
	snapshot capabilitySnapshot,
	selectSparseBackendFn func(capabilitySnapshot, string) shared.SparseBackendSelection,
	hybridWriteTransportFn func(capabilitySnapshot, string, string) hybridWriteTransport,
	shouldFetchPointsCountViaRESTFn func(string, int64) bool,
	sparseSearchPlanFn func(capabilitySnapshot, string) sparseSearchPlan,
) compatibilityStrategy {
	return compatibilityStrategy{
		name:                            name,
		snapshot:                        snapshot,
		selectSparseBackendFn:           selectSparseBackendFn,
		hybridWriteTransportFn:          hybridWriteTransportFn,
		shouldFetchPointsCountViaRESTFn: shouldFetchPointsCountViaRESTFn,
		sparseSearchPlanFn:              sparseSearchPlanFn,
	}
}

func (c *Client) compatibilityStrategy() compatibilityStrategy {
	if c == nil {
		return resolveCompatibilityStrategy(*newDefaultCapabilitySnapshot())
	}
	return resolveCompatibilityStrategy(c.capabilitySnapshot())
}

func (s compatibilityStrategy) Name() string {
	return s.name
}

func (s compatibilityStrategy) SelectSparseBackend(requested string) shared.SparseBackendSelection {
	return s.selectSparseBackendFn(s.snapshot, requested)
}

func (s compatibilityStrategy) HybridWriteTransport(baseURI, sparseMode string) hybridWriteTransport {
	return s.hybridWriteTransportFn(s.snapshot, baseURI, sparseMode)
}

func (s compatibilityStrategy) ShouldFetchPointsCountViaREST(baseURI string, currentPoints int64) bool {
	return s.shouldFetchPointsCountViaRESTFn(baseURI, currentPoints)
}

func (s compatibilityStrategy) SparseSearchPlan(mode string) sparseSearchPlan {
	return s.sparseSearchPlanFn(s.snapshot, mode)
}

func selectSparseBackendByCapability(snapshot capabilitySnapshot, requested string) shared.SparseBackendSelection {
	selection := shared.SparseBackendSelection{
		Requested:      shared.NormalizeSparseBackend(requested),
		Version:        snapshot.Version,
		ProbeStatus:    snapshot.ProbeStatus,
		QuerySupported: snapshot.QuerySupported,
	}
	if selection.Requested == shared.SparseBackendClientBM25QdrantIDFV1 {
		selection.Effective = shared.SparseBackendClientBM25QdrantIDFV1
		selection.Reason = shared.SparseBackendSelectionReasonExplicitRequested
		return selection
	}

	queryAllowed := snapshot.QuerySupported && snapshot.SelectedSparseAPI == qdrantSparseAPIQuery
	defaultBackend := shared.SparseBackendClientBM25QdrantIDFV1
	if queryAllowed {
		defaultBackend = shared.SparseBackendQdrantBM25ZHV1
	}

	if selection.Requested == "" {
		selection.Effective = defaultBackend
		selection.Reason = shared.SparseBackendSelectionReasonCapabilityDefault
		return selection
	}
	if selection.Requested != shared.SparseBackendQdrantBM25ZHV1 {
		selection.Effective = defaultBackend
		selection.Reason = shared.SparseBackendSelectionReasonCapabilityDefault
		return selection
	}
	if queryAllowed {
		selection.Effective = shared.SparseBackendQdrantBM25ZHV1
		selection.Reason = shared.SparseBackendSelectionReasonExplicitRequested
		return selection
	}

	selection.Effective = shared.SparseBackendClientBM25QdrantIDFV1
	selection.Reason = shared.SparseBackendSelectionReasonQueryPointsUnsupported
	return selection
}

func modernHybridWriteTransport(
	snapshot capabilitySnapshot,
	baseURI string,
	sparseMode string,
) hybridWriteTransport {
	_ = snapshot
	_ = baseURI
	_ = sparseMode
	return hybridWriteTransportGRPC
}

func legacyHybridWriteTransport(snapshot capabilitySnapshot, baseURI, sparseMode string) hybridWriteTransport {
	if strings.TrimSpace(baseURI) == "" || !isSparseWriteMode(sparseMode) {
		return hybridWriteTransportGRPC
	}
	if snapshot.SelectedSparseAPI == qdrantSparseAPILegacy {
		return hybridWriteTransportREST
	}
	return hybridWriteTransportGRPC
}

func shouldFetchPointsCountViaREST(baseURI string, currentPoints int64) bool {
	return strings.TrimSpace(baseURI) != "" && currentPoints <= 0
}

func isSparseWriteMode(sparseMode string) bool {
	switch sparseMode {
	case qdrantSparseModeDocument, qdrantSparseModeVector, "mixed":
		return true
	default:
		return false
	}
}

func modernSparseSearchPlan(snapshot capabilitySnapshot, mode string) sparseSearchPlan {
	switch mode {
	case qdrantSparseModeVector:
		if strings.TrimSpace(snapshot.SelectedSparseAPI) == qdrantSparseAPIQuery {
			return sparseSearchPlan{Primary: sparseSearchAPIQuery, LogSelectedAPI: qdrantSparseAPIQuery}
		}
		return sparseSearchPlan{
			Primary:        sparseSearchAPILegacy,
			LogSelectedAPI: qdrantSparseAPILegacy,
		}
	case qdrantSparseModeDocument:
		if !snapshot.QuerySupported || strings.TrimSpace(snapshot.SelectedSparseAPI) != qdrantSparseAPIQuery {
			return sparseSearchPlan{
				LogSelectedAPI:       qdrantSparseAPILegacy,
				ImmediateUnsupported: true,
			}
		}
		return sparseSearchPlan{
			Primary:        sparseSearchAPIQuery,
			LogSelectedAPI: qdrantSparseAPIQuery,
		}
	default:
		return sparseSearchPlan{}
	}
}

func legacyPre112SparseSearchPlan(_ capabilitySnapshot, mode string) sparseSearchPlan {
	switch mode {
	case qdrantSparseModeVector:
		return sparseSearchPlan{
			Primary:        sparseSearchAPILegacy,
			LogSelectedAPI: qdrantSparseAPILegacy,
		}
	case qdrantSparseModeDocument:
		return sparseSearchPlan{
			LogSelectedAPI:       qdrantSparseAPILegacy,
			ImmediateUnsupported: true,
		}
	default:
		return sparseSearchPlan{}
	}
}

func isPreModernQdrantVersion(version string) bool {
	major, minor, ok := parseQdrantMajorMinor(version)
	if !ok {
		return false
	}
	return major < 1 || (major == 1 && minor < 12)
}

func parseQdrantMajorMinor(version string) (int, int, bool) {
	parts := strings.Split(strings.TrimSpace(version), ".")
	if len(parts) < 2 {
		return 0, 0, false
	}
	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, false
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, false
	}
	return major, minor, true
}
