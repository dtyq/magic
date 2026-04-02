<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Migrations;

use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class RenameWuyinVideoModelIdsTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
        $this->createOfficialVideoProviderFixture('https://migration.example.com', 'migration-key');

        ProviderModelModel::query()
            ->where('id', self::TEST_FAST_MODEL_PRIMARY_ID)
            ->update(['model_id' => 'veo-3.1-fast-generate-preview']);
        ProviderModelModel::query()
            ->where('id', self::TEST_PRO_MODEL_PRIMARY_ID)
            ->update(['model_id' => 'veo-3.1-generate-preview']);
    }

    protected function tearDown(): void
    {
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testMigrationRenamesLegacyWuyinVeoModelIdsToScopedIds(): void
    {
        $migration = require BASE_PATH . '/migrations/2026_03_27_130000_rename_wuyin_video_model_ids.php';
        $migration->up();

        $this->assertSame(
            'wuyin-veo-3.1-fast-generate-preview',
            (string) ProviderModelModel::query()->where('id', self::TEST_FAST_MODEL_PRIMARY_ID)->value('model_id')
        );
        $this->assertSame(
            'wuyin-veo-3.1-generate-preview',
            (string) ProviderModelModel::query()->where('id', self::TEST_PRO_MODEL_PRIMARY_ID)->value('model_id')
        );
    }
}
