package qdrant_test

import (
	"errors"
	"math"
	"testing"

	pb "github.com/qdrant/go-client/qdrant"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/infrastructure/vectordb/qdrant"
)

func TestExtractVectorSize_Params(t *testing.T) {
	t.Parallel()
	info := &pb.CollectionInfo{
		Config: &pb.CollectionConfig{
			Params: &pb.CollectionParams{
				VectorsConfig: &pb.VectorsConfig{
					Config: &pb.VectorsConfig_Params{
						Params: &pb.VectorParams{Size: 3},
					},
				},
			},
		},
	}
	size, err := qdrant.ExtractVectorSizeForTest(info)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if size != 3 {
		t.Fatalf("expected 3, got %d", size)
	}
}

func TestExtractVectorSize_ParamsMapUsesNamedDenseVector(t *testing.T) {
	t.Parallel()
	info := &pb.CollectionInfo{
		Config: &pb.CollectionConfig{
			Params: &pb.CollectionParams{
				VectorsConfig: &pb.VectorsConfig{
					Config: &pb.VectorsConfig_ParamsMap{
						ParamsMap: &pb.VectorParamsMap{Map: map[string]*pb.VectorParams{fragmodel.DefaultDenseVectorName: {Size: 1}}},
					},
				},
			},
		},
	}
	size, err := qdrant.ExtractVectorSizeForTest(info)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if size != 1 {
		t.Fatalf("expected 1, got %d", size)
	}

	hasNamedDense, hasSparse := qdrant.ExtractCollectionSchemaForTest(info)
	if !hasNamedDense {
		t.Fatal("expected named dense vector to be detected")
	}
	if hasSparse {
		t.Fatal("expected sparse vector to be absent")
	}
}

func TestExtractCollectionSchema_LegacyUnnamedDenseWithNoSparse(t *testing.T) {
	t.Parallel()
	info := &pb.CollectionInfo{
		Config: &pb.CollectionConfig{
			Params: &pb.CollectionParams{
				VectorsConfig: &pb.VectorsConfig{
					Config: &pb.VectorsConfig_Params{
						Params: &pb.VectorParams{Size: 3},
					},
				},
			},
		},
	}

	hasNamedDense, hasSparse := qdrant.ExtractCollectionSchemaForTest(info)
	if hasNamedDense {
		t.Fatal("expected legacy unnamed dense vector schema")
	}
	if hasSparse {
		t.Fatal("expected sparse vector to be absent")
	}
}

func TestExtractCollectionSchema_HybridNamedVectors(t *testing.T) {
	t.Parallel()
	info := &pb.CollectionInfo{
		Config: &pb.CollectionConfig{
			Params: &pb.CollectionParams{
				VectorsConfig: &pb.VectorsConfig{
					Config: &pb.VectorsConfig_ParamsMap{
						ParamsMap: &pb.VectorParamsMap{Map: map[string]*pb.VectorParams{
							fragmodel.DefaultDenseVectorName: {Size: 1},
						}},
					},
				},
				SparseVectorsConfig: &pb.SparseVectorConfig{
					Map: map[string]*pb.SparseVectorParams{
						fragmodel.DefaultSparseVectorName: {Modifier: pb.Modifier_Idf.Enum()},
					},
				},
			},
		},
	}

	hasNamedDense, hasSparse := qdrant.ExtractCollectionSchemaForTest(info)
	if !hasNamedDense || !hasSparse {
		t.Fatalf("expected hybrid named vector schema, got dense=%v sparse=%v", hasNamedDense, hasSparse)
	}
}

func TestExtractVectorSize_IntegerOverflow(t *testing.T) {
	t.Parallel()
	info := &pb.CollectionInfo{
		Config: &pb.CollectionConfig{
			Params: &pb.CollectionParams{
				VectorsConfig: &pb.VectorsConfig{
					Config: &pb.VectorsConfig_Params{
						Params: &pb.VectorParams{Size: uint64(1 << 63)},
					},
				},
			},
		},
	}
	if _, err := qdrant.ExtractVectorSizeForTest(info); err == nil || !errors.Is(err, qdrant.ErrIntegerOverflow) {
		t.Fatalf("expected ErrIntegerOverflow, got %v", err)
	}
}

func TestConvertPayloadRoundTrip(t *testing.T) {
	t.Parallel()
	payload := map[string]any{
		"s": "str",
		"i": 1,
		"f": 1.5,
		"b": true,
		"m": map[string]any{"k": "v"},
		"l": []any{"a", 2.0},
	}
	converted := qdrant.ConvertToQdrantPayloadForTest(payload)
	back := qdrant.ExtractPayloadForTest(converted)
	strVal, ok := back["s"].(string)
	if !ok || strVal != "str" {
		t.Fatalf("unexpected string: %#v", back["s"])
	}
	intVal, ok := back["i"].(int64)
	if !ok || intVal != 1 {
		t.Fatalf("unexpected int: %#v", back["i"])
	}
	floatVal, ok := back["f"].(float64)
	if !ok || math.Abs(floatVal-1.5) > 0.0001 {
		t.Fatalf("unexpected float: %#v", back["f"])
	}
	boolVal, ok := back["b"].(bool)
	if !ok || boolVal != true {
		t.Fatalf("unexpected bool: %#v", back["b"])
	}
	mapVal, ok := back["m"].(map[string]any)
	if !ok || mapVal["k"] != "v" {
		t.Fatalf("unexpected map: %#v", back["m"])
	}
	listVal, ok := back["l"].([]any)
	if !ok || len(listVal) != 2 {
		t.Fatalf("unexpected list: %#v", back["l"])
	}
}

func TestBuildQdrantFilter(t *testing.T) {
	t.Parallel()
	val := 1.0
	filter := &fragmodel.VectorFilter{
		Must:    []fragmodel.FieldFilter{{Key: "k1", Match: fragmodel.Match{EqString: new("v1")}}},
		Should:  []fragmodel.FieldFilter{{Key: "k2", Match: fragmodel.Match{EqFloat: &val}}},
		MustNot: []fragmodel.FieldFilter{{Key: "k3", Match: fragmodel.Match{InStrings: []string{"a", "b"}}}},
	}
	qf := qdrant.BuildQdrantFilterForTest(filter)
	if qf == nil || len(qf.Must) == 0 || len(qf.Should) == 0 || len(qf.MustNot) == 0 {
		t.Fatalf("unexpected filter: %#v", qf)
	}
}

func TestBuildFieldConditions_EqBool(t *testing.T) {
	t.Parallel()
	val := true
	conds := qdrant.BuildFieldConditionsForTest(fragmodel.FieldFilter{Key: "k", Match: fragmodel.Match{EqBool: &val}})
	if len(conds) != 1 {
		t.Fatalf("expected 1 condition")
	}
}

func TestGetPayloadHelpers(t *testing.T) {
	t.Parallel()
	payload := map[string]any{"s": "v", "m": map[string]any{"k": "v"}}
	if qdrant.GetStringFromPayloadForTest(payload, "s") != "v" {
		t.Fatalf("unexpected string")
	}
	if qdrant.GetStringFromPayloadForTest(payload, "missing") != "" {
		t.Fatalf("expected empty string")
	}
	if qdrant.GetMapFromPayloadForTest(payload, "m")["k"] != "v" {
		t.Fatalf("unexpected map")
	}
	if qdrant.GetMapFromPayloadForTest(payload, "missing") != nil {
		t.Fatalf("expected nil map")
	}
}
