<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Mapper;

use App\Application\ModelGateway\Mapper\ProviderManager;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderManagerTest extends TestCase
{
    public function testModelIdsGroupByTypeCanRestrictTheQueryToRequestedModelTypes(): void
    {
        $modelService = $this->createMock(ProviderModelDomainService::class);
        $modelService->expects($this->once())
            ->method('getModelIdsGroupByType')
            ->with(
                $this->isInstanceOf(ProviderDataIsolation::class),
                $this->callback(static function ($query): bool {
                    return $query->getModelTypes() === [ModelType::LLM]
                        && $query->getStatus()->value === 1;
                }),
            )
            ->willReturn([
                (string) ModelType::LLM->value => ['organization-model'],
            ]);

        $manager = new ProviderManager(
            $modelService,
            $this->createMock(ProviderConfigDomainService::class),
            new ProviderDomainService($this->createMock(ProviderRepositoryInterface::class)),
        );

        $result = $manager->getModelIdsGroupByType(
            ProviderDataIsolation::create('organization-a'),
            [ModelType::LLM],
        );

        $this->assertSame([
            (string) ModelType::LLM->value => ['organization-model'],
        ], $result);
    }
}
