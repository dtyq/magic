<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\Search;

use App\Infrastructure\ExternalAPI\Search\Adapter\DeepSeekSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\DeepSeekSearch;
use App\Infrastructure\ExternalAPI\Search\Factory\SearchEngineAdapterFactory;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\Search\Adapter\DeepSeekSearchAdapter
 */
final class DeepSeekSearchAdapterTest extends TestCase
{
    public function testApiKeyAloneIsEnoughWhenEndpointUsesDefault(): void
    {
        $adapter = new DeepSeekSearchAdapter(
            $this->createMock(DeepSeekSearch::class),
            ['api_key' => 'test-key']
        );

        self::assertTrue($adapter->isAvailable());
    }

    public function testEmptyApiKeyMakesAdapterUnavailable(): void
    {
        $adapter = new DeepSeekSearchAdapter(
            $this->createMock(DeepSeekSearch::class),
            ['request_url' => 'https://api.deepseek.com/v1/tools/search']
        );

        self::assertFalse($adapter->isAvailable());
    }

    public function testFactoryCreatesAdapterWithSharedClientDependency(): void
    {
        $factory = ApplicationContext::getContainer()->get(SearchEngineAdapterFactory::class);

        $adapter = $factory->create('deepseek', ['api_key' => 'test-key']);

        self::assertInstanceOf(DeepSeekSearchAdapter::class, $adapter);
        self::assertTrue($adapter->isAvailable());
    }
}
