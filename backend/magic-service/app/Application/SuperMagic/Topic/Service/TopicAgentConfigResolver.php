<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Topic\Service;

use App\Application\SuperMagic\Topic\DTO\TopicAgentConfig;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;

final class TopicAgentConfigResolver
{
    public function resolve(
        TopicEntity $topicEntity,
        ?SuperAgentExtra $extra,
        string $fallbackTopicMode = ''
    ): TopicAgentConfig {
        $persistedTopicMode = trim($topicEntity->getTopicMode());
        $persistedAgentCode = trim($topicEntity->getAgentCode());

        if ($this->isFixed() && $persistedTopicMode !== '') {
            $requestAgentCode = trim((string) ($extra?->getAgentCode() ?? ''));
            $agentCode = $persistedTopicMode === 'crew-creator'
                && $persistedAgentCode === ''
                && $requestAgentCode !== ''
                ? $requestAgentCode
                : $persistedAgentCode;

            return $this->normalize($persistedTopicMode, $agentCode);
        }

        $requestTopicPattern = trim((string) ($extra?->getTopicPattern() ?? ''));
        $topicMode = $requestTopicPattern !== ''
            ? $requestTopicPattern
            : trim($fallbackTopicMode !== '' ? $fallbackTopicMode : $persistedTopicMode);

        $requestAgentCode = trim((string) ($extra?->getAgentCode() ?? ''));
        $agentCode = $requestAgentCode !== '' ? $requestAgentCode : $persistedAgentCode;

        return $this->normalize($topicMode, $agentCode);
    }

    private function normalize(string $topicMode, string $agentCode): TopicAgentConfig
    {
        if (str_starts_with($topicMode, 'SMA-')) {
            return new TopicAgentConfig(
                topicMode: ProjectMode::CUSTOM_AGENT->value,
                agentCode: $topicMode,
            );
        }

        if ($topicMode === ProjectMode::MICRO_APP->value) {
            $agentCode = '';
        }

        return new TopicAgentConfig($topicMode, $agentCode);
    }

    private function isFixed(): bool
    {
        return (bool) config('super-magic.topic.config_fixed', true);
    }
}
