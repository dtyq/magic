<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\MagicFlowVersionEntity;

class ExecutionDataUtil
{
    /**
     * @param array{flow: MagicFlowEntity, flow_version?: ?MagicFlowVersionEntity, agent?: ?MagicAgentEntity, agent_version?: ?MagicAgentVersionEntity} $flowData
     */
    public static function appendTriggerTopInfo(array $flowData, ExecutionData $executionData): void
    {
        $flow = $flowData['flow'];
        $agent = $flowData['agent'] ?? null;

        $executionData->setTriggerTopInfo([
            'flow_info' => [
                'flow_type' => $flow->getType()->value,
                'agent_id' => $agent?->getId() ?? '',
                'agent_name' => $agent?->getAgentName() ?? '',
                'flow_code' => $flow->getCode(),
                'flow_name' => $flow->getName(),
            ],
        ]);
    }
}
