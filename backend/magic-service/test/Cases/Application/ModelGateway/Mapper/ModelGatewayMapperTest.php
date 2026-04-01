<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Mapper;

use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Interfaces\Provider\Assembler\ProviderConfigAssembler;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModelGatewayMapperTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    private const TEST_ORGANIZATION_CODE = 'model-gateway-mapper-test-org';

    private const TEST_FIXTURE_OFFICIAL_ORGANIZATION_CODE = 'model-gateway-mapper-official-test-org';

    private const TEST_FIXTURE_PROVIDER_ID = 990100000000000001;

    private const TEST_FIXTURE_PROVIDER_CONFIG_ID = 990100000000001101;

    private const TEST_FIXTURE_FAST_MODEL_PRIMARY_ID = 990100000000001201;

    private const TEST_FIXTURE_PRO_MODEL_PRIMARY_ID = 990100000000001202;

    private const TEST_FIXTURE_FAST_MODEL_CONFIG_VERSION_ID = 990100000000001301;

    private const TEST_FIXTURE_PRO_MODEL_CONFIG_VERSION_ID = 990100000000001302;

    private const ORPHAN_CONFIG_ID = 990100000000009901;

    private const ORPHAN_MODEL_ID = 990100000000009902;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
        $this->createOfficialVideoProviderFixture('https://mapper.example.com', 'mapper-key');
    }

    protected function tearDown(): void
    {
        ProviderModelModel::query()->where('id', self::ORPHAN_MODEL_ID)->delete();
        ProviderConfigModel::query()->where('id', self::ORPHAN_CONFIG_ID)->delete();
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testGetOrganizationVideoModelCanResolveSeededProviderModel(): void
    {
        $provider = $this->getOfficialVideoProvider();
        $providerConfig = $this->getOfficialVideoProviderConfig((int) $provider->id);
        $providerModel = $this->getOfficialVideoProviderModel((int) $providerConfig->id, $this->officialFastVideoModelId());

        $mapper = di(ModelGatewayMapper::class);
        $entry = $mapper->getOrganizationVideoModel(
            ModelGatewayDataIsolation::create(self::TEST_ORGANIZATION_CODE, 'user-test'),
            $this->officialFastVideoModelId(),
        );

        $this->assertInstanceOf(ModelEntry::class, $entry);
        $model = $entry->getVideoModel();
        $this->assertNotNull($model);
        $this->assertSame($this->officialFastVideoModelVersion(), $model->getModelVersion());
        $this->assertSame((string) $providerModel->id, $model->getProviderModelId());
        $this->assertSame(ProviderCode::Wuyin, $model->getProviderCode());
    }

    public function testGetOrganizationVideoModelCanResolveSeededProProviderModel(): void
    {
        $provider = $this->getOfficialVideoProvider();
        $providerConfig = $this->getOfficialVideoProviderConfig((int) $provider->id);
        $providerModel = $this->getOfficialVideoProviderModel((int) $providerConfig->id, $this->officialProVideoModelId());

        $mapper = di(ModelGatewayMapper::class);
        $entry = $mapper->getOrganizationVideoModel(
            ModelGatewayDataIsolation::create(self::TEST_ORGANIZATION_CODE, 'user-test'),
            $this->officialProVideoModelId(),
        );

        $this->assertInstanceOf(ModelEntry::class, $entry);
        $model = $entry->getVideoModel();
        $this->assertNotNull($model);
        $this->assertSame($this->officialProVideoModelVersion(), $model->getModelVersion());
        $this->assertSame((string) $providerModel->id, $model->getProviderModelId());
        $this->assertSame(ProviderCode::Wuyin, $model->getProviderCode());
    }

    public function testGetOrganizationVideoModelReturnsNullForModelVersion(): void
    {
        // model_version 查询不再支持，应与 getOrganizationImageModel 保持一致，使用 model_id 查询
        $mapper = di(ModelGatewayMapper::class);
        $entry = $mapper->getOrganizationVideoModel(
            ModelGatewayDataIsolation::create(self::TEST_ORGANIZATION_CODE, 'user-test'),
            $this->officialFastVideoModelVersion(),
        );

        $this->assertNull($entry);
    }

    public function testGetVideoModelsReturnsSeededVideoModelsFromDatabase(): void
    {
        $mapper = di(ModelGatewayMapper::class);
        $models = $mapper->getVideoModels(ModelGatewayDataIsolation::create(self::TEST_ORGANIZATION_CODE, 'user-test'));

        $this->assertArrayHasKey($this->officialFastVideoModelId(), $models);
        $this->assertArrayHasKey($this->officialProVideoModelId(), $models);
    }

    public function testExistsReturnsFalseForUnknownVideoModel(): void
    {
        $mapper = di(ModelGatewayMapper::class);

        $this->assertFalse($mapper->exists(
            ModelGatewayDataIsolation::create(self::TEST_ORGANIZATION_CODE, 'user-test'),
            'video-model-not-seeded',
        ));
    }

    public function testExistsReturnsFalseForVideoModelVersion(): void
    {
        // model_version 查询不再支持，exists 只接受 model_id，与图片模型保持一致
        $mapper = di(ModelGatewayMapper::class);

        $this->assertFalse($mapper->exists(
            ModelGatewayDataIsolation::create(self::TEST_ORGANIZATION_CODE, 'user-test'),
            $this->officialFastVideoModelVersion(),
        ));
    }

    public function testGetOrganizationVideoModelSkipsOrphanedProviderRows(): void
    {
        ProviderConfigModel::query()->insert([
            'id' => self::ORPHAN_CONFIG_ID,
            'service_provider_id' => 990100000000009999,
            'organization_code' => $this->officialVideoFixtureOrganizationCode(),
            'provider_code' => ProviderCode::Wuyin->value,
            'config' => ProviderConfigAssembler::encodeConfig([
                'base_url' => 'https://orphan.example.com',
                'api_key' => 'orphan-key',
                '_seed_endpoint_key' => 'default',
            ], (string) self::ORPHAN_CONFIG_ID),
            'status' => 1,
            'alias' => 'Video Models',
            'translate' => json_encode(['alias' => ['zh_CN' => '视频模型', 'en_US' => 'Video Models']], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'sort' => 999999999,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
            'deleted_at' => null,
        ]);

        ProviderModelModel::query()->insert([
            'id' => self::ORPHAN_MODEL_ID,
            'service_provider_config_id' => self::ORPHAN_CONFIG_ID,
            'name' => 'Orphan Veo 3.1 Fast',
            'model_version' => 'orphan_veo_fast',
            'category' => 'vgm',
            'model_id' => $this->officialFastVideoModelId(),
            'model_type' => 5,
            'config' => '[]',
            'description' => 'orphan model',
            'sort' => 999999999,
            'icon' => 'MAGIC/713471849556451329/default/magic.png',
            'organization_code' => $this->officialVideoFixtureOrganizationCode(),
            'status' => 1,
            'disabled_by' => '',
            'translate' => '[]',
            'model_parent_id' => 0,
            'visible_organizations' => '[]',
            'visible_applications' => '[]',
            'visible_packages' => '[]',
            'load_balancing_weight' => 100,
            'is_office' => 1,
            'super_magic_display_state' => 0,
            'type' => 'ATOM',
            'aggregate_config' => null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
            'deleted_at' => null,
        ]);

        $mapper = di(ModelGatewayMapper::class);
        $entry = $mapper->getOrganizationVideoModel(
            ModelGatewayDataIsolation::create(self::TEST_ORGANIZATION_CODE, 'user-test'),
            $this->officialFastVideoModelId(),
        );

        $this->assertInstanceOf(ModelEntry::class, $entry);
        $model = $entry->getVideoModel();
        $this->assertNotNull($model);
        $this->assertSame($this->officialFastVideoModelVersion(), $model->getModelVersion());
    }

    protected function officialVideoFixtureOrganizationCode(): string
    {
        return self::TEST_FIXTURE_OFFICIAL_ORGANIZATION_CODE;
    }

    protected function officialVideoFixtureIds(): array
    {
        return [
            'provider_id' => self::TEST_FIXTURE_PROVIDER_ID,
            'provider_config_id' => self::TEST_FIXTURE_PROVIDER_CONFIG_ID,
            'fast_model_id' => self::TEST_FIXTURE_FAST_MODEL_PRIMARY_ID,
            'pro_model_id' => self::TEST_FIXTURE_PRO_MODEL_PRIMARY_ID,
            'fast_model_config_version_id' => self::TEST_FIXTURE_FAST_MODEL_CONFIG_VERSION_ID,
            'pro_model_config_version_id' => self::TEST_FIXTURE_PRO_MODEL_CONFIG_VERSION_ID,
        ];
    }
}
