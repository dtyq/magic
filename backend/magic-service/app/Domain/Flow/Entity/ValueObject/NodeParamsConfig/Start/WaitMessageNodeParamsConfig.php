<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start;

use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Template\StartInputTemplate;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class WaitMessageNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();
        $interval = $params['timeout_config']['interval'] ?? 10;
        if (! is_int($interval) || $interval <= 0) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.start.interval_valid');
        }
        $unit = $params['timeout_config']['unit'] ?? 'minutes';
        if (! is_string($unit) && ! in_array($unit, ['minutes', 'hours', 'seconds'])) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.start.unsupported_unit', ['unit' => $unit]);
        }
        return [
            'timeout_config' => [
                'enabled' => (bool) ($params['timeout_config']['enabled'] ?? false),
                'interval' => $interval,
                'unit' => $unit,
            ],
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'timeout_config' => [
                'enabled' => false,
                'interval' => 10,
                'unit' => 'minutes',
            ],
        ]);

        $form = StartInputTemplate::getChatMessageInputTemplateComponent();
        $input = new NodeInput();
        $input->setForm($form);
        $this->node->setInput($input);

        $output = new NodeOutput();
        $output->setForm($form);
        $this->node->setOutput($output);
    }
}
