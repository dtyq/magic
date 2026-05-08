<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\Http;

use App\Infrastructure\Util\Http\HttpCompressionSupport;
use App\Infrastructure\Util\Http\LowCodePassthroughResponseFactory;
use Hyperf\Codec\Json;
use Hyperf\HttpMessage\Server\Request;
use Hyperf\HttpMessage\Server\Response as PsrResponse;
use Hyperf\HttpServer\Response;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;

/**
 * @internal
 */
class LowCodePassthroughResponseFactoryTest extends TestCase
{
    private LowCodePassthroughResponseFactory $factory;

    protected function setUp(): void
    {
        parent::setUp();
        $response = new Response(new PsrResponse());
        $this->factory = new LowCodePassthroughResponseFactory($response, new HttpCompressionSupport());
    }

    public function testSuccessShouldReturnCompressedLowCodeResponseWhenClientAcceptsGzip(): void
    {
        $data = ['content' => str_repeat('a', HttpCompressionSupport::COMPRESSION_THRESHOLD_BYTES + 128)];
        $response = $this->factory->success(
            $this->makeRequest(['Accept-Encoding' => 'gzip, deflate']),
            $data
        );

        $compressedBody = (string) $response->getBody();
        $decodedBody = gzdecode($compressedBody);
        $payload = Json::decode($decodedBody);

        $this->assertSame('gzip', $response->getHeaderLine('Content-Encoding'));
        $this->assertSame('Accept-Encoding', $response->getHeaderLine('Vary'));
        $this->assertSame('1', $response->getHeaderLine(HttpCompressionSupport::SKIP_COMPRESSION_HEADER));
        $this->assertSame((string) strlen($compressedBody), $response->getHeaderLine('Content-Length'));
        $this->assertSame(1000, $payload['code']);
        $this->assertSame('ok', $payload['message']);
        $this->assertSame($data, $payload['data']);
    }

    public function testSuccessShouldReturnPlainLowCodeResponseWhenClientDoesNotAcceptGzip(): void
    {
        $data = ['content' => str_repeat('b', HttpCompressionSupport::COMPRESSION_THRESHOLD_BYTES + 128)];
        $response = $this->factory->success(
            $this->makeRequest(['Accept-Encoding' => 'br']),
            $data
        );

        $body = (string) $response->getBody();
        $payload = Json::decode($body);

        $this->assertSame('', $response->getHeaderLine('Content-Encoding'));
        $this->assertSame('Accept-Encoding', $response->getHeaderLine('Vary'));
        $this->assertSame('1', $response->getHeaderLine(HttpCompressionSupport::SKIP_COMPRESSION_HEADER));
        $this->assertSame((string) strlen($body), $response->getHeaderLine('Content-Length'));
        $this->assertSame(1000, $payload['code']);
        $this->assertSame($data, $payload['data']);
    }

    private function makeRequest(array $headers = []): ServerRequestInterface
    {
        return new Request('GET', 'https://magic.test/api/v1/knowledge-bases/fragments/preview', $headers);
    }
}
