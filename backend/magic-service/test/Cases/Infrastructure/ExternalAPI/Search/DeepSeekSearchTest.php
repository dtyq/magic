<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\Search;

use App\Infrastructure\ExternalAPI\Search\DeepSeekSearch;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\Search\DeepSeekSearch
 */
final class DeepSeekSearchTest extends TestCase
{
    public function testContainerProvidesSharedGuzzleClient(): void
    {
        $container = ApplicationContext::getContainer();

        self::assertSame(
            $container->get(ClientInterface::class),
            $container->get(ClientInterface::class)
        );
    }

    public function testEmptyRequestUrlFallsBackToConfiguredEndpoint(): void
    {
        $defaultEndpoint = 'https://api.deepseek.com/v1/tools/search';
        $configuredEndpoint = 'https://deepseek.example.com/v1/tools/search';

        $config = $this->createMock(ConfigInterface::class);
        $config->expects(self::once())
            ->method('get')
            ->with('search.drivers.deepseek.endpoint', $defaultEndpoint)
            ->willReturn($configuredEndpoint);

        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"results":[]}'),
        ]));
        $handler->push(Middleware::history($history));
        $client = new Client(['handler' => $handler]);

        $search = new DeepSeekSearch($config, $client);
        $search->logger = new NullLogger();

        self::assertSame(['results' => []], $search->search('magic', 'test-key'));
        self::assertCount(1, $history);

        $request = $history[0]['request'];
        self::assertSame($configuredEndpoint, (string) $request->getUri());
        self::assertSame('Bearer test-key', $request->getHeaderLine('Authorization'));
        self::assertSame([
            'query' => 'magic',
            'count' => 10,
            'need_content' => false,
        ], json_decode((string) $request->getBody(), true, 512, JSON_THROW_ON_ERROR));
        self::assertSame(15, $history[0]['options']['timeout']);
        self::assertSame(5, $history[0]['options']['connect_timeout']);
    }

    public function testTransientFailureRetriesWithSameClient(): void
    {
        $endpoint = 'https://deepseek.example.com/v1/tools/search';
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(500),
            new Response(200, [], '{"results":[]}'),
        ]));
        $handler->push(Middleware::history($history));

        $search = new DeepSeekSearch(
            $this->createConfig($endpoint),
            new Client(['handler' => $handler])
        );
        $search->logger = new NullLogger();

        self::assertSame(['results' => []], $search->search('magic', 'test-key'));
        self::assertCount(2, $history);
    }

    public function testSequentialSearchesUseLatestApiKey(): void
    {
        $endpoint = 'https://deepseek.example.com/v1/tools/search';
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"results":[]}'),
            new Response(200, [], '{"results":[]}'),
        ]));
        $handler->push(Middleware::history($history));

        $search = new DeepSeekSearch(
            $this->createConfig($endpoint),
            new Client(['handler' => $handler])
        );
        $search->logger = new NullLogger();

        $search->search('first request', 'first-key');
        $search->search('second request', 'updated-key');

        self::assertSame('Bearer first-key', $history[0]['request']->getHeaderLine('Authorization'));
        self::assertSame('Bearer updated-key', $history[1]['request']->getHeaderLine('Authorization'));
    }

    public function testAuthenticationFailureIsNotRetried(): void
    {
        $endpoint = 'https://deepseek.example.com/v1/tools/search';
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(401),
            new Response(200, [], '{"results":[]}'),
        ]));
        $handler->push(Middleware::history($history));

        $search = new DeepSeekSearch(
            $this->createConfig($endpoint),
            new Client(['handler' => $handler])
        );
        $search->logger = new NullLogger();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('DeepSeek search request failed.');

        try {
            $search->search('magic', 'invalid-key');
        } finally {
            self::assertCount(1, $history);
        }
    }

    private function createConfig(string $endpoint): ConfigInterface
    {
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')
            ->with('search.drivers.deepseek.endpoint', 'https://api.deepseek.com/v1/tools/search')
            ->willReturn($endpoint);

        return $config;
    }
}
