<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\DTO\Item;

use App\Application\ModelGateway\Mapper\ModelAttributes;
use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Mapper\OdinModel;
use App\Application\ModelGateway\Service\AggregateModelResolverService;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Interfaces\Provider\Assembler\ProviderModelAssembler;
use DateTime;
use Hyperf\Context\ApplicationContext;
use Hyperf\Odin\Api\Request\ChatCompletionRequest;
use Hyperf\Odin\Api\Request\ReasoningEffort;
use Hyperf\Odin\Contract\Model\ModelInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/**
 * 模拟配置、版本和模型客户端，默认值验证不访问数据库或真实模型。
 * @internal
 */
class ReasoningEffortDefaultTest extends TestCase
{
    /** 历史配置跟随服务商；七档均可作为已开放模型的默认，JSON 字段顺序不影响结果。 */
    public function testDefaultsAndFieldOrder(): void
    {
        $this->assertNull((new ModelConfigItem(['support_deep_think' => true]))->getEffectiveReasoningEffortDefault());
        foreach (ReasoningEffort::values() as $level) {
            foreach ([
                ['reasoning_effort_default' => $level, 'reasoning_effort_levels' => [$level]],
                ['reasoning_effort_levels' => [$level], 'reasoning_effort_default' => $level],
            ] as $data) {
                $config = new ModelConfigItem(['support_deep_think' => true, ...$data]);
                $this->assertSame($level, $config->getEffectiveReasoningEffortDefault());
                $this->assertSame($level, $config->toArray()['reasoning_effort_default']);
            }
        }
    }

    /** 历史缺失或空值由后端补齐，嵌套 JSON 与数组接口一致，版本仍保存原始空值。 */
    public function testHistoricalConfigSerialization(): void
    {
        foreach ([[], ['reasoning_effort_levels' => null, 'reasoning_effort_default' => null]] as $legacy) {
            foreach ([true, false] as $enabled) {
                $model = new ProviderModelEntity();
                $model->setId(123);
                $model->setConfig(['support_deep_think' => $enabled, ...$legacy]);
                $config = $model->getConfig();
                $this->assertSame(['low', 'medium', 'high'], $config->toArray()['reasoning_effort_levels']);
                $this->assertNull($config->toArray()['reasoning_effort_default']);
                $this->assertSame($config->toArray(), $model->toArray()['config']);
                $this->assertSame($enabled ? ['low', 'medium', 'high'] : [], $config->getEffectiveReasoningEffortLevels());
                $version = ProviderModelAssembler::toConfigVersionEntity($model);
                $this->assertNull($version->getReasoningEffortLevels());
                $this->assertNull($version->getReasoningEffortDefault());
            }
        }
        $config = new ModelConfigItem(['support_deep_think' => true, 'reasoning_effort_levels' => []]);
        $this->assertSame([], $config->toArray()['reasoning_effort_levels']);
        $this->assertNull($config->toArray()['reasoning_effort_default']);
    }

    /** 关闭能力保留默认，重开恢复；移除默认档位与显式空数组都重置服务商默认。 */
    public function testDisabledAndRemovedDefaults(): void
    {
        $config = new ModelConfigItem(['support_deep_think' => true, 'reasoning_effort_default' => 'high']);
        $config->setSupportDeepThink(false);
        $this->assertSame('high', $config->getReasoningEffortDefault());
        $this->assertNull($config->getEffectiveReasoningEffortDefault());
        $config->setSupportDeepThink(true);
        $this->assertSame('high', $config->getEffectiveReasoningEffortDefault());
        $config->setReasoningEffortLevels(['low']);
        $this->assertNull($config->getReasoningEffortDefault());
        $this->assertNull((new ModelConfigItem(['reasoning_effort_default' => 'high', 'reasoning_effort_levels' => []]))->getReasoningEffortDefault());
        $config = new ModelConfigItem(['reasoning_effort_levels' => ['max'], 'reasoning_effort_default' => 'max']);
        $config->setReasoningEffortLevels(null);
        $this->assertNull($config->getReasoningEffortDefault());
    }

    /** 真实版本装配和恢复使用同一字段，历史空默认不被补成具体档位。 */
    public function testVersionRoundTrip(): void
    {
        foreach ([null, 'none', 'max'] as $level) {
            $model = new ProviderModelEntity();
            $model->setId(123);
            $model->setConfig(['support_deep_think' => true, 'reasoning_effort_levels' => ['none', 'max'], 'reasoning_effort_default' => $level]);
            $version = ProviderModelAssembler::toConfigVersionEntity($model);
            $this->assertSame($level, $version->getReasoningEffortDefault());
            $restored = new ModelConfigItem($version->toArray());
            $this->assertSame($level, $restored->getEffectiveReasoningEffortDefault());
        }
    }

    /** 用户选择原样优先，旧 thinking 也优先于后台默认，不在 DTO 新增请求校验。 */
    public function testExplicitChoicesAndLegacyThinkingWin(): void
    {
        $request = new CompletionDTO();
        $request->setModelReasoningEffortDefault('high');
        $this->assertSame('high', $request->getEffectiveReasoningEffort());
        foreach ([...ReasoningEffort::values(), 'mock-future-level', false, []] as $level) {
            $request->setReasoningEffort($level);
            $this->assertSame($level, $request->getEffectiveReasoningEffort());
        }
        $request->setReasoningEffort(null);
        $request->setThinking(['type' => 'disabled']);
        $this->assertNull($request->getEffectiveReasoningEffort());
    }

    /** 默认变更、请求重试和相邻请求分别持有自己的覆盖，不修改用户原始选择。 */
    public function testDefaultsDoNotStickAcrossRoutesOrRequests(): void
    {
        $first = new CompletionDTO();
        $second = new CompletionDTO();
        $first->setModelReasoningEffortDefault('high');
        $second->setModelReasoningEffortDefault('low');
        $first->setReasoningEffort('none');
        $first->setModelReasoningEffortDefault('max');
        $this->assertSame('none', $first->getEffectiveReasoningEffort());
        $this->assertSame('low', $second->getEffectiveReasoningEffort());
        $second->setModelReasoningEffortDefault(null);
        $this->assertNull($second->getEffectiveReasoningEffort());
        $this->assertNull($second->getReasoningEffort());
    }

    /** 动态入口保持逻辑标识，并继承解析后实际模型的默认值；依赖全部模拟。 */
    public function testDynamicModelInheritsResolvedDefault(): void
    {
        $previous = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $resolver = $this->createMock(AggregateModelResolverService::class);
        $resolver->method('resolveModel')->willReturn('mock-leaf');
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->with(AggregateModelResolverService::class)->willReturn($resolver);
        ApplicationContext::setContainer($container);
        try {
            $mapper = (new ReflectionClass(ModelGatewayMapper::class))->newInstanceWithoutConstructor();
            $dynamic = new ProviderModelEntity();
            $dynamic->setModelId('mock-auto');
            $dynamic->setModelType(1);
            $attributes = new ModelAttributes('mock-leaf', 'mock-leaf', 'Mock', '', [], new DateTime(), 'mock');
            $client = $this->createMock(ModelInterface::class);
            foreach ([null, 'max'] as $default) {
                $leaf = new ModelEntry($attributes, new OdinModel('mock-leaf', $client), reasoningEffortDefault: $default);
                $entry = (new ReflectionMethod(ModelGatewayMapper::class, 'createDynamicOdinModel'))->invoke(
                    $mapper,
                    $dynamic,
                    ['mock-leaf' => $leaf],
                    $this->createMock(ModelGatewayDataIsolation::class)
                );
                $this->assertSame('mock-auto', $entry->getKey());
                $this->assertSame($default, $entry->getReasoningEffortDefault());
                $this->assertSame('mock-leaf', $entry->getAttributes()->getResolvedModelId());
            }
        } finally {
            (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $previous);
        }
    }

    /** 使用真实网关构建过程捕获 Odin 请求，模拟客户端立即结束，不调用服务商。 */
    public function testGatewayBuildsOdinRequestWithEffectiveDefault(): void
    {
        $service = (new ReflectionClass(LLMAppService::class))->newInstanceWithoutConstructor();
        $call = new ReflectionMethod(LLMAppService::class, 'callWithOdinChat');
        foreach ([[null, null, 'high'], ['none', null, 'none'], [null, ['type' => 'disabled'], 'none']] as [$user, $thinking, $expected]) {
            $request = new CompletionDTO();
            $request->setModelReasoningEffortDefault('high');
            $request->setReasoningEffort($user);
            $request->setThinking($thinking);
            $client = $this->createMock(ModelInterface::class);
            $client->expects($this->once())->method('chatWithRequest')->willReturnCallback(function (ChatCompletionRequest $odinRequest) use ($expected): never {
                $this->assertSame($expected, $odinRequest->getReasoningEffort()?->value);
                throw new RuntimeException('mock-client-finished');
            });
            try {
                $call->invoke($service, $client, $request);
                $this->fail('The mock client must stop the request');
            } catch (RuntimeException $exception) {
                $this->assertSame('mock-client-finished', $exception->getMessage());
            }
        }
    }
}
