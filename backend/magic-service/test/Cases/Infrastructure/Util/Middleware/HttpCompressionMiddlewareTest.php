<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\Middleware;

use App\Infrastructure\Util\Http\HttpCompressionSupport;
use App\Infrastructure\Util\Middleware\HttpCompressionMiddleware;
use Hyperf\Engine\Contract\Http\Writable;
use Hyperf\Engine\Http\WritableConnection;
use Hyperf\HttpMessage\Server\Request;
use Hyperf\HttpMessage\Server\Response;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * @internal
 */
class HttpCompressionMiddlewareTest extends TestCase
{
    private HttpCompressionMiddleware $middleware;

    protected function setUp(): void
    {
        parent::setUp();
        $this->middleware = new HttpCompressionMiddleware();
    }

    public function testCompressesLargeJsonResponsesWhenClientAcceptsGzip(): void
    {
        $body = str_repeat('a', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip, deflate']),
            $this->makeResponse($body, ['Content-Type' => 'application/json; charset=utf-8'])
        );

        $compressedBody = (string) $response->getBody();

        $this->assertSame('gzip', $response->getHeaderLine('Content-Encoding'));
        $this->assertSame('Accept-Encoding', $response->getHeaderLine('Vary'));
        $this->assertSame((string) strlen($compressedBody), $response->getHeaderLine('Content-Length'));
        $this->assertSame($body, gzdecode($compressedBody));
    }

    public function testDoesNotCompressResponsesAtOrBelowThreshold(): void
    {
        $exactThreshold = str_repeat('b', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES);
        $belowThreshold = str_repeat('c', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES - 1);

        $exactResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($exactThreshold, ['Content-Type' => 'application/json'])
        );
        $belowResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($belowThreshold, ['Content-Type' => 'application/json'])
        );

        $this->assertSame('', $exactResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $exactResponse->getHeaderLine('Vary'));
        $this->assertSame($exactThreshold, (string) $exactResponse->getBody());
        $this->assertSame('', $belowResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $belowResponse->getHeaderLine('Vary'));
        $this->assertSame($belowThreshold, (string) $belowResponse->getBody());
    }

    public function testCompressesApplicationPlusJsonAndTextPlainResponses(): void
    {
        $body = str_repeat('d', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 32);

        $problemJsonResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($body, ['Content-Type' => 'application/problem+json'])
        );
        $textPlainResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($body, ['Content-Type' => 'text/plain'])
        );

        $this->assertSame('gzip', $problemJsonResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame($body, gzdecode((string) $problemJsonResponse->getBody()));
        $this->assertSame('gzip', $textPlainResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame($body, gzdecode((string) $textPlainResponse->getBody()));
    }

    public function testLeavesLargeResponsesUncompressedWhenClientDoesNotAcceptGzip(): void
    {
        $body = str_repeat('e', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'br, deflate']),
            $this->makeResponse($body, ['Content-Type' => 'application/json'])
        );

        $this->assertSame('', $response->getHeaderLine('Content-Encoding'));
        $this->assertSame('Accept-Encoding', $response->getHeaderLine('Vary'));
        $this->assertSame($body, (string) $response->getBody());
    }

    public function testSkipsEventStreamResponses(): void
    {
        $body = str_repeat('f', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($body, ['Content-Type' => 'text/event-stream; charset=utf-8'])
        );

        $this->assertSame('', $response->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $response->getHeaderLine('Vary'));
        $this->assertSame($body, (string) $response->getBody());
    }

    public function testSkipsResponsesThatAlreadyHaveContentEncoding(): void
    {
        $body = str_repeat('g', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($body, [
                'Content-Type' => 'application/json',
                'Content-Encoding' => 'br',
            ])
        );

        $this->assertSame('br', $response->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $response->getHeaderLine('Vary'));
        $this->assertSame($body, (string) $response->getBody());
    }

    public function testSkipsCompressionAndRemovesInternalMarkerHeader(): void
    {
        $body = str_repeat('m', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($body, [
                'Content-Type' => 'application/json',
                HttpCompressionSupport::SKIP_COMPRESSION_HEADER => '1',
            ])
        );

        $this->assertSame('', $response->getHeaderLine('Content-Encoding'));
        $this->assertFalse($response->hasHeader(HttpCompressionSupport::SKIP_COMPRESSION_HEADER));
        $this->assertSame($body, (string) $response->getBody());
    }

    public function testSkipsResponsesWithContentDisposition(): void
    {
        $body = str_repeat('h', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($body, [
                'Content-Type' => 'text/plain',
                'Content-Disposition' => 'attachment; filename="report.txt"',
            ])
        );

        $this->assertSame('', $response->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $response->getHeaderLine('Vary'));
        $this->assertSame($body, (string) $response->getBody());
    }

    public function testCompressesResponsesWithUnsentWritableConnection(): void
    {
        $body = str_repeat('i', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->makeResponse($body, ['Content-Type' => 'application/json']);
        $connection = $this->getMockBuilder(WritableConnection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['isSent'])
            ->getMock();
        $connection->method('isSent')->willReturn(false);
        $response->setConnection($connection);

        $processedResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $response
        );

        $this->assertSame('gzip', $processedResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame($body, gzdecode((string) $processedResponse->getBody()));
    }

    public function testSkipsResponsesBoundToSentWritableConnection(): void
    {
        $body = str_repeat('k', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->makeResponse($body, ['Content-Type' => 'application/json']);
        $connection = $this->getMockBuilder(WritableConnection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['isSent'])
            ->getMock();
        $connection->method('isSent')->willReturn(true);
        $response->setConnection($connection);

        $processedResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $response
        );

        $this->assertSame('', $processedResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $processedResponse->getHeaderLine('Vary'));
        $this->assertSame($body, (string) $processedResponse->getBody());
    }

    public function testSkipsResponsesBoundToCustomWritableConnection(): void
    {
        $body = str_repeat('l', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $response = $this->makeResponse($body, ['Content-Type' => 'application/json']);
        $response->setConnection(new class implements Writable {
            public function getSocket(): mixed
            {
                return null;
            }

            public function write(string $data): bool
            {
                return true;
            }

            public function end(): ?bool
            {
                return true;
            }
        });

        $processedResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $response
        );

        $this->assertSame('', $processedResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $processedResponse->getHeaderLine('Vary'));
        $this->assertSame($body, (string) $processedResponse->getBody());
    }

    public function testSkipsHeadRequestsAndNoContentStatuses(): void
    {
        $body = str_repeat('j', HttpCompressionMiddleware::COMPRESSION_THRESHOLD_BYTES + 1);
        $headResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip'], 'HEAD'),
            $this->makeResponse($body, ['Content-Type' => 'application/json'])
        );
        $noContentResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($body, ['Content-Type' => 'application/json'], 204)
        );
        $notModifiedResponse = $this->process(
            $this->makeRequest(['Accept-Encoding' => 'gzip']),
            $this->makeResponse($body, ['Content-Type' => 'application/json'], 304)
        );

        $this->assertSame('', $headResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $noContentResponse->getHeaderLine('Content-Encoding'));
        $this->assertSame('', $notModifiedResponse->getHeaderLine('Content-Encoding'));
    }

    private function makeRequest(array $headers = [], string $method = 'GET'): ServerRequestInterface
    {
        return new Request($method, 'https://magic.test/api/test', $headers);
    }

    private function makeResponse(string $body, array $headers = [], int $statusCode = 200): Response
    {
        $response = (new Response())
            ->withContent($body)
            ->withStatus($statusCode);

        foreach ($headers as $name => $value) {
            $response = $response->withHeader($name, $value);
        }

        return $response;
    }

    private function process(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return $this->middleware->process($request, new class($response) implements RequestHandlerInterface {
            public function __construct(private readonly ResponseInterface $response)
            {
            }

            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return $this->response;
            }
        });
    }
}
