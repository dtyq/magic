<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM;

use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\ModelConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\OptionTool;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\AgentPluginCollector;
use App\Infrastructure\Core\Contract\Flow\AgentPluginInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

abstract class AbstractLLMNodeParamsConfig extends NodeParamsConfig
{
    protected Component $model;

    protected Component $systemPrompt;

    protected Component $userPrompt;

    protected ModelConfig $modelConfig;

    protected array $tools = [];

    /**
     * @var OptionTool[]
     */
    protected array $optionTools = [];

    protected ?Component $messages = null;

    protected bool $isLoadAgentPlugin = false;

    /**
     * @var array<AgentPluginInterface> Agent 插件
     */
    protected array $agentPlugins = [];

    public function getAgentPlugins(): array
    {
        return $this->agentPlugins;
    }

    public function loadAgentPlugin(array $params): array
    {
        if (! $this->isLoadAgentPlugin) {
            return [];
        }
        // 加载插件的配置
        $agentParams = [];
        foreach (AgentPluginCollector::list() as $plugin) {
            $agentPlugin = $plugin->createAgentPlugin();
            // 解析插件参数
            $agentParams = array_merge($agentParams, $agentPlugin->parseParams($params));
            // 注入本次运行时使用的插件
            $this->agentPlugins[] = $agentPlugin;
        }
        return $agentParams;
    }

    public function getMessages(): ?Component
    {
        return $this->messages;
    }

    public function getModel(): Component
    {
        return $this->model;
    }

    public function getSystemPrompt(): ?Component
    {
        return $this->systemPrompt ?? null;
    }

    public function getUserPrompt(): ?Component
    {
        return $this->userPrompt ?? null;
    }

    public function getModelConfig(): ModelConfig
    {
        return $this->modelConfig;
    }

    public function getTools(): array
    {
        return $this->tools;
    }

    /**
     * @return array<OptionTool>
     */
    public function getOptionTools(): array
    {
        return $this->optionTools;
    }

    public function addOptionTool(string $toolId, OptionTool $optionTool): void
    {
        $this->optionTools[$toolId] = $optionTool;
    }

    protected function createOptionsToolsByParams(array $optionTools = []): void
    {
        foreach ($optionTools as $optionTool) {
            if (empty($optionTool['tool_id']) || empty($optionTool['tool_set_id'])) {
                continue;
            }
            $customSystemInput = new NodeInput();
            $customSystemInput->setForm(ComponentFactory::fastCreate($optionTool['custom_system_input']['form'] ?? null));
            $this->optionTools[$optionTool['tool_id']] = new OptionTool(
                $optionTool['tool_id'],
                $optionTool['tool_set_id'],
                (bool) ($optionTool['async'] ?? false),
                $customSystemInput
            );
        }
    }

    protected function formatModel(mixed $model): Component
    {
        $modelComponent = null;
        if (is_string($model)) {
            $modelComponent = $this->createModelComponentByName($model);
        } elseif (is_array($model)) {
            $modelComponent = ComponentFactory::fastCreate($model);
        }
        if (! $modelComponent?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.model.empty');
        }
        return $modelComponent;
    }

    protected function createModelComponentByName(string $modelName): Component
    {
        return ComponentFactory::generateTemplate(StructureType::Value, [
            'type' => 'expression',
            'const_value' => null,
            'expression_value' => [
                [
                    'type' => 'input',
                    'value' => $modelName,
                    'name' => $modelName,
                    'args' => null,
                ],
            ],
        ]);
    }
}
