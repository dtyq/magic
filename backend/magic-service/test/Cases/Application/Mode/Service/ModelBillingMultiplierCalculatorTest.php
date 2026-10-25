<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Service;

use App\Application\Kernel\DTO\ModelBillingMultiplierSettings;
use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Application\Mode\Service\ModeAppService;
use App\Application\Mode\Service\ModelBillingMultiplierCalculator;
use App\Domain\Contact\Repository\Facade\MagicUserSettingRepositoryInterface;
use App\Domain\Kernel\Service\PlatformSettingsDomainService;
use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\DTO\Item\TokenPricing\BillingTierItem;
use App\Domain\Provider\DTO\Item\TokenPricing\BillingTierMode;
use App\Domain\Provider\DTO\Item\TokenPricing\BillingTierPriceRule;
use App\Domain\Provider\DTO\Item\TokenPricing\BillingTiers;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Kernel\Facade\PlatformSettingsApi;
use Hyperf\Context\ApplicationContext;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;

/**
 * 全部使用内存模型快照，不请求数据库、缓存或真实服务商。
 * @internal
 */
class ModelBillingMultiplierCalculatorTest extends TestCase
{
    /** 阶梯与服务商各自等权平均，成本、缓存和负载权重不参与计算。 */
    public function testAveragesTiersAndProvidersWithCurrencyConversion(): void
    {
        $tiers = [];
        foreach (['input_token' => [1, 2, 9], 'output_token' => [10, 30]] as $object => $prices) {
            $rules = [];
            foreach ($prices as $index => $price) {
                $rules[] = ['min' => $index * 100, 'max' => $index === count($prices) - 1 ? null : ($index + 1) * 100, 'price' => $price];
            }
            $tiers[] = ['billing_object' => $object, 'follow_object' => 'input_token', 'pricing_mode' => 'tiered', 'pricing_rules' => $rules];
        }
        $first = $this->model(['billing_tiers' => $tiers, 'input_pricing' => '999', 'output_pricing' => '999', 'input_cost' => '888']);
        $first->setLoadBalancingWeight(100);
        $second = $this->model(['billing_currency' => 'USD', 'input_pricing' => '1', 'output_pricing' => '10']);
        $second->setLoadBalancingWeight(1);
        // 首个服务商 0.06 元，第二个 0.02 美元 * 7 = 0.14 元，平均 0.1 元。
        $result = $this->calculate([$first, $second]);
        $this->assertEqualsWithDelta(1.0, $result['mock-model'], 0.00000001);
    }

    /** 缺失单项按零计价，保留另一项费用；零费用绑定同样参与平均。 */
    public function testMissingAndZeroPrices(): void
    {
        $priced = $this->model(['input_pricing' => '2', 'output_pricing' => '8']);
        $missingOutput = $this->model(['input_pricing' => '2']);
        $missingInput = $this->model(['output_pricing' => '3']);
        $missingBoth = $this->model([]);
        $zero = $this->model(['input_pricing' => '0', 'output_pricing' => '0']);
        $this->assertEqualsWithDelta(0.2, $this->calculate([$missingOutput])['mock-model'], 0.00000001);
        $this->assertEqualsWithDelta(0.03, $this->calculate([$missingInput])['mock-model'], 0.00000001);
        $this->assertEqualsWithDelta(0.24, $this->calculate([$priced, $missingOutput])['mock-model'], 0.00000001);
        $this->assertEqualsWithDelta(0.14, $this->calculate([$priced, $zero])['mock-model'], 0.00000001);
        $this->assertEqualsWithDelta(0.14, $this->calculate([$priced, $missingBoth])['mock-model'], 0.00000001);
        $this->assertSame(0.0, $this->calculate([$missingBoth])['mock-model']);
        $this->assertSame(0.0, $this->calculate([])['mock-model']);
    }

    /** 缺失阶梯项按零计价，不使用旧价补齐；非法绑定继续跳过。 */
    public function testIncompletePricingIsNotFilledFromLegacyFields(): void
    {
        $partial = $this->model(['input_pricing' => '10', 'output_pricing' => '10', 'billing_tiers' => [
            ['billing_object' => 'input_token', 'follow_object' => 'input_token', 'pricing_mode' => 'fixed', 'pricing_rules' => [['price' => 5]]],
        ]]);
        $nonText = $this->model(['billing_type' => 'Times', 'input_pricing' => '10', 'output_pricing' => '10']);
        $unknownCurrency = $this->model(['billing_currency' => null, 'input_pricing' => '10', 'output_pricing' => '10']);
        $this->assertEqualsWithDelta(0.5, $this->calculate([$partial, $nonText, $unknownCurrency])['mock-model'], 0.00000001);
        $outputOnly = $this->model(['billing_currency' => 'USD', 'billing_tiers' => [
            ['billing_object' => 'output_token', 'follow_object' => 'input_token', 'pricing_mode' => 'fixed', 'pricing_rules' => [['price' => 3]]],
        ]]);
        $this->assertEqualsWithDelta(0.21, $this->calculate([$outputOnly])['mock-model'], 0.00000001);
        $this->assertSame(0.0, $this->calculate([$this->model(['billing_tiers' => []])])['mock-model']);
    }

    /** 使用模拟历史阶梯验证空规则和非法价格仍被剔除，不作为零价拉低均值。 */
    public function testInvalidExistingTierIsNotTreatedAsMissing(): void
    {
        $invalidRule = $this->createMock(BillingTierPriceRule::class);
        $invalidRule->method('getPrice')->willReturn(-1.0);
        foreach ([[], [$invalidRule]] as $rules) {
            $tier = $this->createMock(BillingTierItem::class);
            $tier->method('getPricingRules')->willReturn($rules);
            $tier->method('getPricingMode')->willReturn(BillingTierMode::Fixed);
            $tiers = $this->createMock(BillingTiers::class);
            $tiers->method('getBillingTier')->willReturn($tier);
            $config = $this->model([])->getConfig();
            $this->assertInstanceOf(ModelConfigItem::class, $config);
            $config->setBillingTiers($tiers);
            $invalid = $this->createMock(ProviderModelEntity::class);
            $invalid->method('getConfig')->willReturn($config);
            $invalid->method('isDynamicModel')->willReturn(false);
            $priced = $this->model(['input_pricing' => '2', 'output_pricing' => '8']);
            $this->assertEqualsWithDelta(0.28, $this->calculate([$priced, $invalid])['mock-model'], 0.00000001);
        }
    }

    /** 小额历史价格及阶梯对象的科学计数法不应破坏整个模型列表。 */
    public function testSmallPricesRemainPositive(): void
    {
        $model = $this->model(['billing_tiers' => array_map(static fn ($object) => [
            'billing_object' => $object, 'follow_object' => 'input_token', 'pricing_mode' => 'fixed',
            'pricing_rules' => [['price' => 0.0000001]],
        ], ['input_token', 'output_token'])]);
        $this->assertGreaterThan(0, $this->calculate([$model])['mock-model']);
    }

    /** 使用已有能力解析结果，逻辑标识保持不变；关闭时返回空值。 */
    public function testUsesResolvedModelWithoutResolvingAgain(): void
    {
        $calculator = new ModelBillingMultiplierCalculator();
        $capabilities = ['mock-auto' => ['resolved_model_id' => 'mock-leaf'], 'mock-leaf' => ['resolved_model_id' => 'mock-leaf']];
        $groups = ['mock-leaf' => [$this->model(['input_pricing' => '2', 'output_pricing' => '8'])]];
        $enabled = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '10', 'output_price' => '0', 'usd_to_cny_rate' => '7']);
        $result = $calculator->calculate($capabilities, $groups, $enabled);
        $this->assertSame($result['mock-leaf'], $result['mock-auto']);
        $this->assertSame(['mock-auto' => null, 'mock-leaf' => null], $calculator->calculate($capabilities, $groups, ModelBillingMultiplierSettings::fromArray([])));
        $dto = new ModeGroupModelDTO();
        $dto->setBillingMultiplier($result['mock-auto']);
        $this->assertSame($result['mock-auto'], $dto->toArray()['billing_multiplier']);
    }

    /** 相同底层模型的逻辑入口独立覆盖，缺价不影响手动值，关闭总开关仍隐藏。 */
    public function testManualOverridesAreScopedToLogicalModels(): void
    {
        $calculator = new ModelBillingMultiplierCalculator();
        $capabilities = [
            'mock-auto' => ['resolved_model_id' => 'mock-leaf'],
            'mock-max' => ['resolved_model_id' => 'mock-leaf'],
            'mock-leaf' => ['resolved_model_id' => 'mock-leaf'],
        ];
        $settings = ModelBillingMultiplierSettings::fromArray([
            'enabled' => true, 'input_price' => '10', 'output_price' => '0',
            'model_overrides' => [
                ['model_id' => 'mock-auto', 'multiplier' => '0.5'],
                ['model_id' => 'mock-max', 'multiplier' => '1'],
            ],
        ]);
        $groups = ['mock-leaf' => [$this->model(['input_pricing' => '2', 'output_pricing' => '8'])]];
        $this->assertSame(['mock-auto' => 0.5, 'mock-max' => 1.0, 'mock-leaf' => 0.28], $calculator->calculate($capabilities, $groups, $settings));
        $this->assertSame(['mock-auto' => 0.5, 'mock-max' => 1.0, 'mock-leaf' => 0.0], $calculator->calculate($capabilities, [], $settings));
        $this->assertSame(['mock-auto' => null, 'mock-max' => null, 'mock-leaf' => null], $calculator->calculate($capabilities, $groups, $settings->withOverrides(['enabled' => false])));
        $cleared = $calculator->calculate($capabilities, $groups, $settings->withOverrides(['model_overrides' => []]));
        $this->assertSame($cleared['mock-auto'], $cleared['mock-leaf']);
    }

    /** 复用列表状态筛选后保留全部启用绑定，排除禁用模型及服务商。 */
    public function testAvailableGroupsKeepAllEnabledBindings(): void
    {
        $active = $this->model([]);
        $active->setStatus(Status::Enabled);
        $active->setServiceProviderConfigId(1);
        $disabledProvider = clone $active;
        $disabledProvider->setServiceProviderConfigId(2);
        $disabledModel = clone $active;
        $disabledModel->setStatus(Status::Disabled);
        $service = (new ReflectionClass(ModeAppService::class))->newInstanceWithoutConstructor();
        $result = (new ReflectionMethod($service, 'filterAvailableModelGroups'))->invoke(
            $service,
            ['mock-model' => [$active, clone $active, $disabledProvider, $disabledModel]],
            [1 => Status::Enabled, 2 => Status::Disabled]
        );
        $this->assertCount(2, $result['mock-model']);
    }

    /** 配置往返不丢金额精度，历史关闭且保留已填内容。 */
    public function testSettingsRoundTripAndDefaults(): void
    {
        $this->assertSame(['enabled' => false, 'base_price_cny' => null, 'usd_to_cny_rate' => '7', 'currency' => 'CNY', 'input_price' => null, 'output_price' => null, 'model_overrides' => []], (new PlatformSettings())->toArray()['model_billing_multiplier']);
        foreach ([[], ['usd_to_cny_rate' => null], ['usd_to_cny_rate' => '']] as $unconfigured) {
            $this->assertSame('7', ModelBillingMultiplierSettings::fromArray($unconfigured)->toArray()['usd_to_cny_rate']);
        }
        $data = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'currency' => 'CNY', 'input_price' => '0.0123456789', 'output_price' => '0', 'usd_to_cny_rate' => '7.123456789012'])->toArray();
        $this->assertSame('0.000123456789', $data['base_price_cny']);
        $this->assertSame($data, PlatformSettings::fromArray(['model_billing_multiplier' => $data])->toArray()['model_billing_multiplier']);
        foreach ([null, '', '0', '-1', 'NaN', '1e3', [], '0.0000000000000000000000000001'] as $invalid) {
            try {
                ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'base_price_cny' => $invalid, 'usd_to_cny_rate' => '7']);
                $this->fail('Invalid configuration must not enable the multiplier');
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    /** 全局配置保存使平台和公共缓存失效，后续读取新值；所有存储均为模拟。 */
    public function testSettingsCacheAndAdminResponse(): void
    {
        $previous = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $cache = [];
        $entity = null;
        $deleted = [];
        $redis = $this->createMock(Redis::class);
        $redis->method('__call')->willReturnCallback(static function ($name, $args) use (&$cache, &$deleted) {
            if ($name === 'get') {
                return $cache[$args[0]] ?? false;
            }
            if ($name === 'setex') {
                $cache[$args[0]] = $args[2];
                return true;
            }
            if ($name === 'del') {
                $deleted[] = $args[0];
                unset($cache[$args[0]]);
                return 1;
            }
            throw new InvalidArgumentException('Unexpected Redis command');
        });
        $repository = $this->createMock(MagicUserSettingRepositoryInterface::class);
        $repository->method('getGlobal')->willReturnCallback(static function () use (&$entity) { return $entity; });
        $repository->method('saveGlobal')->willReturnCallback(static function ($saved) use (&$entity) { return $entity = $saved; });
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->with(Redis::class)->willReturn($redis);
        ApplicationContext::setContainer($container);
        try {
            $locker = $this->createMock(LockerInterface::class);
            $locker->method('spinLock')->willReturn(true);
            $locker->method('release')->willReturn(true);
            $service = new PlatformSettingsDomainService($repository, $redis, $locker);
            $this->assertFalse($service->get()->getModelBillingMultiplier()->enabled);
            $data = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '2', 'output_price' => '3', 'currency' => 'CNY', 'usd_to_cny_rate' => '7'])->toArray();
            $service->save(PlatformSettings::fromArray(['model_billing_multiplier' => $data]));
            $this->assertContains('magic:platform_settings_cache', $deleted);
            $this->assertContains('magic:platform_settings_cache:v2', $deleted);
            $this->assertContains('globalConfig:all', $deleted);
            $settings = $service->get();
            $this->assertSame($data, $settings->getModelBillingMultiplier()->toArray());
            $response = (new ReflectionMethod(PlatformSettingsApi::class, 'platformSettingsToResponse'))->invoke(null, $settings->toArray());
            $this->assertSame($data, $response['model_billing_multiplier']);
        } finally {
            (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $previous);
        }
    }

    /** 固定一倍基准，使用已通过权限过滤的内存服务商集合。 */
    private function calculate(array $models): array
    {
        return (new ModelBillingMultiplierCalculator())->calculate(
            ['mock-model' => ['resolved_model_id' => 'mock-model']],
            ['mock-model' => $models],
            ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '10', 'output_price' => '0', 'usd_to_cny_rate' => '7'])
        );
    }

    /** 构造不含凭证的模拟价格配置。 */
    private function model(array $config): ProviderModelEntity
    {
        $model = new ProviderModelEntity();
        $model->setModelId('mock-model');
        $model->setConfig(['billing_type' => 'TextTokens', 'billing_currency' => 'CNY', ...$config]);
        return $model;
    }
}
