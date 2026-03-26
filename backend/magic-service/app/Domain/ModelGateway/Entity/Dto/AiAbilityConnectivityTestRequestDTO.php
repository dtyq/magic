<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use RuntimeException;

class AiAbilityConnectivityTestRequestDTO extends AbstractRequestDTO
{
    /**
     * 兼容外部接口名与内部能力码的映射.
     *
     * @var array<string, string>
     */
    private const array AI_ABILITY_ALIASES = [
        'unifiedsearch' => AiAbilityCode::WebSearch->value,
        'websearch' => AiAbilityCode::WebSearch->value,
        'web_search' => AiAbilityCode::WebSearch->value,
        'imagesearch' => AiAbilityCode::ImageSearch->value,
        'image_search' => AiAbilityCode::ImageSearch->value,
        'webscrape' => AiAbilityCode::WebScrape->value,
        'web_scrape' => AiAbilityCode::WebScrape->value,
    ];

    private string $aiAbility = '';

    public static function createDTO(array $data): self
    {
        $dto = new self();
        $dto->setAiAbility((string) ($data['ai_ability'] ?? ''));
        return $dto;
    }

    public function getType(): string
    {
        return 'ai_ability_connectivity_test';
    }

    public function getAiAbility(): string
    {
        return $this->aiAbility;
    }

    public function setAiAbility(string $aiAbility): self
    {
        $this->aiAbility = trim($aiAbility);
        return $this;
    }

    public function getNormalizedAiAbility(): string
    {
        $normalized = strtolower(trim($this->aiAbility));
        $normalized = str_replace(['-', ' '], '_', $normalized);
        $compact = str_replace('_', '', $normalized);

        return self::AI_ABILITY_ALIASES[$normalized]
            ?? self::AI_ABILITY_ALIASES[$compact]
            ?? $normalized;
    }

    public function getAiAbilityCode(): AiAbilityCode
    {
        $aiAbilityCode = AiAbilityCode::tryFrom($this->getNormalizedAiAbility());
        if (! $aiAbilityCode instanceof AiAbilityCode || $aiAbilityCode === AiAbilityCode::Unknown) {
            throw new RuntimeException(sprintf('Unsupported ai_ability: %s', $this->aiAbility));
        }

        return $aiAbilityCode;
    }

    /**
     * @throws RuntimeException
     */
    public function validate(): void
    {
        if ($this->aiAbility === '') {
            throw new RuntimeException('ai_ability is required');
        }

        $this->getAiAbilityCode();
    }
}
