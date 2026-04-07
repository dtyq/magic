<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ModelGateway;

use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Infrastructure\ModelGateway\QueueExecutorConfigRepository;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class QueueExecutorConfigRepositoryTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    private const TEST_ORGANIZATION_CODE = 'queue-executor-config-test-org';

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

    public function testGetConfigReadsVideoConfigFromDatabase(): void
    {
        $this->createOfficialVideoProviderFixture('https://db-video.example.com', 'db-video-key');
        $this->setIsolatedConfig('model_gateway.video_queue.poll_interval_seconds', 5);
        $this->setIsolatedConfig('model_gateway.video_queue.poll_max_times', 80);

        $repository = new QueueExecutorConfigRepository();
        $config = $repository->getConfig($this->officialFastVideoModelId(), self::TEST_ORGANIZATION_CODE);

        $this->assertSame('https://db-video.example.com', $config->getBaseUrl());
        $this->assertSame('db-video-key', $config->getApiKey());
        $this->assertSame(5, $config->getPollIntervalSeconds());
        $this->assertSame(80, $config->getMaxPollTimes());
    }

    public function testGetConfigSupportsRealProviderModelPrimaryId(): void
    {
        $this->createOfficialVideoProviderFixture('https://db-video-id.example.com', 'db-video-key-id');
        $providerModel = $this->getProviderModel();

        $repository = new QueueExecutorConfigRepository();
        $config = $repository->getConfig((string) $providerModel->id, self::TEST_ORGANIZATION_CODE);

        $this->assertSame('https://db-video-id.example.com', $config->getBaseUrl());
        $this->assertSame('db-video-key-id', $config->getApiKey());
    }

    public function testGetConfigSupportsProModelId(): void
    {
        $this->createOfficialVideoProviderFixture('https://db-video-pro.example.com', 'db-video-key-pro');

        $repository = new QueueExecutorConfigRepository();
        $config = $repository->getConfig($this->officialProVideoModelId(), self::TEST_ORGANIZATION_CODE);

        $this->assertSame('https://db-video-pro.example.com', $config->getBaseUrl());
        $this->assertSame('db-video-key-pro', $config->getApiKey());
    }

    private function getProviderModel(): ProviderModelModel
    {
        return $this->getOfficialVideoProviderModel(self::TEST_PROVIDER_CONFIG_ID, $this->officialFastVideoModelId());
    }
}
