<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention\Normalizer;

use App\Application\Chat\Service\Mention\AbstractMentionNormalizer;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Logger\LoggerFactory;

/**
 * Normalize legacy business assistant mentions without exposing them as Agents.
 */
final class AssistantMentionNormalizer extends AbstractMentionNormalizer
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly MagicAgentDomainService $magicAgentDomainService,
    ) {
        parent::__construct($loggerFactory);
    }

    protected function enrich(array $item, BaseDataIsolation $dataIsolation): array
    {
        $assistantId = (string) ($item['assistant_id'] ?? ($item['id'] ?? ''));
        if ($assistantId === '') {
            return [];
        }

        $assistant = $this->magicAgentDomainService->getAgentById($assistantId);
        if (! $assistant->isAvailable()) {
            return [];
        }

        return [
            'assistant_id' => $assistant->getId(),
            'assistant_name' => $assistant->getAgentName(),
            'assistant_description' => $assistant->getAgentDescription(),
            'assistant_icon' => $assistant->getAgentAvatar(),
        ];
    }
}
