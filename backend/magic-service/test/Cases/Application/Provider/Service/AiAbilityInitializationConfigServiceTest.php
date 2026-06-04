<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Service\AiAbilityInitializationConfigService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class AiAbilityInitializationConfigServiceTest extends TestCase
{
    public function testInitializationUsesCurrentKnowledgeBaseModel(): void
    {
        $service = $this->createService(
            [
                'knowledge_base_embedding_model' => [
                    'code' => 'knowledge_base_embedding_model',
                    'config' => [
                        'model_id' => 'text-embedding-3-small',
                    ],
                ],
            ],
            'BAAI/bge-base-zh-v1.5'
        );

        $abilities = $service->getAbilitiesForInitialization();

        $this->assertSame(
            'BAAI/bge-base-zh-v1.5',
            $abilities['knowledge_base_embedding_model']['config']['model_id']
        );
    }

    public function testInitializationUsesEmptyModelWhenNoCurrentKnowledgeBaseModelExists(): void
    {
        $service = $this->createService(
            [
                'knowledge_base_embedding_model' => [
                    'code' => 'knowledge_base_embedding_model',
                    'config' => [
                        'model_id' => 'text-embedding-3-small',
                    ],
                ],
            ],
            ''
        );

        $abilities = $service->getAbilitiesForInitialization();

        $this->assertSame('', $abilities['knowledge_base_embedding_model']['config']['model_id']);
    }

    public function testInitializationMatchesKnowledgeBaseEmbeddingModelByCode(): void
    {
        $service = $this->createService(
            [
                [
                    'code' => 'knowledge_base_embedding_model',
                    'config' => [
                        'model_id' => '',
                    ],
                ],
            ],
            'text-embedding-3-large'
        );

        $abilities = $service->getAbilitiesForInitialization();

        $this->assertSame('text-embedding-3-large', $abilities[0]['config']['model_id']);
    }

    public function testInitializationDisablesKnowledgeBaseVisualUnderstanding(): void
    {
        $service = $this->createService(
            [
                'knowledge_base_visual_understanding' => [
                    'code' => 'knowledge_base_visual_understanding',
                    'status' => true,
                    'config' => [
                        'model_id' => 'kimi-k2.5',
                    ],
                ],
            ],
            ''
        );

        $abilities = $service->getAbilitiesForInitialization();

        $this->assertFalse($abilities['knowledge_base_visual_understanding']['status']);
        $this->assertSame(
            'kimi-k2.5',
            $abilities['knowledge_base_visual_understanding']['config']['model_id']
        );
    }

    private function createService(array $abilities, string $currentModelId): AiAbilityInitializationConfigService
    {
        $config = $this->createMock(ConfigInterface::class);
        $config->expects($this->once())
            ->method('get')
            ->with('ai_abilities.abilities', [])
            ->willReturn($abilities);

        $knowledgeBaseDomainService = $this->createMock(KnowledgeBaseDomainService::class);
        $knowledgeBaseDomainService->expects($this->once())
            ->method('getCurrentEmbeddingModelId')
            ->willReturn($currentModelId);

        return new AiAbilityInitializationConfigService($config, $knowledgeBaseDomainService);
    }
}
