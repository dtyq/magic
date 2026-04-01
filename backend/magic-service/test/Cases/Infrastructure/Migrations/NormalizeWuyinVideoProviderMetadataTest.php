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
class NormalizeWuyinVideoProviderMetadataTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
        $this->createOfficialVideoProviderFixture('https://migration.example.com', 'migration-key');

        ProviderModel::query()
            ->where('id', self::TEST_PROVIDER_ID)
            ->update([
                'name' => 'Google',
                'description' => '由 Google 提供的文生视频模型能力。',
                'remark' => 'Google 文生视频',
                'translate' => json_encode([
                    'name' => ['zh_CN' => '谷歌', 'en_US' => 'Google'],
                    'description' => [
                        'zh_CN' => '由 Google 提供的文生视频模型能力。',
                        'en_US' => 'Official Google text-to-video models.',
                    ],
                    'alias' => ['zh_CN' => 'Google Veo', 'en_US' => 'Google Veo'],
                ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            ]);
        ProviderConfigModel::query()
            ->where('id', self::TEST_PROVIDER_CONFIG_ID)
            ->update([
                'alias' => 'Google Veo',
                'translate' => json_encode([
                    'alias' => ['zh_CN' => 'Google Veo', 'en_US' => 'Google Veo'],
                ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            ]);
    }

    protected function tearDown(): void
    {
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testMigrationNormalizesLegacyGoogleStyledWuyinProviderMetadata(): void
    {
        $migration = require BASE_PATH . '/migrations/2026_03_27_120000_normalize_wuyin_video_provider_metadata.php';
        $migration->up();

        $provider = $this->getOfficialVideoProvider();
        $providerConfig = $this->getOfficialVideoProviderConfig((int) $provider->id);

        $this->assertSame('Video Gateway', $provider->name);
        $this->assertSame('聚合文生视频模型能力。', $provider->description);
        $this->assertSame('聚合文生视频', $provider->remark);
        $this->assertSame('Video Models', $providerConfig->alias);
        $this->assertSame('视频模型', $providerConfig->translate['alias']['zh_CN'] ?? null);
    }
}
