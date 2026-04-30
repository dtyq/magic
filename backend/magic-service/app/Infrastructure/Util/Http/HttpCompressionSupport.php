<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Http;

use Hyperf\Engine\Http\WritableConnection;
use Hyperf\HttpMessage\Server\Response as HyperfResponse;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class HttpCompressionSupport
{
    public const int COMPRESSION_THRESHOLD_BYTES = 100 * 1024;

    public const string CONTENT_ENCODING_GZIP = 'gzip';

    // 预编码响应会先在接口层完成 body 组装和压缩协商，再用这个内部头告诉 middleware 不要重复压缩。
    public const string SKIP_COMPRESSION_HEADER = 'X-Magic-Skip-Compression';

    // 将压缩判定抽成独立组件，避免 middleware 和直出工厂各维护一套 Accept-Encoding/阈值/Vary 规则。
    public function applyCompression(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        if ($this->shouldSkipCompression($request, $response)) {
            return $response;
        }

        $rawBody = (string) $response->getBody();
        if ($rawBody === '') {
            return $response;
        }

        if (strlen($rawBody) <= self::COMPRESSION_THRESHOLD_BYTES) {
            return $response;
        }

        $response = $this->withVaryHeader($response);
        if (! $this->acceptsGzip($request)) {
            return $response;
        }

        $compressedBody = gzencode($rawBody, -1, ZLIB_ENCODING_GZIP);
        if (! is_string($compressedBody)) {
            return $response;
        }

        return $response
            ->withBody(new SwooleStream($compressedBody))
            ->withHeader('Content-Encoding', self::CONTENT_ENCODING_GZIP)
            ->withHeader('Content-Length', (string) strlen($compressedBody));
    }

    public function acceptsGzip(ServerRequestInterface $request): bool
    {
        $acceptEncoding = $request->getHeaderLine('Accept-Encoding');
        if ($acceptEncoding === '') {
            return false;
        }

        foreach (explode(',', strtolower($acceptEncoding)) as $encodingPart) {
            $encodingPart = trim($encodingPart);
            if ($encodingPart === '') {
                continue;
            }

            $segments = array_map('trim', explode(';', $encodingPart));
            $encoding = array_shift($segments);
            if ($encoding !== self::CONTENT_ENCODING_GZIP && $encoding !== '*') {
                continue;
            }

            $quality = 1.0;
            foreach ($segments as $segment) {
                if (! str_starts_with($segment, 'q=')) {
                    continue;
                }

                $quality = (float) substr($segment, 2);
                break;
            }

            if ($quality > 0.0) {
                return true;
            }
        }

        return false;
    }

    public function withVaryHeader(ResponseInterface $response): ResponseInterface
    {
        $varyHeader = $response->getHeaderLine('Vary');
        if ($varyHeader === '') {
            return $response->withHeader('Vary', 'Accept-Encoding');
        }

        $values = array_filter(array_map('trim', explode(',', $varyHeader)));
        if (array_any($values, static fn ($existingValue) => strcasecmp($existingValue, 'Accept-Encoding') === 0)) {
            return $response;
        }

        $values[] = 'Accept-Encoding';
        return $response->withHeader('Vary', implode(', ', $values));
    }

    private function shouldSkipCompression(ServerRequestInterface $request, ResponseInterface $response): bool
    {
        // 这些响应要么没有可压缩 body，要么已经进入自定义写出链路；继续改写会破坏既有语义。
        if (strtoupper($request->getMethod()) === 'HEAD') {
            return true;
        }

        $statusCode = $response->getStatusCode();
        if (($statusCode >= 100 && $statusCode < 200) || in_array($statusCode, [204, 304], true)) {
            return true;
        }

        if ($response->hasHeader('Content-Encoding') || $response->hasHeader('Content-Disposition')) {
            return true;
        }

        if ($this->hasStreamingConnection($response)) {
            return true;
        }

        $contentType = $this->normalizeContentType($response->getHeaderLine('Content-Type'));
        if ($contentType === '' || $contentType === 'text/event-stream') {
            return true;
        }

        return ! $this->isCompressibleContentType($contentType);
    }

    private function normalizeContentType(string $contentType): string
    {
        if ($contentType === '') {
            return '';
        }

        $parts = explode(';', $contentType, 2);
        return strtolower(trim($parts[0]));
    }

    private function isCompressibleContentType(string $contentType): bool
    {
        if ($contentType === 'application/json') {
            return true;
        }

        if (str_starts_with($contentType, 'application/') && str_ends_with($contentType, '+json')) {
            return true;
        }

        return str_starts_with($contentType, 'text/');
    }

    private function hasStreamingConnection(ResponseInterface $response): bool
    {
        if (! $response instanceof HyperfResponse) {
            return false;
        }

        $connection = $response->getConnection();
        if ($connection === null) {
            return false;
        }

        // 自定义 Writable 通常代表 SSE/socket/分块写出，这类响应必须跳过统一压缩。
        if (! $connection instanceof WritableConnection) {
            return true;
        }

        // 默认连接一旦开始发送，再改 body/headers 已经不安全。
        return $connection->isSent();
    }
}
