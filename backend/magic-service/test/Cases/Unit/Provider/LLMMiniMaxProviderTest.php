<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Provider;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\Service\ConnectivityTest\LLM\LLMMiniMaxProvider;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class LLMMiniMaxProviderTest extends TestCase
{
    public function testApiBaseIsCorrect(): void
    {
        $provider = new LLMMiniMaxProvider();
        $reflection = new \ReflectionProperty($provider, 'apiBase');
        $reflection->setAccessible(true);
        $this->assertSame('https://api.minimax.io/v1', $reflection->getValue($provider));
    }

    public function testConnectivityTestFailsWithEmptyApiKey(): void
    {
        $provider = new LLMMiniMaxProvider();
        $config = new ProviderConfigItem([]);

        $response = $provider->connectivityTestByModel($config, 'MiniMax-M2.7');

        $this->assertFalse($response->getStatus());
    }

    public function testConnectivityTestSucceedsWithValidApiKey(): void
    {
        // Create a mock HTTP handler that returns a successful response
        $mock = new MockHandler([
            new Response(200, [], json_encode([
                'object' => 'list',
                'data' => [
                    ['id' => 'MiniMax-M2.7', 'object' => 'model'],
                    ['id' => 'MiniMax-M2.5', 'object' => 'model'],
                ],
            ])),
        ]);

        $handlerStack = HandlerStack::create($mock);
        $mockClient = new Client(['handler' => $handlerStack]);

        // Use a subclass to inject the mock client
        $provider = new class($mockClient) extends LLMMiniMaxProvider {
            private Client $mockClient;

            public function __construct(Client $mockClient)
            {
                $this->mockClient = $mockClient;
            }

            protected function fetchModels(string $apiKey): array
            {
                $response = $this->mockClient->request('GET', $this->apiBase . '/models', [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Content-Type' => 'application/json',
                    ],
                ]);

                return json_decode($response->getBody()->getContents(), true);
            }
        };

        $config = new ProviderConfigItem(['api_key' => 'test-valid-key']);

        $response = $provider->connectivityTestByModel($config, 'MiniMax-M2.7');

        $this->assertTrue($response->getStatus());
    }

    public function testConnectivityTestFailsWithInvalidApiKey(): void
    {
        // Create a mock HTTP handler that returns an authentication error
        $mock = new MockHandler([
            new \GuzzleHttp\Exception\ClientException(
                'Client error',
                new \GuzzleHttp\Psr7\Request('GET', 'https://api.minimax.io/v1/models'),
                new Response(401, [], json_encode([
                    'error' => [
                        'message' => 'Invalid API key',
                        'type' => 'authentication_error',
                    ],
                ]))
            ),
        ]);

        $handlerStack = HandlerStack::create($mock);
        $mockClient = new Client(['handler' => $handlerStack]);

        $provider = new class($mockClient) extends LLMMiniMaxProvider {
            private Client $mockClient;

            public function __construct(Client $mockClient)
            {
                $this->mockClient = $mockClient;
            }

            protected function fetchModels(string $apiKey): array
            {
                $response = $this->mockClient->request('GET', $this->apiBase . '/models', [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Content-Type' => 'application/json',
                    ],
                ]);

                return json_decode($response->getBody()->getContents(), true);
            }
        };

        $config = new ProviderConfigItem(['api_key' => 'invalid-key']);

        $response = $provider->connectivityTestByModel($config, 'MiniMax-M2.7');

        $this->assertFalse($response->getStatus());
    }

    public function testConnectivityTestFailsOnNetworkError(): void
    {
        // Create a mock HTTP handler that throws a network exception
        $mock = new MockHandler([
            new \GuzzleHttp\Exception\ConnectException(
                'Connection refused',
                new \GuzzleHttp\Psr7\Request('GET', 'https://api.minimax.io/v1/models')
            ),
        ]);

        $handlerStack = HandlerStack::create($mock);
        $mockClient = new Client(['handler' => $handlerStack]);

        $provider = new class($mockClient) extends LLMMiniMaxProvider {
            private Client $mockClient;

            public function __construct(Client $mockClient)
            {
                $this->mockClient = $mockClient;
            }

            protected function fetchModels(string $apiKey): array
            {
                $response = $this->mockClient->request('GET', $this->apiBase . '/models', [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Content-Type' => 'application/json',
                    ],
                ]);

                return json_decode($response->getBody()->getContents(), true);
            }
        };

        $config = new ProviderConfigItem(['api_key' => 'test-key']);

        $response = $provider->connectivityTestByModel($config, 'MiniMax-M2.7');

        $this->assertFalse($response->getStatus());
        $this->assertNotEmpty($response->getMessage());
    }
}
