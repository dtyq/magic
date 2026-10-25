<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Mapper;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * 验证模型列表使用用户模型权限上下文进行可见性判断。
 *
 * @internal
 */
class ModelGatewayMapperAccessTest extends TestCase
{
    private mixed $originalOfficialOrganization;

    protected function setUp(): void
    {
        parent::setUp();
        $config = di(ConfigInterface::class);
        $this->originalOfficialOrganization = $config->get('service_provider.office_organization');
        $config->set('service_provider.office_organization', 'official-org');
    }

    protected function tearDown(): void
    {
        di(ConfigInterface::class)->set('service_provider.office_organization', $this->originalOfficialOrganization);
        parent::tearDown();
    }

    /**
     * 权限控制关闭时保持原有的全量模型可见行为。
     */
    public function testModelIsAccessibleWhenPermissionControlIsDisabled(): void
    {
        $context = new ModelAccessContext(PermissionControlStatus::DISABLED, ['model-a'], []);

        $this->assertTrue($this->invokeIsModelAccessible($context, 'model-a'));
    }

    /**
     * 权限控制开启时拒绝列表中的模型。
     */
    public function testModelIsNotAccessibleWhenPermissionControlDeniesIt(): void
    {
        $context = new ModelAccessContext(
            PermissionControlStatus::ENABLED,
            ['model-a'],
            ['model-b']
        );

        $this->assertFalse($this->invokeIsModelAccessible($context, 'model-a'));
        $this->assertTrue($this->invokeIsModelAccessible($context, 'model-b'));
    }

    /**
     * 未传权限上下文时兼容原有的内部模型加载调用方。
     */
    public function testModelIsAccessibleWithoutAccessContext(): void
    {
        $this->assertTrue($this->invokeIsModelAccessible(null, 'model-a'));
    }

    /**
     * 组织自己配置的 LLM 不应受官方模型套餐白名单限制。
     */
    public function testOrganizationOwnedModelBypassesSubscriptionModelAllowList(): void
    {
        $subscriptionManager = $this->createSubscriptionManager(['official-model']);
        $dataIsolation = $this->createDataIsolation('tenant-org', false, $subscriptionManager);
        $model = (new ProviderModelEntity())
            ->setOrganizationCode('tenant-org')
            ->setModelId('tenant-model')
            ->setModelType(ModelType::LLM);

        $this->assertTrue($this->invokeIsModelAvailableForSubscription($dataIsolation, $model));
    }

    /**
     * 官方组织提供的 LLM 仍需经过套餐白名单校验。
     */
    public function testOfficialModelStillRequiresSubscriptionModelAllowList(): void
    {
        $subscriptionManager = $this->createSubscriptionManager(['another-model']);
        $dataIsolation = $this->createDataIsolation('tenant-org', false, $subscriptionManager);
        $model = (new ProviderModelEntity())
            ->setOrganizationCode('official-org')
            ->setModelId('official-model')
            ->setModelType(ModelType::LLM);

        $this->assertFalse($this->invokeIsModelAvailableForSubscription($dataIsolation, $model));
    }

    /**
     * 官方组织本身保持原有套餐校验豁免行为。
     */
    public function testOfficialOrganizationKeepsSubscriptionCheckBypass(): void
    {
        $subscriptionManager = $this->createSubscriptionManager([]);
        $dataIsolation = $this->createDataIsolation('official-org', true, $subscriptionManager);
        $model = (new ProviderModelEntity())
            ->setOrganizationCode('official-org')
            ->setModelId('official-model')
            ->setModelType(ModelType::LLM);

        $this->assertTrue($this->invokeIsModelAvailableForSubscription($dataIsolation, $model));
    }

    /**
     * 其他组织的模型不应被当作当前组织自有模型放行。
     */
    public function testUnrelatedOrganizationModelDoesNotBypassSubscriptionModelAllowList(): void
    {
        $subscriptionManager = $this->createSubscriptionManager(['another-model']);
        $dataIsolation = $this->createDataIsolation('tenant-org', false, $subscriptionManager);
        $model = (new ProviderModelEntity())
            ->setOrganizationCode('another-tenant-org')
            ->setModelId('tenant-model')
            ->setModelType(ModelType::LLM);

        $this->assertFalse($this->invokeIsModelAvailableForSubscription($dataIsolation, $model));
    }

    /**
     * 未开启组织模型参数时，模型列表只查询官方组织，避免返回当前组织模型。
     */
    public function testModelListIsolationExcludesCurrentOrganizationByDefault(): void
    {
        $dataIsolation = ModelGatewayDataIsolation::create('tenant-org', 'user-test');
        $providerDataIsolation = $this->invokeCreateProviderDataIsolationForModelList($dataIsolation, false);

        $this->assertTrue($providerDataIsolation->isOnlyOfficialOrganization());
        $this->assertFalse($providerDataIsolation->isContainOfficialOrganization());
    }

    /**
     * 开启组织模型参数时，模型列表同时查询当前组织和官方组织。
     */
    public function testModelListIsolationIncludesCurrentAndOfficialOrganizationsWhenRequested(): void
    {
        $dataIsolation = ModelGatewayDataIsolation::create('tenant-org', 'user-test');
        $providerDataIsolation = $this->invokeCreateProviderDataIsolationForModelList($dataIsolation, true);

        $this->assertFalse($providerDataIsolation->isOnlyOfficialOrganization());
        $this->assertTrue($providerDataIsolation->isContainOfficialOrganization());
    }

    /**
     * 内部调用未传组织模型参数时，保持历史的当前组织 + 官方组织查询范围。
     */
    public function testModelListIsolationPreservesLegacyScopeWhenOptionIsOmitted(): void
    {
        $dataIsolation = ModelGatewayDataIsolation::create('tenant-org', 'user-test');
        $providerDataIsolation = $this->invokeCreateProviderDataIsolationForModelList($dataIsolation, null);

        $this->assertFalse($providerDataIsolation->isOnlyOfficialOrganization());
        $this->assertTrue($providerDataIsolation->isContainOfficialOrganization());
    }

    /**
     * 有限订阅模型列表追加组织模型时，不能把原有 model_id 变成数组索引。
     */
    public function testOrganizationModelMergePreservesFiniteSubscriptionModelIds(): void
    {
        $mapper = (new ReflectionClass(ModelGatewayMapper::class))->newInstanceWithoutConstructor();
        $method = new ReflectionClass(ModelGatewayMapper::class)->getMethod('mergeOrganizationModelIds');
        $method->setAccessible(true);

        $modelIds = $method->invoke(
            $mapper,
            ['official-model-a', 'official-model-b'],
            [ModelType::LLM->value => ['organization-model']],
            [ModelType::LLM],
        );

        $this->assertSame(['official-model-a', 'official-model-b', 'organization-model'], $modelIds);
    }

    /**
     * 通过反射调用 mapper 内部的模型可见性策略，避免初始化外部服务依赖。
     */
    private function invokeIsModelAccessible(?ModelAccessContext $context, string $modelId): bool
    {
        $mapper = (new ReflectionClass(ModelGatewayMapper::class))->newInstanceWithoutConstructor();
        $method = new ReflectionClass(ModelGatewayMapper::class)->getMethod('isModelAccessible');
        $method->setAccessible(true);

        return $method->invoke($mapper, $context, $modelId);
    }

    private function invokeIsModelAvailableForSubscription(
        ModelGatewayDataIsolation $dataIsolation,
        ProviderModelEntity $model
    ): bool {
        $mapper = (new ReflectionClass(ModelGatewayMapper::class))->newInstanceWithoutConstructor();
        $method = new ReflectionClass(ModelGatewayMapper::class)->getMethod('isModelAvailableForSubscription');
        $method->setAccessible(true);

        return $method->invoke($mapper, $dataIsolation, $model, ModelType::LLM);
    }

    private function invokeCreateProviderDataIsolationForModelList(
        ModelGatewayDataIsolation $dataIsolation,
        ?bool $withOrganizationModels
    ): ProviderDataIsolation {
        $mapper = (new ReflectionClass(ModelGatewayMapper::class))->newInstanceWithoutConstructor();
        $method = new ReflectionClass(ModelGatewayMapper::class)->getMethod('createProviderDataIsolationForModelList');
        $method->setAccessible(true);

        return $method->invoke($mapper, $dataIsolation, $withOrganizationModels);
    }

    /**
     * @param list<string> $availableModelIds
     */
    private function createSubscriptionManager(array $availableModelIds): BaseSubscriptionManager
    {
        return new class($availableModelIds) extends BaseSubscriptionManager {
            /** @param list<string> $availableModelIds */
            public function __construct(private array $availableModelIds)
            {
            }

            public function getAvailableModelIds(?ModelType $modelType): array
            {
                return $this->availableModelIds;
            }
        };
    }

    private function createDataIsolation(
        string $organizationCode,
        bool $isOfficialOrganization,
        SubscriptionManagerInterface $subscriptionManager
    ): ModelGatewayDataIsolation {
        return new class($organizationCode, $isOfficialOrganization, $subscriptionManager) extends ModelGatewayDataIsolation {
            public function __construct(
                private string $organizationCode,
                private bool $isOfficial,
                private SubscriptionManagerInterface $subscriptionManager
            ) {
            }

            public function getCurrentOrganizationCode(): string
            {
                return $this->organizationCode;
            }

            public function isOfficialOrganization(): bool
            {
                return $this->isOfficial;
            }

            public function getSubscriptionManager(): SubscriptionManagerInterface
            {
                return $this->subscriptionManager;
            }
        };
    }
}
