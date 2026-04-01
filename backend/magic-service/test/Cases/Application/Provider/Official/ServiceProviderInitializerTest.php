<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Official;

use App\Application\Provider\Official\ServiceProviderInitializer;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelConfigVersionModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ServiceProviderInitializerTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
    }

    protected function tearDown(): void
    {
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testInitCreatesOfficialVideoProviderWhenApiKeyExists(): void
    {
        $this->createOfficialVideoProviderFixture('https://initializer-before.example.com', '');
        $this->setIsolatedConfig('model_gateway.video_providers', [
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://initializer.example.com',
                apiKey: 'initializer-video-key',
            ),
        ]);

        $result = ServiceProviderInitializer::init();

        $this->assertTrue($result['success']);
        $provider = $this->getOfficialVideoProvider();
        $this->trackProviderTreeByProviderId((int) $provider->id);
        $providerConfig = $this->getOfficialVideoProviderConfig((int) $provider->id);

        $this->assertSame('initializer-video-key', $providerConfig->config['api_key']);
        $this->assertSame(2, ProviderModelModel::query()
            ->where('service_provider_config_id', $providerConfig->id)
            ->whereIn('model_id', [
                $this->officialFastVideoModelId(),
                $this->officialProVideoModelId(),
            ])
            ->distinct('model_id')
            ->count('model_id'));
        $this->assertSame(2, ProviderModelConfigVersionModel::query()
            ->whereIn('service_provider_model_id', ProviderModelModel::query()
                ->where('service_provider_config_id', $providerConfig->id)
                ->whereIn('model_id', [
                    $this->officialFastVideoModelId(),
                    $this->officialProVideoModelId(),
                ])
                ->pluck('id')
                ->all())
            ->where('is_current_version', true)
            ->count());
    }

    public function testInitSkipsOfficialVideoProviderWhenApiKeyMissing(): void
    {
        $this->createOfficialVideoProviderFixture('https://initializer-skip.example.com', '');
        $this->setIsolatedConfig('model_gateway.video_providers', [
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://initializer-skip.example.com',
                apiKey: '',
            ),
        ]);

        $result = ServiceProviderInitializer::init();

        $this->assertTrue($result['success']);
        $this->assertStringContainsString('skip', strtolower($result['message']));
        $this->assertSame((string) self::TEST_PROVIDER_ID, (string) $this->getOfficialVideoProvider()->id);
    }
}
