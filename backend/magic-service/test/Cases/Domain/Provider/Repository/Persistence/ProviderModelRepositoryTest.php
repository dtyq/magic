<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Persistence\ProviderModelRepository;
use App\Interfaces\Provider\Assembler\ProviderConfigAssembler;
use Hyperf\DbConnection\Db;
use HyperfTest\Support\UsesDatabaseIsolation;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderModelRepositoryTest extends TestCase
{
    use UsesDatabaseIsolation;

    private string $organizationCode = '';

    private int $baseId = 0;

    private int $sequence = 0;

    /**
     * @var list<int>
     */
    private array $providerIds = [];

    /**
     * @var list<int>
     */
    private array $providerConfigIds = [];

    /**
     * @var list<int>
     */
    private array $providerModelIds = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->beginDatabaseIsolation();
        $this->organizationCode = 'provider_repo_' . str_replace('.', '', uniqid('', true));
        $this->baseId = (int) (microtime(true) * 1000000);
        $this->sequence = 0;
        $this->providerIds = [];
        $this->providerConfigIds = [];
        $this->providerModelIds = [];
    }

    protected function tearDown(): void
    {
        if ($this->providerModelIds !== []) {
            Db::table('service_provider_models')->whereIn('id', $this->providerModelIds)->delete();
        }
        if ($this->providerConfigIds !== []) {
            Db::table('service_provider_configs')->whereIn('id', $this->providerConfigIds)->delete();
        }
        if ($this->providerIds !== []) {
            Db::table('service_provider')->whereIn('id', $this->providerIds)->delete();
        }

        $this->endDatabaseIsolation();

        parent::tearDown();
    }

    #[DataProvider('providerStateProvider')]
    public function testGetAvailableByModelIdOrIdIgnoresServiceProviderStateAndPresence(
        bool $createProvider,
        bool $providerEnabled
    ): void {
        $providerId = $this->nextId();
        if ($createProvider) {
            $this->insertProvider($providerId, $providerEnabled ? Status::Enabled : Status::Disabled);
        }

        $configId = $this->insertProviderConfig($providerId, Status::Enabled, 10);
        $modelId = $this->insertProviderModel($configId, 'repo-provider-ignored', Status::Enabled, 20);

        $entity = $this->repository()->getAvailableByModelIdOrId(
            $this->providerDataIsolation(),
            'repo-provider-ignored'
        );

        $this->assertNotNull($entity);
        $this->assertSame($modelId, $entity->getId());
        $this->assertSame('repo-provider-ignored', $entity->getModelId());
    }

    public static function providerStateProvider(): array
    {
        return [
            'provider disabled' => [true, false],
            'provider missing' => [false, false],
        ];
    }

    public function testGetAvailableByModelIdOrIdReturnsNullWhenModelDisabledAndCheckStatusEnabled(): void
    {
        $providerId = $this->insertProvider($this->nextId(), Status::Enabled);
        $configId = $this->insertProviderConfig($providerId, Status::Enabled, 10);
        $this->insertProviderModel($configId, 'repo-model-disabled', Status::Disabled, 20);

        $entity = $this->repository()->getAvailableByModelIdOrId(
            $this->providerDataIsolation(),
            'repo-model-disabled',
            true
        );

        $this->assertNull($entity);
    }

    public function testGetAvailableByModelIdOrIdReturnsNullWhenConfigDisabledAndCheckStatusEnabled(): void
    {
        $providerId = $this->insertProvider($this->nextId(), Status::Enabled);
        $configId = $this->insertProviderConfig($providerId, Status::Disabled, 10);
        $this->insertProviderModel($configId, 'repo-config-disabled', Status::Enabled, 20);

        $entity = $this->repository()->getAvailableByModelIdOrId(
            $this->providerDataIsolation(),
            'repo-config-disabled',
            true
        );

        $this->assertNull($entity);
    }

    public function testGetAvailableByModelIdOrIdIgnoresModelAndConfigStatusWhenCheckStatusDisabled(): void
    {
        $providerId = $this->insertProvider($this->nextId(), Status::Disabled);
        $configId = $this->insertProviderConfig($providerId, Status::Disabled, 10);
        $modelId = $this->insertProviderModel($configId, 'repo-ignore-status', Status::Disabled, 20);

        $entity = $this->repository()->getAvailableByModelIdOrId(
            $this->providerDataIsolation(),
            'repo-ignore-status',
            false
        );

        $this->assertNotNull($entity);
        $this->assertSame($modelId, $entity->getId());
        $this->assertSame(Status::Disabled, $entity->getStatus());
    }

    public function testGetAvailableByModelIdOrIdUsesSortRulesForModelIdLookup(): void
    {
        $providerId = $this->insertProvider($this->nextId(), Status::Enabled);
        $lowSortConfigId = $this->insertProviderConfig($providerId, Status::Enabled, 10);
        $highSortConfigId = $this->insertProviderConfig($providerId, Status::Enabled, 30);

        $this->insertProviderModel($lowSortConfigId, 'repo-sorted-model', Status::Enabled, 100);
        $selectedModelId = $this->insertProviderModel($highSortConfigId, 'repo-sorted-model', Status::Enabled, 100);

        $entity = $this->repository()->getAvailableByModelIdOrId(
            $this->providerDataIsolation(),
            'repo-sorted-model'
        );

        $this->assertNotNull($entity);
        $this->assertSame($selectedModelId, $entity->getId());
        $this->assertSame($highSortConfigId, $entity->getServiceProviderConfigId());
    }

    public function testGetAvailableByModelIdOrIdMatchesNumericInputByPrimaryKey(): void
    {
        $providerId = $this->insertProvider($this->nextId(), Status::Enabled);
        $configId = $this->insertProviderConfig($providerId, Status::Enabled, 10);
        $targetModelId = $this->insertProviderModel($configId, '100200300', Status::Enabled, 20);
        $this->insertProviderModel($configId, 'numeric-model-id', Status::Enabled, 5);

        $entity = $this->repository()->getAvailableByModelIdOrId(
            $this->providerDataIsolation(),
            (string) $targetModelId
        );

        $this->assertNotNull($entity);
        $this->assertSame($targetModelId, $entity->getId());
        $this->assertSame('100200300', $entity->getModelId());
    }

    private function repository(): ProviderModelRepository
    {
        return di(ProviderModelRepository::class);
    }

    private function providerDataIsolation(): ProviderDataIsolation
    {
        return ProviderDataIsolation::create(currentOrganizationCode: $this->organizationCode);
    }

    private function insertProvider(int $id, Status $status): int
    {
        $this->providerIds[] = $id;
        $now = date('Y-m-d H:i:s');

        Db::table('service_provider')->insert([
            'id' => $id,
            'name' => 'Provider ' . $id,
            'provider_code' => 'OPENAI',
            'description' => 'repository test provider',
            'icon' => '',
            'provider_type' => 0,
            'category' => 'llm',
            'status' => $status->value,
            'is_models_enable' => 1,
            'translate' => json_encode([], JSON_THROW_ON_ERROR),
            'remark' => '',
            'sort_order' => 0,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
        ]);

        return $id;
    }

    private function insertProviderConfig(int $providerId, Status $status, int $sort): int
    {
        $id = $this->nextId();
        $this->providerConfigIds[] = $id;
        $now = date('Y-m-d H:i:s');

        Db::table('service_provider_configs')->insert([
            'id' => $id,
            'service_provider_id' => $providerId,
            'organization_code' => $this->organizationCode,
            'provider_code' => 'OPENAI',
            'config' => ProviderConfigAssembler::encodeConfig(['api_key' => 'test'], (string) $id),
            'status' => $status->value,
            'alias' => '',
            'translate' => json_encode([], JSON_THROW_ON_ERROR),
            'sort' => $sort,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
        ]);

        return $id;
    }

    private function insertProviderModel(int $configId, string $modelId, Status $status, int $sort): int
    {
        $id = $this->nextId();
        $this->providerModelIds[] = $id;
        $now = date('Y-m-d H:i:s');

        Db::table('service_provider_models')->insert([
            'id' => $id,
            'service_provider_config_id' => $configId,
            'name' => 'Model ' . $id,
            'model_version' => 'version-' . $id,
            'category' => 'llm',
            'model_id' => $modelId,
            'model_type' => ModelType::LLM->value,
            'config' => json_encode(['temperature' => 0.6], JSON_THROW_ON_ERROR),
            'description' => 'repository test model',
            'sort' => $sort,
            'icon' => '',
            'organization_code' => $this->organizationCode,
            'status' => $status->value,
            'disabled_by' => '',
            'translate' => json_encode([], JSON_THROW_ON_ERROR),
            'model_parent_id' => 0,
            'visible_organizations' => json_encode([], JSON_THROW_ON_ERROR),
            'visible_applications' => json_encode([], JSON_THROW_ON_ERROR),
            'visible_packages' => null,
            'load_balancing_weight' => null,
            'is_office' => 0,
            'super_magic_display_state' => 0,
            'type' => 'ATOM',
            'aggregate_config' => null,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
        ]);

        return $id;
    }

    private function nextId(): int
    {
        return $this->baseId + (++$this->sequence);
    }
}
