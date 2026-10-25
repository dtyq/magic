<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Service;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Mode\Assembler\AdminModeAssembler;
use App\Application\Mode\Assembler\DefaultModelPricePreviewAssembler;
use App\Application\Mode\DTO\DefaultModelPricePreviewDTO;
use App\Application\Mode\DTO\ValueObject\ModelStatus;
use App\Application\Mode\Service\AdminModeAppService;
use App\Application\Mode\Service\DefaultModelPricePreviewGraphBuilder;
use App\Application\Mode\Service\DefaultModelPricePreviewService;
use App\Application\Mode\Service\ModeAppService;
use App\Application\Mode\Service\TextModelPriceSummaryResolver;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Kernel\Facade\ModelBillingPreviewApi;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/** 使用合成配置和模拟仓储验证快照，不启动应用或读取业务数据。
 * @internal
 */
class DefaultModelPricePreviewTest extends TestCase
{
    /** 空结果保持对象字典和稳定的批次标记。 */
    public function testEmptySnapshotContract(): void
    {
        $dto = new DefaultModelPricePreviewDTO();
        $data = $dto->toArray();
        self::assertNull($data['mode']);
        self::assertSame([], $data['groups']);
        self::assertSame('{}', json_encode($data['models']));
        self::assertSame($data['snapshot_id'], $dto->toArray()['snapshot_id']);
        self::assertSame(36, $data['calculation']['decimal_scale']);
    }

    /** 预览使用独立倍率查询权限，不再依赖平台信息权限。 */
    public function testPermissionContract(): void
    {
        $attribute = (new ReflectionMethod(ModelBillingPreviewApi::class, 'show'))->getAttributes(CheckPermission::class)[0]->newInstance();
        self::assertSame([MagicResourceEnum::PLATFORM_AI_MODEL_MULTIPLIER->value], $attribute->resource);
        self::assertSame(MagicOperationEnum::QUERY->value, $attribute->operation);
    }

    /** 没有默认模式时提前返回，不读取模型或服务商。 */
    public function testNoDefaultModeDoesNotReadGraph(): void
    {
        $models = $this->createMock(ProviderModelDomainService::class);
        $models->expects(self::never())->method('getModelsByModelIds');
        $providers = $this->createMock(ProviderConfigDomainService::class);
        $providers->expects(self::never())->method('getByIds');
        $modes = $this->admin(null, $models, $providers);
        $builder = $this->createMock(DefaultModelPricePreviewGraphBuilder::class);
        $builder->expects(self::never())->method('build');
        $assembler = $this->createMock(DefaultModelPricePreviewAssembler::class);
        $assembler->expects(self::never())->method('assemble');
        $service = new DefaultModelPricePreviewService($modes, $builder, $assembler, new FileDomainService($this->createMock(CloudFileRepositoryInterface::class)));
        self::assertNull($service->get($this->createMock(MagicUserAuthorization::class), 'zh_CN')->toArray()['mode']);
    }

    /** 新接口通过后台 App 读取一次默认配置，价格装配不再触发重复查询。 */
    public function testPreviewReusesAdminAppSnapshotOnce(): void
    {
        $root = $this->model('root', 1, ['models' => ['leaf']]);
        $leaf = $this->model('leaf', 2);
        $mode = $this->mode(['root']);
        $models = $this->createMock(ProviderModelDomainService::class);
        $models->expects(self::exactly(2))->method('getModelsByModelIds')->willReturnCallback(static function ($isolation, $ids) use ($root, $leaf) {
            return array_intersect_key(['root' => [$root], 'leaf' => [$leaf]], array_flip($ids));
        });
        $provider = new ProviderConfigEntity(['id' => 1, 'alias' => 'Mock Provider', 'status' => 1]);
        $providers = $this->createMock(ProviderConfigDomainService::class);
        $providers->expects(self::once())->method('getByIds')->willReturn([$provider]);
        $service = new DefaultModelPricePreviewService(
            $this->admin($mode, $models, $providers),
            new DefaultModelPricePreviewGraphBuilder(),
            new DefaultModelPricePreviewAssembler(new TextModelPriceSummaryResolver()),
            new FileDomainService($this->createMock(CloudFileRepositoryInterface::class))
        );
        $data = $service->get($this->createMock(MagicUserAuthorization::class), 'zh_CN')->toArray();
        self::assertSame('默认配置', $data['mode']['name']);
        self::assertSame('root', $data['groups'][0]['items'][0]['model_id']);
        $nodes = (array) $data['models'];
        self::assertSame('dynamic', $nodes['root']['kind']);
        self::assertSame('2', $nodes['leaf']['bindings'][0]['input']['effective_unit_price']);
        self::assertTrue($nodes['leaf']['bindings'][0]['eligible']);
    }

    /** 既有后台默认详情保持分组、动态配置、停用和缺失状态的原有返回协议。 */
    public function testExistingDefaultModeResponseRemainsCompatible(): void
    {
        $root = $this->model('root', 1, ['models' => ['leaf']]);
        $off = $this->model('off', 2);
        $off->setStatus(Status::Disabled);
        $leaf = $this->model('leaf', 3);
        $mode = $this->mode(['root', 'off', 'missing']);
        $models = $this->createMock(ProviderModelDomainService::class);
        $models->expects(self::exactly(2))->method('getModelsByModelIds')->willReturnCallback(static function ($isolation, $ids) use ($root, $off, $leaf) {
            return array_intersect_key(['root' => [$root], 'off' => [$off], 'leaf' => [$leaf]], array_flip($ids));
        });
        $providers = $this->createMock(ProviderConfigDomainService::class);
        $providers->expects(self::once())->method('getByIds')->willReturn([new ProviderConfigEntity(['id' => 1, 'status' => 1])]);
        $admin = $this->admin($mode, $models, $providers);
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('getLocale')->willReturn('zh_CN');
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->with(TranslatorInterface::class)->willReturn($translator);
        $previous = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        ApplicationContext::setContainer($container);
        try {
            $expected = AdminModeAssembler::aggregateToAdminDTO($mode, [
                'root' => ['best' => $root, 'all' => [$root], 'status' => ModelStatus::Normal],
                'off' => ['best' => null, 'all' => [$off], 'status' => ModelStatus::Disabled],
                'missing' => ['best' => null, 'all' => [], 'status' => ModelStatus::Deleted],
            ]);
            self::assertSame($expected->toArray(), $admin->getDefaultMode($this->createMock(MagicUserAuthorization::class))->toArray());
        } finally {
            (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $previous);
        }
    }

    /** 既有详情不启用价格预览上限，超过千个根项仍完整读取。 */
    public function testExistingSnapshotIsNotTruncated(): void
    {
        $ids = array_map(static fn ($i) => 'node-' . $i, range(0, 1001));
        $models = $this->createMock(ProviderModelDomainService::class);
        $models->expects(self::once())->method('getModelsByModelIds')->with(self::anything(), $ids)->willReturn([]);
        $providers = $this->createMock(ProviderConfigDomainService::class);
        $providers->expects(self::never())->method('getByIds');
        $snapshot = $this->admin($this->mode($ids), $models, $providers)->getDefaultModeModelSnapshot($this->createMock(MagicUserAuthorization::class));
        self::assertSame([], $snapshot['not_loaded']);
        self::assertCount(1002, $snapshot['details']);
    }

    /** 前台沿用共享快照的原三元组适配，动态候选停用规则不变。 */
    public function testExistingFrontendAvailabilityRemainsCompatible(): void
    {
        foreach ([Status::Enabled, Status::Disabled] as $status) {
            $root = $this->model('root', 1, ['models' => ['leaf']]);
            $leaf = $this->model('leaf', 2);
            $leaf->setStatus($status);
            $models = $this->createMock(ProviderModelDomainService::class);
            $models->expects(self::once())->method('getModelsByModelIds')->willReturn(['root' => [$root], 'leaf' => [$leaf]]);
            $providers = $this->createMock(ProviderConfigDomainService::class);
            $providers->expects(self::once())->method('getByIds')->willReturn([new ProviderConfigEntity(['id' => 1, 'status' => 1])]);
            $service = $this->getMockBuilder(ModeAppService::class)->disableOriginalConstructor()->onlyMethods(['createOfficialProviderDataIsolation'])->getMock();
            $service->method('createOfficialProviderDataIsolation')->willReturn($this->createMock(ProviderDataIsolation::class));
            (new ReflectionProperty($service, 'providerModelDomainService'))->setValue($service, $models);
            (new ReflectionProperty($service, 'providerConfigDomainService'))->setValue($service, $providers);
            $actual = (new ReflectionMethod($service, 'getModels'))->invoke($service, $this->mode(['root', 'leaf']));
            self::assertSame($status === Status::Enabled ? ['root' => $root, 'leaf' => $leaf] : [], $actual);
        }
    }

    /** 接口按授权和语言读取快照，返回低代码可封装的数组。 */
    public function testApiReturnsPriceSnapshot(): void
    {
        $authorization = $this->createMock(MagicUserAuthorization::class);
        $preview = $this->createMock(DefaultModelPricePreviewService::class);
        $preview->expects(self::once())->method('get')->with($authorization, 'zh_CN')->willReturn(new DefaultModelPricePreviewDTO());
        $api = $this->getMockBuilder(ModelBillingPreviewApi::class)->setConstructorArgs([$preview])->onlyMethods(['getAuthorization'])->getMock();
        $api->method('getAuthorization')->willReturn($authorization);
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('getLocale')->willReturn('zh_CN');
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->with(TranslatorInterface::class)->willReturn($translator);
        $previous = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        ApplicationContext::setContainer($container);
        try {
            self::assertSame('default_text_models', $api->show()['scope']);
        } finally {
            if ($previous !== null) {
                ApplicationContext::setContainer($previous);
            }
        }
    }

    /** 阶梯来源、缺项为零和成本白名单不改变既有平均算法。 */
    public function testPriceSummarySourcesAndPrecision(): void
    {
        $resolver = new TextModelPriceSummaryResolver();
        $summary = $resolver->resolve(new ModelConfigItem(['billing_currency' => 'USD', 'input_pricing' => '99', 'input_cost' => '98765', 'billing_tiers' => [[
            'billing_object' => 'input_token', 'follow_object' => 'input_token', 'pricing_mode' => 'tiered',
            'pricing_rules' => [['min' => 0, 'max' => 10, 'price' => 1], ['min' => 10, 'max' => null, 'price' => 4]],
        ]]]));
        self::assertTrue($summary['eligible']);
        self::assertSame('2.500000000000000000000000000000000000', $summary['input']['effective_unit_price']);
        self::assertSame(['1', '4'], $summary['input']['rule_prices']);
        self::assertSame('tiered', $summary['input']['source']);
        self::assertSame('missing_as_zero', $summary['output']['status']);
        self::assertSame('0', $summary['output']['effective_unit_price']);
        self::assertStringNotContainsString('98765', json_encode($summary));
        $small = $resolver->resolve(new ModelConfigItem(['billing_currency' => 'CNY', 'input_pricing' => '0.000000000001']));
        self::assertSame('0.000000000001', $small['input']['effective_unit_price']);
        self::assertSame('missing_config', $resolver->resolve(null)['exclusion_reason']);
        self::assertSame('unsupported_currency', $resolver->resolve(new ModelConfigItem())['exclusion_reason']);
    }

    /** 环、重复候选、缺失及非文本候选保留关系，不触发真实动态择一。 */
    public function testCandidateGraphIsBatchedAndFinite(): void
    {
        $root = $this->model('root', 1, ['models' => ['child', ['model_id' => 'child'], 'missing', 'image']]);
        $child = $this->model('child', 2, ['models' => ['root', 'leaf']]);
        $leaf = $this->model('leaf', 3);
        $image = $this->model('image', 4);
        $image->setCategory('vlm');
        $image->setModelType(1);
        $graph = $this->read(['root'], ['root' => [$root], 'child' => [$child], 'leaf' => [$leaf], 'image' => [$image]], 3);
        self::assertSame([0, 1, 2, 3], array_column($graph['nodes']['root']['children'], 'index'));
        self::assertSame('missing', $graph['nodes']['missing']['reason']);
        self::assertSame('unsupported_type', $graph['nodes']['image']['reason']);
        self::assertContains(['code' => 'cycle', 'model_id' => 'root'], $graph['warnings']);
        $data = $this->assemble($graph, ['root', 'leaf', 'image', 'root']);
        $models = (array) $data['models'];
        self::assertCount(3, $data['groups'][0]['items']);
        self::assertSame('dynamic', $models['root']['kind']);
        self::assertArrayNotHasKey('bindings', $models['root']);
        self::assertArrayNotHasKey('billing_multiplier', $models['root']);
        self::assertSame('available', $models['leaf']['state']);
    }

    /** 停用绑定保留售价，不能参与有效绑定分母，缺价正常按零。 */
    public function testBindingEligibilityAndWhitelist(): void
    {
        $active = $this->model('leaf', 1);
        $disabled = $this->model('leaf', 2);
        $disabled->setStatus(Status::Disabled);
        $otherProvider = $this->model('leaf', 3);
        $otherProvider->setServiceProviderConfigId(2);
        $bad = $this->model('bad', 4);
        $bad->setConfig(null);
        $off = $this->model('off', 5);
        $off->setStatus(Status::Disabled);
        $graph = $this->read(['leaf', 'bad', 'off'], ['leaf' => [$active, $disabled, $otherProvider], 'bad' => [$bad], 'off' => [$off]]);
        $data = $this->assemble($graph, ['leaf', 'bad', 'off']);
        $models = (array) $data['models'];
        self::assertSame([true, false, false], array_column($models['leaf']['bindings'], 'eligible'));
        self::assertSame([null, 'model_disabled', 'provider_disabled'], array_column($models['leaf']['bindings'], 'exclusion_reason'));
        self::assertSame('no_valid_price', $models['bad']['state']);
        self::assertSame('disabled', $models['off']['state']);
        self::assertSame('missing_as_zero', $models['leaf']['bindings'][0]['output']['status']);
        self::assertSame(['binding_id', 'provider_name', 'currency', 'eligible', 'exclusion_reason', 'input', 'output'], array_keys($models['leaf']['bindings'][0]));
        self::assertStringNotContainsString('private-placeholder', json_encode($data));
    }

    /** 不合并冲突配置，非法项明确告警，仍保留可用候选。 */
    public function testCanonicalAndInvalidConfiguration(): void
    {
        $first = $this->model('root', 1, ['models' => ['leaf', null]]);
        $second = $this->model('root', 2, ['models' => ['other']]);
        $graph = $this->read(['root'], ['root' => [$first, $second], 'leaf' => [$this->model('leaf', 3)]], 2);
        self::assertSame([['index' => 0, 'model_id' => 'leaf']], $graph['nodes']['root']['children']);
        self::assertTrue($graph['nodes']['root']['invalid_config']);
        self::assertArrayNotHasKey('other', $graph['nodes']);
        self::assertContains(['code' => 'inconsistent_bindings', 'model_id' => 'root'], $graph['warnings']);
    }

    /** 共享叶子不是环，停用的首个绑定不能覆盖启用绑定的规范结构。 */
    public function testSharedCandidateAndCanonicalAvailability(): void
    {
        $disabled = $this->model('root', 1, ['models' => ['unused']]);
        $disabled->setStatus(Status::Disabled);
        $active = $this->model('root', 2, ['models' => ['left', 'right']]);
        $graph = $this->read(['root'], [
            'root' => [$disabled, $active],
            'left' => [$this->model('left', 3, ['models' => ['leaf']])],
            'right' => [$this->model('right', 4, ['models' => ['leaf']])],
            'leaf' => [$this->model('leaf', 5)],
        ], 3);
        self::assertSame($active, $graph['nodes']['root']['model']);
        self::assertArrayNotHasKey('unused', $graph['nodes']);
        self::assertNotContains('cycle', array_column($graph['warnings'], 'code'));
    }

    /** 查询失败直接保留异常，不伪造成功空列表或零价。 */
    public function testQueryFailureIsNotConvertedToEmptySnapshot(): void
    {
        $models = $this->createMock(ProviderModelDomainService::class);
        $models->method('getModelsByModelIds')->willThrowException(new RuntimeException('Synthetic query failure'));
        $providers = $this->createMock(ProviderConfigDomainService::class);
        $providers->expects(self::never())->method('getByIds');
        $modes = $this->admin($this->mode(['mock-model']), $models, $providers);
        $service = new DefaultModelPricePreviewService($modes, new DefaultModelPricePreviewGraphBuilder(), new DefaultModelPricePreviewAssembler(new TextModelPriceSummaryResolver()), new FileDomainService($this->createMock(CloudFileRepositoryInterface::class)));
        $this->expectException(RuntimeException::class);
        $service->get($this->createMock(MagicUserAuthorization::class), 'zh_CN');
    }

    /** 超过三十二层停止查询，为关系终点保留截断占位。 */
    public function testDepthLimit(): void
    {
        $all = [];
        for ($i = 0; $i < 34; ++$i) {
            $all['node-' . $i] = [$this->model('node-' . $i, $i + 1, ['models' => ['node-' . ($i + 1)]])];
        }
        $graph = $this->read(['node-0'], $all, 32);
        self::assertSame('not_loaded', $graph['nodes']['node-32']['reason']);
        self::assertContains(['code' => 'depth_limit', 'model_id' => 'node-32'], $graph['warnings']);
    }

    /** 超过一千个不同标识只截断新增项，不静默返回零价。 */
    public function testModelLimit(): void
    {
        $ids = array_map(static fn ($i) => 'node-' . $i, range(0, 1001));
        $graph = $this->read($ids, []);
        self::assertSame('missing', $graph['nodes']['node-999']['reason']);
        self::assertSame('not_loaded', $graph['nodes']['node-1000']['reason']);
        self::assertContains(['code' => 'model_limit', 'model_id' => 'node-1000'], $graph['warnings']);
    }

    /** 纯图片根项不进入响应，空分组与语言回退保留。 */
    public function testNonTextRootAndEmptyGroup(): void
    {
        $image = $this->model('image', 1);
        $image->setCategory('vlm');
        $image->setModelType(1);
        $data = $this->assemble($this->read(['image'], ['image' => [$image]]), ['image']);
        self::assertSame([], $data['groups'][0]['items']);
        self::assertSame('{}', json_encode($data['models']));
        self::assertSame('测试分组', $data['groups'][0]['name']);
    }

    /** 预览保持默认详情原始分组和关系顺序，不按历史 sort 重新排序。 */
    public function testPreviewKeepsConfiguredArrayOrderAndIcons(): void
    {
        $first = $this->model('first', 1);
        $first->setIcon('mock/group/model.png');
        $second = $this->model('second', 2);
        $second->setIcon('https://example.com/mock-model.png');
        $group = new ModeGroupEntity(['id' => 2, 'name_i18n' => ['zh_CN' => '推荐'], 'sort' => 99, 'icon' => 'mock/group.png']);
        $last = new ModeGroupEntity(['id' => 1, 'name_i18n' => ['zh_CN' => '末组'], 'sort' => 0]);
        $relations = [new ModeGroupRelationEntity(['id' => 2, 'model_id' => 'second', 'sort' => 99]),
            new ModeGroupRelationEntity(['id' => 1, 'model_id' => 'first', 'sort' => 0])];
        $mode = new ModeAggregate(new ModeEntity(['id' => 1]), [new ModeGroupAggregate($group, $relations), new ModeGroupAggregate($last, [])]);
        $graph = $this->read(['first', 'second'], ['first' => [$first], 'second' => [$second]]);
        $icons = ['mock/group.png' => 'https://example.com/group.png', 'mock/group/model.png' => 'https://example.com/model.png'];
        $data = (new DefaultModelPricePreviewAssembler(new TextModelPriceSummaryResolver()))->assemble($mode, $graph, 'zh_CN', $icons)->toArray();
        self::assertSame(['2', '1'], array_column($data['groups'], 'id'));
        self::assertSame(['second', 'first'], array_column($data['groups'][0]['items'], 'model_id'));
        self::assertSame('https://example.com/group.png', $data['groups'][0]['icon']);
        $nodes = (array) $data['models'];
        self::assertSame('https://example.com/model.png', $nodes['first']['icon']);
        self::assertSame('https://example.com/mock-model.png', $nodes['second']['icon']);
    }

    /** 图标按路径去重后批量签发，已有 URL 和空图标不请求存储。 */
    public function testPreviewResolvesSharedIconsInOneBatch(): void
    {
        $repository = $this->createMock(CloudFileRepositoryInterface::class);
        $repository->expects(self::once())->method('getLinks')->with('mock', ['mock/shared.png'])
            ->willReturn(['mock/shared.png' => new FileLink('mock/shared.png', 'https://example.com/shared.png', 0)]);
        $service = new DefaultModelPricePreviewService(
            $this->createMock(AdminModeAppService::class),
            new DefaultModelPricePreviewGraphBuilder(),
            new DefaultModelPricePreviewAssembler(new TextModelPriceSummaryResolver()),
            new FileDomainService($repository)
        );
        $mode = $this->mode([]);
        $mode->getGroupAggregates()[0]->getGroup()->setIcon('mock/shared.png');
        $shared = $this->model('shared', 1);
        $shared->setIcon('mock/shared.png');
        $external = $this->model('external', 2);
        $external->setIcon('https://example.com/external.png');
        $icons = (new ReflectionMethod($service, 'loadIcons'))->invoke(
            $service,
            $mode,
            ['nodes' => [['model' => $shared], ['model' => $external], ['reason' => 'missing']]]
        );
        self::assertSame(['mock/shared.png' => 'https://example.com/shared.png'], $icons);
        self::assertSame('mock/shared.png', $shared->getIcon());
    }

    /** 模拟隔离对象和批量领域服务，校验每个模型仅查询一次。 */
    private function read(array $roots, array $all, int $calls = 1): array
    {
        $isolation = $this->createMock(ProviderDataIsolation::class);
        $models = $this->createMock(ProviderModelDomainService::class);
        $seen = [];
        $models->expects(self::exactly($calls))->method('getModelsByModelIds')->willReturnCallback(function ($actualIsolation, $ids) use ($isolation, $all, &$seen) {
            self::assertSame($isolation, $actualIsolation);
            foreach ($ids as $id) {
                self::assertArrayNotHasKey($id, $seen);
                $seen[$id] = true;
            }
            return array_intersect_key($all, array_flip($ids));
        });
        $provider = new ProviderConfigEntity();
        $provider->setId(1);
        $provider->setStatus(Status::Enabled);
        $provider->setAlias('Mock Provider');
        $providers = $this->createMock(ProviderConfigDomainService::class);
        $providers->expects($all === [] ? self::never() : self::once())->method('getByIds')->willReturnCallback(static fn ($isolation, $ids) => in_array(1, $ids, true) ? [$provider] : []);
        $modes = $this->admin($this->mode($roots), $models, $providers, $isolation);
        $snapshot = $modes->getDefaultModeModelSnapshot($this->createMock(MagicUserAuthorization::class), true);
        return (new DefaultModelPricePreviewGraphBuilder())->build($snapshot);
    }

    /** 构造无真实业务标识的模型，敏感占位用于验证不会序列化完整实体。 */
    private function model(string $id, int $binding, ?array $dynamic = null): ProviderModelEntity
    {
        return new ProviderModelEntity(['id' => $binding, 'model_id' => $id, 'name' => $id, 'category' => 'llm', 'model_type' => 3,
            'status' => 1, 'service_provider_config_id' => 1, 'type' => $dynamic === null ? 'ATOM' : 'DYNAMIC', 'aggregate_config' => $dynamic,
            'extra' => 'private-placeholder', 'config' => ['billing_currency' => 'CNY', 'input_pricing' => '2', 'input_cost' => 'private-placeholder']]);
    }

    /** 模拟授权和官方数据隔离，执行真实后台 App 的快照方法。 */
    private function admin(?ModeAggregate $mode, ProviderModelDomainService $models, ProviderConfigDomainService $providers, ?ProviderDataIsolation $isolation = null): AdminModeAppService
    {
        $modes = $this->createMock(ModeDomainService::class);
        $modes->expects(self::once())->method('getDefaultMode')->willReturn($mode);
        $service = $this->getMockBuilder(AdminModeAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['getModeDataIsolation', 'createOfficialProviderDataIsolation', 'processModeAggregateIcons'])->getMock();
        $service->method('getModeDataIsolation')->willReturn($this->createMock(ModeDataIsolation::class));
        $service->method('createOfficialProviderDataIsolation')->willReturn($isolation ?? $this->createMock(ProviderDataIsolation::class));
        foreach (['modeDomainService' => $modes, 'providerModelDomainService' => $models, 'providerConfigDomainService' => $providers] as $property => $value) {
            (new ReflectionProperty($service, $property))->setValue($service, $value);
        }
        return $service;
    }

    /** 使用最小合成模式和重复关系构造领域快照，不读取数据库。 */
    private function mode(array $ids): ModeAggregate
    {
        $mode = new ModeEntity(['id' => 1, 'name_i18n' => ['zh_CN' => '默认配置']]);
        $group = new ModeGroupEntity(['id' => 1, 'name_i18n' => ['zh_CN' => '测试分组']]);
        $relations = [];
        foreach ($ids as $index => $id) {
            $relations[] = new ModeGroupRelationEntity(['id' => $index + 1, 'model_id' => $id, 'sort' => $index]);
        }
        return new ModeAggregate($mode, [new ModeGroupAggregate($group, $relations)]);
    }

    /** 使用合成分组验证白名单装配，不执行新的价格查询。 */
    private function assemble(array $graph, array $ids): array
    {
        return (new DefaultModelPricePreviewAssembler(new TextModelPriceSummaryResolver()))->assemble(
            $this->mode($ids),
            $graph,
            'fr-FR'
        )->toArray();
    }
}
