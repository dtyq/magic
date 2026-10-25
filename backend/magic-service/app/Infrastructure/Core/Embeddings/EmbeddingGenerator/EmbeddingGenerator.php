<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\EmbeddingGenerator;

use App\Application\Provider\Service\AiAbilityConfigAppService;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use Hyperf\Context\Context;
use Throwable;

use function Hyperf\Config\config;

class EmbeddingGenerator
{
    public static function defaultModel(): string
    {
        return config('magic_flows.default_embedding_model');
    }

    public static function getVectorDefaultModel(): string
    {
        return self::getEnabledModelId(AiAbilityCode::KnowledgeBaseEmbeddingModel) ?? '';
    }

    public static function isEnabled(AiAbilityCode $abilityCode): bool
    {
        return self::getEnabledModelId($abilityCode) !== null;
    }

    public static function getEnabledModelId(AiAbilityCode $abilityCode): ?string
    {
        $cacheKey = 'embedding_generator:ability_model:' . $abilityCode->value;
        $cached = Context::get($cacheKey);
        if (is_array($cached) && array_key_exists('model_id', $cached)) {
            return $cached['model_id'];
        }

        try {
            $abilityConfig = di(AiAbilityConfigAppService::class)->getConfig('', $abilityCode->value);
        } catch (Throwable) {
            Context::set($cacheKey, ['model_id' => null]);
            return null;
        }

        if (! ($abilityConfig['enabled'] ?? false)) {
            Context::set($cacheKey, ['model_id' => null]);
            return null;
        }

        $modelId = trim((string) ($abilityConfig['config']['model_id'] ?? ''));
        $modelId = $modelId === '' ? null : $modelId;
        Context::set($cacheKey, ['model_id' => $modelId]);
        return $modelId;
    }
}
