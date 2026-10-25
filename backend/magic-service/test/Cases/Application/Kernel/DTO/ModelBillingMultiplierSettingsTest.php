<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel\DTO;

use App\Application\Kernel\DTO\ModelBillingMultiplierSettings;
use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\Application\Mode\Service\ModelBillingMultiplierCalculator;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Interfaces\Kernel\DTO\Request\ModelBillingMultiplierUpdateRequest;
use App\Interfaces\Kernel\DTO\Request\PlatformSettingsUpdateRequest;
use App\Interfaces\Kernel\Facade\ModelBillingMultiplierApi;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * 模拟单价覆盖统一配置、精度和倍率链路，不连接数据库或真实服务商。
 * @internal
 */
final class ModelBillingMultiplierSettingsTest extends TestCase
{
    /** 新单价生成参考金额，前端回传的旧计算值不能覆盖结果。 */
    public function testTokenPricesDetermineReferenceAmount(): void
    {
        $data = ['enabled' => true, 'input_price' => '2.000000000001', 'output_price' => '3', 'base_price_cny' => '999'];
        $settings = ModelBillingMultiplierSettings::fromArray($data);
        $this->assertSame('0.02300000000001', $settings->basePriceCny);
        $this->assertSame('2.000000000001', $settings->inputPrice);
        $this->assertSame('3', $settings->outputPrice);
        $this->assertSame('7', $settings->usdToCnyRate);
        $restored = PlatformSettings::fromArray(['model_billing_multiplier' => $settings->toArray()]);
        $this->assertSame($settings->toArray(), $restored->toArray()['model_billing_multiplier']);
    }

    /** 最小合法输出单价不能被截断成零，最大精度回显仍可校验。 */
    public function testSmallestAndLargestPricesRemainExact(): void
    {
        $small = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '0', 'output_price' => '0.000000000001']);
        $this->assertSame('0.000000000000001', $small->basePriceCny);
        $large = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '999999999999.999999999999', 'output_price' => '999999999999.999999999999']);
        $this->assertSame('10999999999.999999999999989', $large->basePriceCny);
        $this->assertSame($large->toArray(), $large->withOverrides(array_diff_key($large->toArray(), ['base_price_cny' => true]))->toArray());
        $request = (new ReflectionClass(PlatformSettingsUpdateRequest::class))->newInstanceWithoutConstructor();
        $rules = $request->rules();
        $this->assertSame('sometimes|nullable|string|max:25', $rules['model_billing_multiplier.input_price']);
        $this->assertSame('sometimes|nullable|string|max:25', $rules['model_billing_multiplier.output_price']);
        $this->assertArrayNotHasKey('model_billing_multiplier.base_price_cny', $rules);
        $this->assertArrayNotHasKey('model_billing_multiplier.input_price_cny', $rules);
    }

    /** 一项可以为零；不因输入单价为零而错误回退到旧金额。 */
    public function testOneZeroPriceParticipates(): void
    {
        $this->assertSame('0.003', ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '0', 'output_price' => '3'])->basePriceCny);
        $this->assertSame('0.02', ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '2', 'output_price' => '0'])->basePriceCny);
    }

    /** 非法或不完整的新单价不能借旧金额绕过校验，关闭时同样拒绝无效已填值。 */
    public function testInvalidPricesCannotFallBackToLegacyAmount(): void
    {
        $invalidPairs = [['0', '0'], ['2', null], [null, '3'], ['-1', '3'], ['1e3', '3'], ['NaN', '3'], ['Infinity', '3'], [[], '3'], [true, '3'], ['0.0000000000001', '3'], ['1000000000000', '3']];
        foreach ([true, false] as $enabled) {
            foreach ($invalidPairs as [$input, $output]) {
                try {
                    ModelBillingMultiplierSettings::fromArray(['enabled' => $enabled, 'input_price' => $input, 'output_price' => $output, 'base_price_cny' => '0.1']);
                    $this->fail('Invalid token prices must be rejected');
                } catch (InvalidArgumentException) {
                    $this->addToAssertionCount(1);
                }
            }
        }
    }

    /** 空配置保持关闭，纯派生金额不能代替两项源单价。 */
    public function testEmptySettingsAndMissingPrices(): void
    {
        $empty = ModelBillingMultiplierSettings::fromArray([]);
        $this->assertFalse($empty->enabled);
        $this->assertNull($empty->basePriceCny);
        $this->assertNull($empty->inputPrice);
        $this->assertSame('7', $empty->usdToCnyRate);
        $this->expectException(InvalidArgumentException::class);
        ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'base_price_cny' => '0.8']);
    }

    /** 部分更新和关闭再开启保留两项单价，输入变化后重新计算。 */
    public function testPartialUpdatesPreservePrices(): void
    {
        $settings = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '2', 'output_price' => '3', 'usd_to_cny_rate' => '5']);
        $disabled = $settings->withOverrides(['enabled' => false]);
        $this->assertFalse($disabled->enabled);
        $this->assertSame($settings->toArray(), $disabled->withOverrides(['enabled' => true])->toArray());
        $changed = $settings->withOverrides(['input_price' => '4']);
        $this->assertSame('0.043', $changed->basePriceCny);
        $this->assertSame('3', $changed->outputPrice);
        $rateOnly = $settings->withOverrides(['usd_to_cny_rate' => '6']);
        $this->assertSame('0.023', $rateOnly->basePriceCny);
        $this->assertSame('6', $rateOnly->usdToCnyRate);
    }

    /** 只读金额和废弃别名必须明确拒绝，不再猜测客户端字段优先级。 */
    public function testUnsupportedWriteFieldsAreRejected(): void
    {
        $settings = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '2', 'output_price' => '3']);
        foreach (['base_price_cny', 'input_price_cny', 'output_price_cny', 'unknown'] as $key) {
            foreach ([true, false] as $enabled) {
                try {
                    $settings->withOverrides(['enabled' => $enabled, 'input_price' => '2', 'output_price' => '3', $key => null]);
                    $this->fail('Unsupported fields must be rejected before merging');
                } catch (InvalidArgumentException) {
                    $this->assertSame('2', $settings->inputPrice);
                }
            }
        }
    }

    /** 覆盖配置持久化往返、局部更新保留，显式空集合才清空。 */
    public function testModelOverridesSurvivePartialUpdates(): void
    {
        $overrides = [['model_id' => 'mock.model', 'multiplier' => '0.500000000001']];
        $settings = ModelBillingMultiplierSettings::fromArray(['model_overrides' => $overrides]);
        $this->assertSame($overrides, $settings->toArray()['model_overrides']);
        $this->assertSame('0.500000000001', $settings->withOverrides(['usd_to_cny_rate' => '6'])->getModelOverride('mock.model'));
        $this->assertNull($settings->getModelOverride('mock-other'));
        $this->assertSame([], $settings->withOverrides(['model_overrides' => []])->modelOverrides);
        $this->assertSame($settings->toArray(), ModelBillingMultiplierSettings::fromArray($settings->toArray())->toArray());
    }

    /** 空、重复、负数、零及非普通十进制覆盖值整体拒绝。 */
    public function testInvalidModelOverridesAreRejected(): void
    {
        $invalid = [null, 'bad', ['mock' => '1'], [['model_id' => '', 'multiplier' => '1']],
            [['model_id' => 'mock', 'multiplier' => '1', 'extra' => true]],
            [['model_id' => 'mock', 'multiplier' => '1'], ['model_id' => 'mock', 'multiplier' => '2']]];
        foreach (['', '0', '-1', '1e3', 'NaN', 'Infinity', '0.0000000000001', '1000000000000', 1] as $value) {
            $invalid[] = [['model_id' => 'mock', 'multiplier' => $value]];
        }
        foreach ($invalid as $overrides) {
            try {
                ModelBillingMultiplierSettings::fromArray(['model_overrides' => $overrides]);
                $this->fail('Invalid overrides must be rejected');
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    /** 原倍率计算链直接使用派生金额，不需要调整模型装配或实际扣费。 */
    public function testCalculatedBaseFlowsIntoModelMultiplier(): void
    {
        $model = new ProviderModelEntity();
        $model->setModelId('mock-model');
        $model->setConfig(['billing_type' => 'TextTokens', 'billing_currency' => 'CNY', 'input_pricing' => '4', 'output_pricing' => '6']);
        $settings = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'input_price' => '2', 'output_price' => '3']);
        $result = (new ModelBillingMultiplierCalculator())->calculate(['mock-model' => ['resolved_model_id' => 'mock-model']], ['mock-model' => [$model]], $settings);
        $this->assertSame(2.0, $result['mock-model']);
    }

    /** 美元源价按展示汇率归一到人民币，刷新与保存不会重复换汇。 */
    public function testUsdPricesAndRateChangesRemainStable(): void
    {
        $settings = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'currency' => 'USD', 'input_price' => '2', 'output_price' => '3', 'usd_to_cny_rate' => '5']);
        $this->assertSame('0.115', $settings->basePriceCny);
        $this->assertSame('2', $settings->inputPrice);
        $this->assertSame('USD', $settings->currency);
        $this->assertSame($settings->toArray(), ModelBillingMultiplierSettings::fromArray($settings->toArray())->toArray());
        $this->assertSame('0.138', $settings->withOverrides(['usd_to_cny_rate' => '6'])->basePriceCny);
        $this->assertSame('0.023', $settings->withOverrides(['currency' => 'CNY'])->basePriceCny);
        $this->assertSame('2', $settings->withOverrides(['currency' => 'CNY'])->inputPrice);
        $this->assertSame('USD', $settings->withOverrides(['enabled' => false])->withOverrides(['enabled' => true])->currency);
    }

    /** 最小换汇金额也必须为正数，并贯通已有的服务商倍率计算。 */
    public function testSmallUsdBaseDoesNotUnderflow(): void
    {
        $settings = ModelBillingMultiplierSettings::fromArray(['enabled' => true, 'currency' => 'USD', 'input_price' => '0', 'output_price' => '0.000000000001', 'usd_to_cny_rate' => '0.000000000001']);
        $this->assertSame('0.000000000000000000000000001', $settings->basePriceCny);
        $model = new ProviderModelEntity();
        $model->setConfig(['billing_type' => 'TextTokens', 'billing_currency' => 'USD', 'input_pricing' => '0', 'output_pricing' => '0.000000000001']);
        $result = (new ModelBillingMultiplierCalculator())->calculate(['mock' => ['resolved_model_id' => 'mock']], ['mock' => [$model]], $settings);
        $this->assertSame(1.0, $result['mock']);
    }

    /** 重复保存相同单价并修改汇率时，开启和关闭都不能清空单价。 */
    public function testRepeatedStandardUpdatesPreserveBothPrices(): void
    {
        foreach ([true, false] as $enabled) {
            $settings = ModelBillingMultiplierSettings::fromArray(['enabled' => $enabled, 'currency' => 'CNY', 'input_price' => '2', 'output_price' => '3']);
            $result = $settings->withOverrides(['enabled' => $enabled, 'currency' => 'CNY', 'input_price' => '2', 'output_price' => '3', 'usd_to_cny_rate' => '6']);
            $this->assertSame('2', $result->inputPrice);
            $this->assertSame('3', $result->outputPrice);
            $this->assertSame('0.023', $result->basePriceCny);
            $this->assertArrayNotHasKey('input_price_cny', $result->toArray());
            $this->assertArrayNotHasKey('output_price_cny', $result->toArray());
        }
    }

    /** 币种使用严格枚举，历史缺失与空值在后端统一默认人民币。 */
    public function testCurrencyValidationAndDefaults(): void
    {
        $this->assertSame('CNY', ModelBillingMultiplierSettings::fromArray([])->currency);
        $this->assertSame('CNY', ModelBillingMultiplierSettings::fromArray(['currency' => null])->currency);
        foreach (['EUR', 'usd', '', [], true] as $currency) {
            try {
                ModelBillingMultiplierSettings::fromArray(['currency' => $currency]);
                $this->fail('Invalid currency must be rejected');
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    /** 使用模拟存储验证管理接口接收新字段、返回派生金额及后续部分更新。 */
    public function testAdminApiPersistsAndReturnsCalculatedBase(): void
    {
        $stored = new PlatformSettings();
        $service = $this->createMock(PlatformSettingsAppService::class);
        $service->method('getPersisted')->willReturnCallback(static function () use (&$stored) { return $stored; });
        $service->expects($this->exactly(2))->method('updateModelBillingMultiplier')->willReturnCallback(static function (array $overrides) use (&$stored) {
            $data = $stored->toArray();
            $data['model_billing_multiplier'] = $stored->getModelBillingMultiplier()->withOverrides($overrides)->toArray();
            $stored = PlatformSettings::fromArray($data);
            return $stored;
        });
        $api = new ModelBillingMultiplierApi($service);
        $request = $this->createMock(ModelBillingMultiplierUpdateRequest::class);
        $request->method('validated')->willReturn(['model_billing_multiplier' => ['enabled' => true, 'input_price' => '2.000000000001', 'output_price' => '3', 'model_overrides' => [['model_id' => 'mock-auto', 'multiplier' => '0.5']]]]);
        $response = $api->update($request);
        $this->assertSame('0.02300000000001', $response['model_billing_multiplier']['base_price_cny']);
        $this->assertSame('2.000000000001', $response['model_billing_multiplier']['input_price']);
        $this->assertSame('7', $response['model_billing_multiplier']['usd_to_cny_rate']);
        $disable = $this->createMock(ModelBillingMultiplierUpdateRequest::class);
        $disable->method('validated')->willReturn(['model_billing_multiplier' => ['enabled' => false]]);
        $api->update($disable);
        $after = $api->show()['model_billing_multiplier'];
        $this->assertFalse($after['enabled']);
        $this->assertSame([['model_id' => 'mock-auto', 'multiplier' => '0.5']], $after['model_overrides']);
        $this->assertSame('2.000000000001', $after['input_price']);
        $this->assertSame('0.02300000000001', $after['base_price_cny']);
    }
}
