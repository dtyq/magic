<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Http;

use Dtyq\ApiResponse\Response\LowCodeResponse;
use Hyperf\Codec\Json;
use Hyperf\HttpServer\Contract\ResponseInterface as HttpResponseInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

readonly class LowCodePassthroughResponseFactory
{
    /**
     * 将 low_code 查询类响应一次性编码为最终 HTTP body，并跳过中间件二次压缩。
     */
    public function __construct(
        private HttpResponseInterface $response,
        private HttpCompressionSupport $compressionSupport,
    ) {
    }

    public function success(ServerRequestInterface $request, mixed $data): ResponseInterface
    {
        $payload = (new LowCodeResponse())->success($data)->body();
        $json = Json::encode($payload);

        $response = $this->response
            ->raw($json)
            ->withHeader('Content-Type', 'application/json; charset=utf-8')
            ->withHeader('Content-Length', (string) strlen($json));

        $response = $this->compressionSupport->applyCompression($request, $response);

        return $response->withHeader(HttpCompressionSupport::SKIP_COMPRESSION_HEADER, '1');
    }
}
