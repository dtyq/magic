<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Http;

use App\Application\KnowledgeBase\DTO\RpcHttpPassthroughResult;
use Hyperf\HttpServer\Contract\ResponseInterface as HttpResponseInterface;
use Psr\Http\Message\ResponseInterface;

readonly class RpcHttpPassthroughResponseFactory
{
    public function __construct(
        private HttpResponseInterface $response,
    ) {
    }

    public function fromResult(RpcHttpPassthroughResult $result): ResponseInterface
    {
        $response = $this->response
            ->raw($result->decodedBody())
            ->withHeader('Content-Type', $result->contentType)
            ->withHeader('Content-Length', (string) $result->bodyBytes)
            ->withHeader(HttpCompressionSupport::SKIP_COMPRESSION_HEADER, '1')
            ->withStatus($result->statusCode);

        if ($result->contentEncoding !== '') {
            $response = $response->withHeader('Content-Encoding', $result->contentEncoding);
        }

        if ($result->vary !== '') {
            $response = $response->withHeader('Vary', $result->vary);
        }

        return $response;
    }
}
