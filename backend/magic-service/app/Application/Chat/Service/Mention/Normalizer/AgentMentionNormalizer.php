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
 * @agent mention 规范化：补全 flow_code / description / agent_name / icon / instructs。
 *
 * mention 中 agent_id 即 agent.id（与 AgentMention/AgentData 一致）。
 */
class AgentMentionNormalizer extends AbstractMentionNormalizer
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly MagicAgentDomainService $magicAgentDomainService,
    ) {
        parent::__construct($loggerFactory);
    }

    protected function enrich(array $item, BaseDataIsolation $dataIsolation): array
    {
        $agentId = (string) ($item['agent_id'] ?? ($item['id'] ?? ''));
        if ($agentId === '') {
            return [];
        }

        $agent = $this->magicAgentDomainService->getAgentById($agentId);
        if (! $agent->isAvailable()) {
            return [];
        }

        return [
            'agent_id' => $agent->getId(),
            'flow_code' => $agent->getFlowCode(),
            'agent_name' => $agent->getAgentName(),
            'description' => $agent->getAgentDescription(),
            'icon' => $agent->getAgentAvatar(),
            'instructs' => $agent->getInstructs() ?? [],
        ];
    }
}
