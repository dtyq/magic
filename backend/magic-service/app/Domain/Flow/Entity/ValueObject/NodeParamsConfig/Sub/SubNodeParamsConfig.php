<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Sub;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class SubNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        // 获取子流程的入参和出参，以用户输入的参数为准，可以为空，准确性放到执行时校验
        $subFlowId = $this->node->getParams()['sub_flow_id'] ?? '';
        if (! $subFlowId) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.sub.flow_id_empty');
        }

        return [
            'sub_flow_id' => $subFlowId,
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'sub_flow_id' => '',
        ]);
    }
}
