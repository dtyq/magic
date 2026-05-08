package ipcrpc_test

import (
	"bytes"
	"strings"
	"testing"

	jsonrpc "magic/internal/infrastructure/rpc/jsonrpc"
)

func TestIPCFrameIdentityRoundTrip(t *testing.T) {
	t.Parallel()

	rawJSON := []byte(`{"jsonrpc":"2.0","method":"ipc.hello","id":1}`)
	frameBody, codec, err := jsonrpc.EncodeIPCFrameForTest(rawJSON, 30*1024*1024)
	if err != nil {
		t.Fatalf("EncodeIPCFrameForTest() error = %v", err)
	}
	if codec != "identity" {
		t.Fatalf("codec = %q, want %q", codec, "identity")
	}

	decoded, err := jsonrpc.DecodeIPCFrameForTest(frameBody)
	if err != nil {
		t.Fatalf("DecodeIPCFrameForTest() error = %v", err)
	}
	if !bytes.Equal(decoded, rawJSON) {
		t.Fatalf("decoded payload mismatch")
	}
}

func TestIPCFrameGzipRoundTripAboveThreshold(t *testing.T) {
	t.Parallel()

	rawJSON := bytes.Repeat([]byte("a"), jsonrpc.IdentityThresholdBytesForTest()+1)
	frameBody, codec, err := jsonrpc.EncodeIPCFrameForTest(rawJSON, 30*1024*1024)
	if err != nil {
		t.Fatalf("EncodeIPCFrameForTest() error = %v", err)
	}
	if codec != "gzip" {
		t.Fatalf("codec = %q, want %q", codec, "gzip")
	}

	decoded, err := jsonrpc.DecodeIPCFrameForTest(frameBody)
	if err != nil {
		t.Fatalf("DecodeIPCFrameForTest() error = %v", err)
	}
	if !bytes.Equal(decoded, rawJSON) {
		t.Fatalf("decoded payload mismatch")
	}
}

func TestIPCFrameThresholdBoundaryUsesIdentityAt10KiB(t *testing.T) {
	t.Parallel()

	rawJSON := bytes.Repeat([]byte("b"), jsonrpc.IdentityThresholdBytesForTest())
	_, _, codec, err := jsonrpc.SummarizeIPCFrameForTest(rawJSON)
	if err != nil {
		t.Fatalf("SummarizeIPCFrameForTest() error = %v", err)
	}
	if codec != "identity" {
		t.Fatalf("codec = %q, want %q", codec, "identity")
	}
}

func TestIPCFrameRejectsInvalidMagic(t *testing.T) {
	t.Parallel()

	frameBody, _, err := jsonrpc.EncodeIPCFrameForTest([]byte(`{"jsonrpc":"2.0","id":1}`), 30*1024*1024)
	if err != nil {
		t.Fatalf("EncodeIPCFrameForTest() error = %v", err)
	}
	copy(frameBody[:4], "NOPE")

	if _, err := jsonrpc.DecodeIPCFrameForTest(frameBody); err == nil || !strings.Contains(err.Error(), "invalid ipc frame magic") {
		t.Fatalf("DecodeIPCFrameForTest() error = %v", err)
	}
}

func TestIPCFrameRejectsCorruptedGzipPayload(t *testing.T) {
	t.Parallel()

	rawJSON := bytes.Repeat([]byte("c"), jsonrpc.IdentityThresholdBytesForTest()+1)
	frameBody, _, err := jsonrpc.EncodeIPCFrameForTest(rawJSON, 30*1024*1024)
	if err != nil {
		t.Fatalf("EncodeIPCFrameForTest() error = %v", err)
	}
	frameBody[len(frameBody)-1] ^= 0xFF

	if _, err := jsonrpc.DecodeIPCFrameForTest(frameBody); err == nil || !strings.Contains(err.Error(), "ipc frame gzip decode failed") {
		t.Fatalf("DecodeIPCFrameForTest() error = %v", err)
	}
}

func TestIPCFrameRejectsRawLengthMismatch(t *testing.T) {
	t.Parallel()

	frameBody, _, err := jsonrpc.EncodeIPCFrameForTest([]byte(`{"jsonrpc":"2.0","id":1}`), 30*1024*1024)
	if err != nil {
		t.Fatalf("EncodeIPCFrameForTest() error = %v", err)
	}
	frameBody[9]++

	if _, err := jsonrpc.DecodeIPCFrameForTest(frameBody); err == nil || !strings.Contains(err.Error(), "ipc frame raw length mismatch") {
		t.Fatalf("DecodeIPCFrameForTest() error = %v", err)
	}
}

func TestIPCFrameRejectsOnWireSizeAboveLimit(t *testing.T) {
	t.Parallel()

	rawJSON := bytes.Repeat([]byte("d"), 256)
	if _, _, err := jsonrpc.EncodeIPCFrameForTest(rawJSON, 64); err == nil || !strings.Contains(err.Error(), "message too large") {
		t.Fatalf("EncodeIPCFrameForTest() error = %v", err)
	}
}
