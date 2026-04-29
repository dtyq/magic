<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\Middleware;

use App\Infrastructure\Util\Middleware\ResponseMiddleware;
use Hyperf\HttpMessage\Server\Request;
use Hyperf\HttpMessage\Server\Response;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use ReflectionMethod;

/**
 * @internal
 */
class ResponseMiddlewareTest extends TestCase
{
    public function testFormatMessageShouldOmitEncodedResponseBody(): void
    {
        $middleware = $this->newMiddleware();
        $request = new Request('GET', 'https://magic.test/api/test');
        $response = (new Response())
            ->withContent(str_repeat('a', 128))
            ->withHeader('Content-Encoding', 'gzip');

        $message = $this->invokePrivate(
            $middleware,
            'formatMessage',
            [$request, $response, microtime(true), microtime(true)]
        );

        $this->assertStringContainsString('[encoded body omitted encoding=gzip len=128]', $message['responseBody']);
    }

    public function testFormatMessageShouldKeepPlainResponseBody(): void
    {
        $middleware = $this->newMiddleware();
        $request = new Request('GET', 'https://magic.test/api/test');
        $response = (new Response())->withContent('plain-response');

        $message = $this->invokePrivate(
            $middleware,
            'formatMessage',
            [$request, $response, microtime(true), microtime(true)]
        );

        $this->assertSame('plain-response', $message['responseBody']);
    }

    private function newMiddleware(): ResponseMiddleware
    {
        $logger = $this->createMock(LoggerInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->with('request-track')->willReturn($logger);

        return new ResponseMiddleware(
            $this->createMock(ContainerInterface::class),
            $loggerFactory,
        );
    }

    /**
     * @param array<int, mixed> $arguments
     */
    private function invokePrivate(object $instance, string $method, array $arguments): mixed
    {
        $reflection = new ReflectionMethod($instance, $method);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($instance, $arguments);
    }
}
