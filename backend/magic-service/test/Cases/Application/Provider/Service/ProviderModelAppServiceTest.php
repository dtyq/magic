<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Service\ProviderModelAppService;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelConfigVersionModel;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderModelAppServiceTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
        $this->createOfficialVideoProviderFixture('https://pricing.example.com', 'pricing-key');
    }

    protected function tearDown(): void
    {
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testGetModelPricingByModelIdsReadsVideoPricingFromConfigVersion(): void
    {
        $fastModelSeed = $this->officialVideoModelSeed($this->officialFastVideoModelId());
        $providerModel = $this->getOfficialVideoProviderModel(self::TEST_PROVIDER_CONFIG_ID, $fastModelSeed['model_id']);

        ProviderModelConfigVersionModel::query()
            ->where('service_provider_model_id', $providerModel->id)
            ->where('is_current_version', true)
            ->update([
                'time_pricing' => 0.02,
                'time_cost' => 0.02,
            ]);

        $service = di(ProviderModelAppService::class);
        $items = $service->getModelPricingByModelIds([$fastModelSeed['model_id']]);

        $this->assertCount(1, $items);
        $this->assertSame($fastModelSeed['model_id'], $items[0]->getModelId());
        $this->assertSame($fastModelSeed['name'], $items[0]->getModelName());
        $this->assertSame('Times', $items[0]->getBillingType());
        $this->assertSame(2, $items[0]->getTimePoints());
    }

    public function testGetModelPricingByModelIdsReturnsProPricingFromConfigVersion(): void
    {
        $service = di(ProviderModelAppService::class);
        $items = $service->getModelPricingByModelIds([$this->officialProVideoModelId()]);

        $this->assertCount(1, $items);
        $this->assertSame($this->officialProVideoModelId(), $items[0]->getModelId());
        $this->assertSame('Veo 3.1 Pro', $items[0]->getModelName());
        $this->assertSame('Times', $items[0]->getBillingType());
        $this->assertSame(10, $items[0]->getTimePoints());
    }
}
