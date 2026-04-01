<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Migrations;

use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModel;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MigrateVideoProviderOfficialToWuyinTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
        $this->createOfficialVideoProviderFixture('https://migration.example.com', 'migration-key');

        ProviderModel::query()
            ->where('id', self::TEST_PROVIDER_ID)
            ->update(['provider_code' => 'Official']);
        ProviderConfigModel::query()
            ->where('id', self::TEST_PROVIDER_CONFIG_ID)
            ->update(['provider_code' => 'Official']);
    }

    protected function tearDown(): void
    {
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testMigrationUpdatesExistingVideoProviderTreeToWuyin(): void
    {
        $migration = require BASE_PATH . '/migrations/2026_03_21_120000_migrate_video_provider_official_to_wuyin.php';
        $migration->up();

        $provider = $this->getOfficialVideoProvider();
        $providerConfig = $this->getOfficialVideoProviderConfig((int) $provider->id);
        $fastModel = $this->getOfficialVideoProviderModel((int) $providerConfig->id, $this->officialFastVideoModelId());

        $this->assertSame('Wuyin', $provider->provider_code);
        $this->assertSame('Wuyin', $providerConfig->provider_code);
        $this->assertSame((string) self::TEST_PROVIDER_CONFIG_ID, (string) $fastModel->service_provider_config_id);
    }
}
