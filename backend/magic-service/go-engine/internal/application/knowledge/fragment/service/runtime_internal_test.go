package fragapp_test

import (
	"slices"
	"testing"

	appservice "magic/internal/application/knowledge/fragment/service"
)

func TestBuildRuntimeMetadataFieldFilterAcceptsJSONLikeValues(t *testing.T) {
	t.Parallel()

	assertStringFilter(t, "wiki")
	assertBoolFilter(t, true)
	assertFloatFilter(t, 3.5)
	assertStringSliceFilter(t, []string{"a", "b", "a"}, []string{"a", "b"})
	assertFloatSliceFilter(t, []int64{1, 2, 1}, []float64{1, 2})
	assertStringSliceFilter(t, []any{"x", "y"}, []string{"x", "y"})
}

func TestBuildRuntimeMetadataFieldFilterRejectsUnsupportedValues(t *testing.T) {
	t.Parallel()

	for _, value := range []any{
		[]any{"x", 1},
		map[string]any{"x": "y"},
		struct{ Name string }{Name: "x"},
		nil,
	} {
		if filter, ok := appservice.BuildRuntimeMetadataFieldFilterForTest("key", value); ok {
			t.Fatalf("expected value %#v to be rejected, got %#v", value, filter)
		}
	}
}

func assertStringFilter(t *testing.T, value string) {
	t.Helper()
	filter, ok := appservice.BuildRuntimeMetadataFieldFilterForTest("key", value)
	if !ok || filter.Match.EqString == nil || *filter.Match.EqString != value {
		t.Fatalf("unexpected string filter: %#v ok=%v", filter, ok)
	}
}

func assertBoolFilter(t *testing.T, value bool) {
	t.Helper()
	filter, ok := appservice.BuildRuntimeMetadataFieldFilterForTest("key", value)
	if !ok || filter.Match.EqBool == nil || *filter.Match.EqBool != value {
		t.Fatalf("unexpected bool filter: %#v ok=%v", filter, ok)
	}
}

func assertFloatFilter(t *testing.T, value float64) {
	t.Helper()
	filter, ok := appservice.BuildRuntimeMetadataFieldFilterForTest("key", value)
	if !ok || filter.Match.EqFloat == nil || *filter.Match.EqFloat != value {
		t.Fatalf("unexpected float filter: %#v ok=%v", filter, ok)
	}
}

func assertStringSliceFilter(t *testing.T, value any, want []string) {
	t.Helper()
	filter, ok := appservice.BuildRuntimeMetadataFieldFilterForTest("key", value)
	if !ok || !slices.Equal(filter.Match.InStrings, want) {
		t.Fatalf("unexpected string slice filter: %#v ok=%v want=%#v", filter, ok, want)
	}
}

func assertFloatSliceFilter(t *testing.T, value any, want []float64) {
	t.Helper()
	filter, ok := appservice.BuildRuntimeMetadataFieldFilterForTest("key", value)
	if !ok || !slices.Equal(filter.Match.InFloats, want) {
		t.Fatalf("unexpected float slice filter: %#v ok=%v want=%#v", filter, ok, want)
	}
}
