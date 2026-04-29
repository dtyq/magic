<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\Http;

use App\Application\KnowledgeBase\DTO\RpcHttpPassthroughResult;
use App\Infrastructure\Util\Http\HttpCompressionSupport;
use App\Infrastructure\Util\Http\RpcHttpPassthroughResponseFactory;
use Hyperf\HttpMessage\Server\Response as PsrResponse;
use Hyperf\HttpServer\Response;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class RpcHttpPassthroughResponseFactoryTest extends TestCase
{
    public function testFromResultShouldWriteHeadersAndBody(): void
    {
        $factory = new RpcHttpPassthroughResponseFactory(new Response(new PsrResponse()));
        $body = gzencode('{"code":1000,"message":"ok","data":{"x":1}}');
        self::assertIsString($body);

        $result = new RpcHttpPassthroughResult(
            statusCode: 200,
            contentType: 'application/json; charset=utf-8',
            contentEncoding: 'gzip',
            vary: 'Accept-Encoding',
            bodyBase64: base64_encode($body),
            bodyBytes: strlen($body),
        );

        $response = $factory->fromResult($result);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('application/json; charset=utf-8', $response->getHeaderLine('Content-Type'));
        $this->assertSame('gzip', $response->getHeaderLine('Content-Encoding'));
        $this->assertSame('Accept-Encoding', $response->getHeaderLine('Vary'));
        $this->assertSame((string) strlen($body), $response->getHeaderLine('Content-Length'));
        $this->assertSame('1', $response->getHeaderLine(HttpCompressionSupport::SKIP_COMPRESSION_HEADER));
        $this->assertSame($body, (string) $response->getBody());
    }

    public function testDecodedBodyShouldDecodeBase64(): void
    {
        $result = new RpcHttpPassthroughResult(
            statusCode: 200,
            contentType: 'application/json; charset=utf-8',
            contentEncoding: '',
            vary: '',
            bodyBase64: base64_encode('{"code":1000}'),
            bodyBytes: 13,
        );

        $this->assertSame('{"code":1000}', $result->decodedBody());
    }
}
