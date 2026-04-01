<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVideoClient;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class WuyinVeoVideoAdapterTest extends TestCase
{
    public function testResolveGenerationConfigReturnsConfiguredVeoCapability(): void
    {
        $adapter = $this->createAdapter();

        $config = $adapter->resolveGenerationConfig('veo3.1_fast', 'wuyin-veo-3.1-fast-generate-preview');

        $this->assertNotNull($config);
        $this->assertSame(['text_prompt', 'image', 'last_frame'], $config->toArray()['supported_inputs']);
        $this->assertSame(0, $config->toArray()['reference_images']['max_count']);
        $this->assertSame([], $config->toArray()['reference_images']['reference_types']);
        $this->assertFalse($config->toArray()['generation']['supports_seed']);
    }

    public function testResolveGenerationConfigReturnsNullForUnsupportedModel(): void
    {
        $adapter = $this->createAdapter();

        $this->assertNull($adapter->resolveGenerationConfig('unknown-model', 'unknown-model'));
    }

    private function createAdapter(): WuyinVeoVideoAdapter
    {
        return new WuyinVeoVideoAdapter(
            new WuyinVideoClient($this->createMock(ClientFactory::class))
        );
    }
}
