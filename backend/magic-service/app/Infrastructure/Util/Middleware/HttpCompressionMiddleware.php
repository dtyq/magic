<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Middleware;

use App\Infrastructure\Util\Http\HttpCompressionSupport;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class HttpCompressionMiddleware implements MiddlewareInterface
{
    public const int COMPRESSION_THRESHOLD_BYTES = HttpCompressionSupport::COMPRESSION_THRESHOLD_BYTES;

    public function __construct(
        private readonly HttpCompressionSupport $compressionSupport = new HttpCompressionSupport()
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $response = $handler->handle($request);
        // 查询类接口可能已经在接口层完成 body 编码和压缩协商；这里只做一次拦截并移除内部头，避免泄露实现细节。
        if ($response->hasHeader(HttpCompressionSupport::SKIP_COMPRESSION_HEADER)) {
            return $response->withoutHeader(HttpCompressionSupport::SKIP_COMPRESSION_HEADER);
        }

        // 普通响应仍走统一压缩策略，保持历史行为不变。
        return $this->compressionSupport->applyCompression($request, $response);
    }
}
