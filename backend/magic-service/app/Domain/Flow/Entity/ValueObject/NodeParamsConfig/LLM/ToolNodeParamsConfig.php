<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM;

use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\ModelConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\ToolNodeMode;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\Expression\Value;
use Dtyq\FlowExprEngine\Structure\StructureType;

class ToolNodeParamsConfig extends AbstractLLMNodeParamsConfig
{
    private string $toolId;

    private ToolNodeMode $mode;

    private bool $async = false;

    private NodeInput $customSystemInput;

    public function getToolId(): string
    {
        return $this->toolId;
    }

    public function getMode(): ToolNodeMode
    {
        return $this->mode;
    }

    public function isAsync(): bool
    {
        return $this->async;
    }

    public function getCustomSystemInput(): NodeInput
    {
        return $this->customSystemInput;
    }

    public function setSystemPrompt(string $prompt): void
    {
        $this->systemPrompt = ComponentFactory::generateTemplate(StructureType::Value, Value::buildConst($prompt)->toArray());
    }

    public function validate(): array
    {
        $params = $this->node->getParams();

        $toolId = $params['tool_id'] ?? '';
        if (! $toolId) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.tool.tool_id_empty');
        }
        $this->toolId = $toolId;

        $mode = ToolNodeMode::tryFrom($params['mode'] ?? '');
        if (! $mode) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.tool.mode_empty');
        }
        $this->mode = $mode;

        $customSystemInput = new NodeInput();
        $customSystemInput->setForm(ComponentFactory::fastCreate($params['custom_system_input']['form'] ?? null));
        $this->customSystemInput = $customSystemInput;

        $this->async = (bool) ($params['async'] ?? false);

        // 先加载默认值
        $this->model = $this->createModelComponentByName($this->getDefaultModelString());
        $this->modelConfig = new ModelConfig();
        $this->userPrompt = ComponentFactory::generateTemplate(StructureType::Value);

        if ($mode->isLLM()) {
            $this->model = $this->formatModel($params['model'] ?? null);

            $this->modelConfig = new ModelConfig(
                autoMemory: (bool) ($params['model_config']['auto_memory'] ?? false),
                maxRecord: (int) ($params['model_config']['max_record'] ?? ($params['max_record'] ?? 50)),
                temperature: (float) ($params['model_config']['temperature'] ?? 0.5)
            );

            $userPrompt = ComponentFactory::fastCreate($params['user_prompt'] ?? null);
            if ($userPrompt && ! $userPrompt->isValue()) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'user_prompt']);
            }
            $this->userPrompt = $userPrompt;
            $this->setSystemPrompt('');
        }

        return [
            'tool_id' => $this->toolId,
            'mode' => $this->mode->value,
            'custom_system_input' => $this->customSystemInput->toArray(),
            'async' => $this->async,

            'model' => $this->model->getValue()->getResult(),
            'model_config' => $this->modelConfig?->getLLMChatConfig(),
            'user_prompt' => $this->userPrompt?->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $customSystemInput = new NodeInput();
        $customSystemInput->setForm(ComponentFactory::generateTemplate(StructureType::Form));

        $this->node->setParams([
            'tool_id' => '',
            'mode' => ToolNodeMode::PARAMETER->value,
            'custom_system_input' => $customSystemInput->toArray(),
            'async' => false,

            // 当选择 LLM 模式时，需要有以下值
            'model' => $this->getDefaultModelString(),
            'model_config' => (new ModelConfig())->getLLMChatConfig(),
            'user_prompt' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
        ]);
    }
}
