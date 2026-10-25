<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Service;

use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Application\Mode\Service\ModelReasoningCapabilityResolver;
use App\Application\ModelGateway\Service\AggregateModelResolverService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderModelType;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * 使用完整 mock 权限和预加载数据验证能力解析，不读取数据库。
 * @internal
 */
class ModelReasoningCapabilityResolverTest extends TestCase
{
    /** 普通模型、嵌套动态模型与权限降级共用真实解析逻辑，整个批次不回库。 */
    public function testResolvesCapabilitiesUsingAccessiblePreloadedLeaf(): void
    {
        $repository = $this->createMock(ProviderModelRepositoryInterface::class);
        $repository->expects($this->never())->method('getByModelId');
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());
        $resolver = new ModelReasoningCapabilityResolver(new AggregateModelResolverService($repository, $loggerFactory));
        $subscription = $this->createMock(SubscriptionManagerInterface::class);
        $subscription->method('isValidModelAvailable')->willReturn(true);
        $isolation = $this->createMock(ModelGatewayDataIsolation::class);
        $isolation->method('getSubscriptionManager')->willReturn($subscription);
        $leaf = $this->model('mock-leaf')->setConfig(['support_deep_think' => true, 'reasoning_effort_levels' => ['high', 'none'], 'reasoning_effort_default' => 'high']);
        $denied = $this->model('mock-denied');
        $child = $this->model('mock-child')->setType(ProviderModelType::DYNAMIC)->setAggregateConfig(['models' => ['mock-denied', 'mock-leaf']]);
        $root = $this->model('mock-auto')->setType(ProviderModelType::DYNAMIC)->setAggregateConfig(['models' => ['mock-child']]);
        $models = ['mock-auto' => $root, 'mock-child' => $child, 'mock-leaf' => $leaf, 'mock-denied' => $denied];
        $access = new ModelAccessContext(PermissionControlStatus::ENABLED, ['mock-denied'], ['mock-auto', 'mock-child', 'mock-leaf']);
        $result = $resolver->resolve(['mock-auto' => $root, 'mock-leaf' => $leaf], $models, $isolation, $access);
        $this->assertSame(['resolved_model_id' => 'mock-leaf', 'reasoning_effort_levels' => ['none', 'high'], 'reasoning_effort_default' => 'high'], $result['mock-auto']);
        $this->assertSame($result['mock-auto'], $result['mock-leaf']);
        $this->assertSame('mock-auto', $root->getModelId());
    }

    /** 无可用子模型时保持空能力，历史普通模型默认三档。 */
    public function testEmptyDynamicCapabilityAndLegacyDefaults(): void
    {
        $aggregate = $this->createMock(AggregateModelResolverService::class);
        $aggregate->method('resolveModel')->willReturn(null);
        $resolver = new ModelReasoningCapabilityResolver($aggregate);
        $dynamic = $this->model('mock-auto')->setType(ProviderModelType::DYNAMIC);
        $legacy = $this->model('mock-legacy')->setConfig(['support_deep_think' => true]);
        $result = $resolver->resolve(['mock-auto' => $dynamic, 'mock-legacy' => $legacy], [], $this->createMock(ModelGatewayDataIsolation::class), null);
        $this->assertSame(['resolved_model_id' => '', 'reasoning_effort_levels' => [], 'reasoning_effort_default' => null], $result['mock-auto']);
        $this->assertSame(['low', 'medium', 'high'], $result['mock-legacy']['reasoning_effort_levels']);
    }

    /** 历史空值、关闭能力和默认档移除均不向前台声明具体默认强度。 */
    public function testOnlyExposesEffectiveDefaults(): void
    {
        $resolver = new ModelReasoningCapabilityResolver($this->createMock(AggregateModelResolverService::class));
        foreach ([
            [true, ['low', 'high'], 'high', 'high'],
            [true, ['none', 'high'], 'none', 'none'],
            [true, ['low'], 'high', null],
            [false, ['high'], 'high', null],
            [true, [], 'high', null],
            [true, ['high'], null, null],
        ] as [$enabled, $levels, $default, $expected]) {
            $model = $this->model('mock-model')->setConfig([
                'support_deep_think' => $enabled,
                'reasoning_effort_levels' => $levels,
                'reasoning_effort_default' => $default,
            ]);
            $result = $resolver->resolve(['mock-model' => $model], [], $this->createMock(ModelGatewayDataIsolation::class), null);
            $capability = $result['mock-model'];
            $this->assertSame($expected, $capability['reasoning_effort_default']);
            $dto = new ModeGroupModelDTO();
            $dto->setReasoningCapability($capability['resolved_model_id'], $capability['reasoning_effort_levels'], $capability['reasoning_effort_default']);
            $this->assertSame($expected, $dto->toArray()['reasoning_effort_default']);
            $this->assertSame('mock-model', $dto->toArray()['resolved_model_id']);
        }
    }

    /** 构造无真实服务商、凭证及业务数据的模型夹具。 */
    private function model(string $id): ProviderModelEntity
    {
        return (new ProviderModelEntity())->setModelId($id)->setModelType(ModelType::LLM);
    }
}
