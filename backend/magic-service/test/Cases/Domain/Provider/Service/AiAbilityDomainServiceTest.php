<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\Service;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Facade\AiAbilityRepositoryInterface;
use App\Domain\Provider\Service\AiAbilityDomainService;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class AiAbilityDomainServiceTest extends TestCase
{
    public function testInitializeAbilitiesUsesProvidedConfig(): void
    {
        $repository = $this->createMock(AiAbilityRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('getByCode')
            ->with($this->isInstanceOf(ProviderDataIsolation::class), AiAbilityCode::KnowledgeBaseEmbeddingModel)
            ->willReturn(null);
        $repository->expects($this->once())
            ->method('save')
            ->with($this->callback(static function (AiAbilityEntity $entity): bool {
                return $entity->getCode() === AiAbilityCode::KnowledgeBaseEmbeddingModel
                    && $entity->getOrganizationCode() === 'ORG-1'
                    && $entity->getConfig()['model_id'] === 'BAAI/bge-base-zh-v1.5';
            }))
            ->willReturn(true);

        $config = $this->createMock(ConfigInterface::class);
        $config->expects($this->never())->method('get');

        $service = new AiAbilityDomainService($repository, $config);

        $count = $service->initializeAbilities(ProviderDataIsolation::create('ORG-1'), [
            [
                'code' => 'knowledge_base_embedding_model',
                'name' => '知识库嵌入模型',
                'description' => 'desc',
                'config' => [
                    'model_id' => 'BAAI/bge-base-zh-v1.5',
                ],
            ],
        ]);

        $this->assertSame(1, $count);
    }
}
