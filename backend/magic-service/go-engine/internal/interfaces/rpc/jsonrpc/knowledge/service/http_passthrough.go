package service

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

const (
	httpPassthroughStatusOK             = 200
	httpPassthroughContentTypeJSON      = "application/json; charset=utf-8"
	httpPassthroughContentEncodingGzip  = "gzip"
	httpPassthroughVaryAcceptEncoding   = "Accept-Encoding"
	httpPassthroughCompressionThreshold = 100 * 1024
	lowCodeSuccessCode                  = 1000
	lowCodeSuccessMessage               = "ok"
)

type lowCodePayload struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

func newSuccessPassthroughResponse(data any, acceptEncoding string) (*dto.HTTPPassthroughResponse, error) {
	return buildPassthroughResponse(lowCodePayload{
		Code:    lowCodeSuccessCode,
		Message: lowCodeSuccessMessage,
		Data:    data,
	}, acceptEncoding)
}

func newErrorPassthroughResponse(err error, acceptEncoding string) (*dto.HTTPPassthroughResponse, error) {
	mapped := mapBusinessError(err)
	var bizErr *jsonrpc.BusinessError
	if !errors.As(mapped, &bizErr) {
		bizErr = jsonrpc.NewBusinessError(jsonrpc.ErrCodeInternalError, nil)
	}

	return buildPassthroughResponse(lowCodePayload{
		Code:    bizErr.Code,
		Message: bizErr.Message,
		Data:    nil,
	}, acceptEncoding)
}

func buildPassthroughResponse(payload lowCodePayload, acceptEncoding string) (*dto.HTTPPassthroughResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal low code passthrough body: %w", err)
	}

	contentEncoding := ""
	vary := ""
	finalBody := body

	if len(body) > httpPassthroughCompressionThreshold {
		vary = httpPassthroughVaryAcceptEncoding
		if acceptsGzipEncoding(acceptEncoding) {
			compressed, err := gzipBytes(body)
			if err != nil {
				return nil, err
			}
			finalBody = compressed
			contentEncoding = httpPassthroughContentEncodingGzip
		}
	}

	return &dto.HTTPPassthroughResponse{
		StatusCode:      httpPassthroughStatusOK,
		ContentType:     httpPassthroughContentTypeJSON,
		ContentEncoding: contentEncoding,
		Vary:            vary,
		BodyBase64:      base64.StdEncoding.EncodeToString(finalBody),
		BodyBytes:       len(finalBody),
	}, nil
}

func acceptsGzipEncoding(acceptEncoding string) bool {
	if acceptEncoding == "" {
		return false
	}

	for part := range strings.SplitSeq(strings.ToLower(acceptEncoding), ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		segments := strings.Split(part, ";")
		encoding := strings.TrimSpace(segments[0])
		if encoding != httpPassthroughContentEncodingGzip && encoding != "*" {
			continue
		}

		quality := 1.0
		for _, segment := range segments[1:] {
			segment = strings.TrimSpace(segment)
			if !strings.HasPrefix(segment, "q=") {
				continue
			}

			var parsed float64
			if _, err := fmt.Sscanf(strings.TrimPrefix(segment, "q="), "%f", &parsed); err == nil {
				quality = parsed
			}
			break
		}

		if quality > 0.0 {
			return true
		}
	}

	return false
}

func gzipBytes(raw []byte) ([]byte, error) {
	var buffer bytes.Buffer
	writer := gzip.NewWriter(&buffer)
	if _, err := writer.Write(raw); err != nil {
		_ = writer.Close()
		return nil, fmt.Errorf("write gzip passthrough body: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close gzip passthrough writer: %w", err)
	}
	return buffer.Bytes(), nil
}
