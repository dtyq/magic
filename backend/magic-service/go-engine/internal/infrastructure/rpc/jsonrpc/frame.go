package ipcrpc

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"sync"

	"magic/pkg/convert"
)

const (
	ipcFrameMagic            = "MIPC"
	ipcFrameMagicSize        = 4
	ipcFrameVersionV2        = 2
	ipcFrameHeaderSize       = ipcFrameMagicSize + 1 + 1 + 4
	ipcFrameCodecIdentity    = 0
	ipcFrameCodecGzip        = 1
	ipcIdentityThresholdByte = 10 * 1024
)

const (
	ipcFrameCodecIdentityName = "identity"
	ipcFrameCodecGzipName     = "gzip"
)

const maxPooledGzipBufferBytes = 1 << 20

var (
	errIPCFrameTooShort          = errors.New("ipc frame too short")
	errIPCFrameInvalidMagic      = errors.New("invalid ipc frame magic")
	errIPCFrameVersionMismatch   = errors.New("unsupported ipc frame version")
	errIPCFrameUnsupportedCodec  = errors.New("unsupported ipc frame codec")
	errIPCFrameRawLengthMismatch = errors.New("ipc frame raw length mismatch")
	errIPCFrameGzipDecode        = errors.New("ipc frame gzip decode failed")
)

type ipcFrameSummary struct {
	RawJSONBytes int
	FrameBytes   int
	Codec        string
}

type ipcFramePools struct {
	bufferPool sync.Pool
	writerPool sync.Pool
}

func newIPCFramePools() *ipcFramePools {
	pools := &ipcFramePools{}
	pools.bufferPool.New = func() any {
		return &bytes.Buffer{}
	}
	pools.writerPool.New = func() any {
		return gzip.NewWriter(io.Discard)
	}
	return pools
}

func encodeIPCFrame(rawJSON []byte, maxMessageBytes int) ([]byte, ipcFrameSummary, error) {
	return encodeIPCFrameWithPools(rawJSON, maxMessageBytes, nil)
}

func encodeIPCFrameWithPools(rawJSON []byte, maxMessageBytes int, pools *ipcFramePools) ([]byte, ipcFrameSummary, error) {
	payload := rawJSON
	codec := byte(ipcFrameCodecIdentity)

	if len(rawJSON) > ipcIdentityThresholdByte {
		compressed, err := gzipPayload(rawJSON, pools)
		if err != nil {
			return nil, ipcFrameSummary{}, fmt.Errorf("gzip ipc payload: %w", err)
		}
		payload = compressed
		codec = ipcFrameCodecGzip
	}

	rawLength, err := convert.SafeIntToUint32(len(rawJSON), "raw_json_bytes")
	if err != nil {
		return nil, ipcFrameSummary{}, fmt.Errorf("%w: raw_json_bytes=%d", ErrMessageTooLarge, len(rawJSON))
	}

	frameBody := make([]byte, ipcFrameHeaderSize+len(payload))
	copy(frameBody[:ipcFrameMagicSize], ipcFrameMagic)
	frameBody[ipcFrameMagicSize] = ipcFrameVersionV2
	frameBody[ipcFrameMagicSize+1] = codec
	binary.BigEndian.PutUint32(frameBody[ipcFrameMagicSize+2:ipcFrameHeaderSize], rawLength)
	copy(frameBody[ipcFrameHeaderSize:], payload)

	summary := ipcFrameSummary{
		RawJSONBytes: len(rawJSON),
		FrameBytes:   len(frameBody),
		Codec:        ipcFrameCodecName(codec),
	}
	if maxMessageBytes > 0 && len(frameBody) > maxMessageBytes {
		return nil, summary, fmt.Errorf(
			"%w: frame_bytes=%d raw_json_bytes=%d codec=%s max=%d",
			ErrMessageTooLarge,
			summary.FrameBytes,
			summary.RawJSONBytes,
			summary.Codec,
			maxMessageBytes,
		)
	}

	return frameBody, summary, nil
}

func summarizeIPCFrame(rawJSON []byte) (ipcFrameSummary, error) {
	_, summary, err := encodeIPCFrame(rawJSON, 0)
	return summary, err
}

func decodeIPCFrame(frameBody []byte) ([]byte, ipcFrameSummary, error) {
	if len(frameBody) < ipcFrameHeaderSize {
		return nil, ipcFrameSummary{}, errIPCFrameTooShort
	}
	if string(frameBody[:ipcFrameMagicSize]) != ipcFrameMagic {
		return nil, ipcFrameSummary{}, errIPCFrameInvalidMagic
	}

	version := frameBody[ipcFrameMagicSize]
	if version != ipcFrameVersionV2 {
		return nil, ipcFrameSummary{}, fmt.Errorf("%w: got=%d want=%d", errIPCFrameVersionMismatch, version, ipcFrameVersionV2)
	}

	codec := frameBody[ipcFrameMagicSize+1]
	rawJSONBytes, err := convert.SafeUint64ToInt(
		uint64(binary.BigEndian.Uint32(frameBody[ipcFrameMagicSize+2:ipcFrameHeaderSize])),
		"raw_json_bytes",
	)
	if err != nil {
		return nil, ipcFrameSummary{}, fmt.Errorf("%w: %w", errIPCFrameRawLengthMismatch, err)
	}

	payload := frameBody[ipcFrameHeaderSize:]
	summary := ipcFrameSummary{
		RawJSONBytes: rawJSONBytes,
		FrameBytes:   len(frameBody),
		Codec:        ipcFrameCodecName(codec),
	}

	switch codec {
	case ipcFrameCodecIdentity:
		if len(payload) != rawJSONBytes {
			return nil, summary, fmt.Errorf(
				"%w: codec=%s decoded=%d expected=%d",
				errIPCFrameRawLengthMismatch,
				summary.Codec,
				len(payload),
				rawJSONBytes,
			)
		}
		return payload, summary, nil
	case ipcFrameCodecGzip:
		decoded, err := gunzipPayload(payload)
		if err != nil {
			return nil, summary, fmt.Errorf("%w: %w", errIPCFrameGzipDecode, err)
		}
		if len(decoded) != rawJSONBytes {
			return nil, summary, fmt.Errorf(
				"%w: codec=%s decoded=%d expected=%d",
				errIPCFrameRawLengthMismatch,
				summary.Codec,
				len(decoded),
				rawJSONBytes,
			)
		}
		return decoded, summary, nil
	default:
		return nil, summary, fmt.Errorf("%w: codec=%d", errIPCFrameUnsupportedCodec, codec)
	}
}

func ipcFrameCodecName(codec byte) string {
	switch codec {
	case ipcFrameCodecIdentity:
		return ipcFrameCodecIdentityName
	case ipcFrameCodecGzip:
		return ipcFrameCodecGzipName
	default:
		return fmt.Sprintf("unknown(%d)", codec)
	}
}

func gzipPayload(raw []byte, pools *ipcFramePools) ([]byte, error) {
	if pools == nil {
		var buf bytes.Buffer
		writer := gzip.NewWriter(&buf)
		if _, err := writer.Write(raw); err != nil {
			_ = writer.Close()
			return nil, fmt.Errorf("write gzip payload: %w", err)
		}
		if err := writer.Close(); err != nil {
			return nil, fmt.Errorf("close gzip writer: %w", err)
		}
		return buf.Bytes(), nil
	}

	buf := pools.acquireGzipBuffer()
	writer := pools.acquireGzipWriter(buf)
	if _, err := writer.Write(raw); err != nil {
		pools.releaseGzipWriter(writer)
		pools.releaseGzipBuffer(buf)
		return nil, fmt.Errorf("write gzip payload: %w", err)
	}
	if err := writer.Close(); err != nil {
		pools.releaseGzipWriter(writer)
		pools.releaseGzipBuffer(buf)
		return nil, fmt.Errorf("close gzip writer: %w", err)
	}
	compressed := append([]byte(nil), buf.Bytes()...)
	pools.releaseGzipWriter(writer)
	pools.releaseGzipBuffer(buf)
	return compressed, nil
}

func gunzipPayload(payload []byte) ([]byte, error) {
	reader, err := gzip.NewReader(bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create gzip reader: %w", err)
	}
	defer func() {
		_ = reader.Close()
	}()

	decoded, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("read gzip payload: %w", err)
	}
	return decoded, nil
}

func (p *ipcFramePools) acquireGzipBuffer() *bytes.Buffer {
	buf, _ := p.bufferPool.Get().(*bytes.Buffer)
	if buf == nil {
		return &bytes.Buffer{}
	}
	buf.Reset()
	return buf
}

func (p *ipcFramePools) releaseGzipBuffer(buf *bytes.Buffer) {
	if buf == nil {
		return
	}
	if buf.Cap() > maxPooledGzipBufferBytes {
		return
	}
	buf.Reset()
	p.bufferPool.Put(buf)
}

func (p *ipcFramePools) acquireGzipWriter(buf *bytes.Buffer) *gzip.Writer {
	writer, _ := p.writerPool.Get().(*gzip.Writer)
	if writer == nil {
		return gzip.NewWriter(buf)
	}
	writer.Reset(buf)
	return writer
}

func (p *ipcFramePools) releaseGzipWriter(writer *gzip.Writer) {
	if writer == nil {
		return
	}
	writer.Reset(io.Discard)
	p.writerPool.Put(writer)
}
