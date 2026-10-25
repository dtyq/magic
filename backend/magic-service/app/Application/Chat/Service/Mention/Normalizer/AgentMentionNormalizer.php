<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention\Normalizer;

use App\Application\Chat\Service\Mention\AbstractMentionNormalizer;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Logger\LoggerFactory;

/**
 * @agent mention 规范化：补全 agent_code / flow_code / description / agent_name / icon / instructs。
 *
 * 新 Agent mention 的 agent_id 即 SuperMagic Agent 的公开 code；旧业务助理
 * 使用独立的 assistant mention，不应从 MagicAgentDomainService 读取。
 */
class AgentMentionNormalizer extends AbstractMentionNormalizer
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly SuperMagicAgentDomainService $superMagicAgentDomainService,
    ) {
        parent::__construct($loggerFactory);
    }

    protected function enrich(array $item, BaseDataIsolation $dataIsolation): array
    {
        $agentId = (string) ($item['agent_id'] ?? ($item['id'] ?? ''));
        if ($agentId === '') {
            return [];
        }

        $dataIsolation = SuperMagicAgentDataIsolation::createByBaseDataIsolation($dataIsolation);
        $agent = $this->superMagicAgentDomainService->getByCode($dataIsolation, $agentId);
        if ($agent === null || ! $agent->isEnabled()) {
            return [];
        }

        return [
            'agent_id' => $agentId,
            'agent_code' => $agent->getCode(),
            'agent_name' => $agent->getName(),
            'description' => $agent->getDescription(),
            'icon' => $agent->getIcon(),
        ];
    }
}
