<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Service\AiAbilityConfigAppService;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class AiAbilityConfigAppServiceTest extends TestCase
{
    public function testGetAvailabilityReturnsOnlyEnabledFlagsForSupportedAbilities(): void
    {
        $domainService = $this->createMock(AiAbilityDomainService::class);
        $domainService->expects($this->once())
            ->method('getAll')
            ->with($this->isInstanceOf(ProviderDataIsolation::class))
            ->willReturn([
                $this->createAbility(AiAbilityCode::ImageConvertHigh, true, ['model_id' => 'model-1']),
                $this->createAbility(AiAbilityCode::ImageRemoveBackground, false),
                $this->createAbility(AiAbilityCode::VolcengineArkAssets, true),
            ]);

        $providerModelDomainService = $this->createMock(ProviderModelDomainService::class);
        $providerModelDomainService->expects($this->once())
            ->method('getByModelId')
            ->willReturn(null);

        $service = new AiAbilityConfigAppService($domainService, $providerModelDomainService);

        $dataIsolation = $this->createMock(ProviderDataIsolation::class);

        $this->assertSame(
            [
                'abilities' => [
                    'image_convert_high' => [
                        'enabled' => true,
                        'image_size_config' => ['sizes' => []],
                    ],
                    'image_remove_background' => ['enabled' => false],
                    'image_eraser' => ['enabled' => false],
                    'image_expand' => ['enabled' => false],
                    'volcengine_ark_assets' => ['enabled' => true],
                ],
            ],
            $service->getAvailability($dataIsolation)
        );
    }

    private function createAbility(AiAbilityCode $code, bool $enabled, array $config = []): AiAbilityEntity
    {
        $entity = new AiAbilityEntity();
        $entity->setCode($code);
        $entity->setStatus($enabled);
        $entity->setConfig($config);

        return $entity;
    }
}
