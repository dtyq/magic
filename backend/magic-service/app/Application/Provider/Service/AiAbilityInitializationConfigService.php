<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use Hyperf\Contract\ConfigInterface;

class AiAbilityInitializationConfigService
{
    public function __construct(
        private readonly ConfigInterface $config,
        private readonly KnowledgeBaseDomainService $knowledgeBaseDomainService,
    ) {
    }

    /**
     * @return array<array-key, mixed>
     */
    public function getAbilitiesForInitialization(): array
    {
        $abilities = $this->config->get('ai_abilities.abilities', []);
        if (! is_array($abilities)) {
            return [];
        }

        return $this->withKnowledgeBaseEmbeddingModelConfig(
            $this->withKnowledgeBaseVisualUnderstandingConfig($abilities),
            $this->knowledgeBaseDomainService->getCurrentEmbeddingModelId()
        );
    }

    /**
     * @param array<array-key, mixed> $abilities
     * @return array<array-key, mixed>
     */
    public function withKnowledgeBaseEmbeddingModelConfig(array $abilities, string $currentModelId): array
    {
        $knowledgeBaseEmbeddingModelCode = AiAbilityCode::KnowledgeBaseEmbeddingModel->value;
        $currentModelId = trim($currentModelId);

        foreach ($abilities as $key => $abilityConfig) {
            if (! is_array($abilityConfig)) {
                continue;
            }

            $code = $abilityConfig['code'] ?? $key;
            if ($code instanceof AiAbilityCode) {
                $code = $code->value;
            }
            if (! is_scalar($code) || (string) $code !== $knowledgeBaseEmbeddingModelCode) {
                continue;
            }

            $config = $abilityConfig['config'] ?? [];
            if (! is_array($config)) {
                $config = [];
            }
            $config['model_id'] = $currentModelId;

            $abilityConfig['config'] = $config;
            $abilities[$key] = $abilityConfig;
        }

        return $abilities;
    }

    /**
     * @param array<array-key, mixed> $abilities
     * @return array<array-key, mixed>
     */
    public function withKnowledgeBaseVisualUnderstandingConfig(array $abilities): array
    {
        $knowledgeBaseVisualUnderstandingCode = AiAbilityCode::KnowledgeBaseVisualUnderstanding->value;

        foreach ($abilities as $key => $abilityConfig) {
            if (! is_array($abilityConfig)) {
                continue;
            }

            $code = $abilityConfig['code'] ?? $key;
            if ($code instanceof AiAbilityCode) {
                $code = $code->value;
            }
            if (! is_scalar($code) || (string) $code !== $knowledgeBaseVisualUnderstandingCode) {
                continue;
            }

            $abilityConfig['status'] = false;
            $abilities[$key] = $abilityConfig;
        }

        return $abilities;
    }
}
