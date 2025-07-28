<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\LLM;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\Memory\MemoryQuery;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\AbstractLLMNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\ModelConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\OptionTool;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\TempAuth\TempAuthInterface;
use App\Infrastructure\Util\Odin\Agent;
use App\Infrastructure\Util\Odin\AgentFactory;
use DateTime;
use Dtyq\FlowExprEngine\Component;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Mcp\McpServerManager;
use Hyperf\Odin\Memory\MemoryManager;
use Hyperf\Odin\Message\SystemMessage;
use Hyperf\Odin\Model\AbstractModel;

abstract class AbstractLLMNodeRunner extends NodeRunner
{
    protected function createAgent(
        ExecutionData $executionData,
        VertexResult $vertexResult,
        AbstractLLMNodeParamsConfig $LLMNodeParamsConfig,
        MemoryManager $memoryManager,
        string $systemPrompt,
        null|AbstractModel|ModelInterface $model = null,
    ): Agent {
        $orgCode = $executionData->getOperator()->getOrganizationCode();
        $modelName = $LLMNodeParamsConfig->getModel()->getValue()->getResult($executionData->getExpressionFieldData());
        if (! $model) {
            $model = $this->modelGatewayMapper->getChatModelProxy($modelName, $orgCode);
        }
        $vertexResult->addDebugLog('model', $modelName);

        // 加载 Agent 插件
        $this->loadAgentPlugins($executionData->getDataIsolation(), $model, $LLMNodeParamsConfig, $systemPrompt);

        $vertexResult->addDebugLog('actual_system_prompt', $systemPrompt);

        $vertexResult->addDebugLog('messages', array_map(fn ($message) => $message->toArray(), $memoryManager->applyPolicy()->getProcessedMessages()));

        // 加载系统提示词
        if ($systemPrompt !== '') {
            $memoryManager->addSystemMessage(new SystemMessage($systemPrompt));
        }

        // 生成 function call 的 tools 格式
        $tools = $this->createTools($executionData, $LLMNodeParamsConfig->getOptionTools(), $LLMNodeParamsConfig->getTools());
        $vertexResult->addDebugLog('tools', ToolsExecutor::toolsToArray($tools));

        return AgentFactory::create(
            model: $model,
            memoryManager: $memoryManager,
            tools: $tools,
            temperature: $LLMNodeParamsConfig->getModelConfig()->getTemperature(),
            businessParams: [
                'organization_id' => $orgCode,
                'user_id' => $executionData->getOperator()->getUid(),
                'business_id' => $executionData->getAgentId(),
                'source_id' => $executionData->getOperator()->getSourceId(),
                'user_name' => $executionData->getOperator()->getNickname(),
            ],
        );
    }

    protected function loadAgentPlugins(FlowDataIsolation $flowDataIsolation, ModelInterface $model, AbstractLLMNodeParamsConfig $LLMNodeParamsConfig, string &$systemPrompt): void
    {
        $mcpServerConfigs = [];
        // 加载 Agent 的插件。一般就是加载工具和追加系统提示词，先做着两个的吧
        foreach ($LLMNodeParamsConfig->getAgentPlugins() as $agentPlugin) {
            $appendSystemPrompt = $agentPlugin->getAppendSystemPrompt();
            if ($appendSystemPrompt !== '') {
                $systemPrompt = $systemPrompt . "\n" . $appendSystemPrompt;
            }
            foreach ($agentPlugin->getTools() as $tool) {
                $optionTool = new OptionTool(
                    $tool->getCode(),
                    $tool->getToolSetCode(),
                    false,
                    $tool->getCustomSystemInput(),
                );
                $LLMNodeParamsConfig->addOptionTool($tool->getCode(), $optionTool);
            }
            $mcpServerConfigs = array_merge($mcpServerConfigs, $agentPlugin->getMcpServerConfigs());
        }
        if ($mcpServerConfigs) {
            $tempAuth = di(TempAuthInterface::class);
            foreach ($mcpServerConfigs as $code => $mcpServerConfig) {
                if (str_starts_with($mcpServerConfig->getUrl(), LOCAL_HTTP_URL)) {
                    $token = $tempAuth->create([
                        'user_id' => $flowDataIsolation->getCurrentUserId(),
                        'organization_code' => $flowDataIsolation->getCurrentOrganizationCode(),
                        'server_code' => $code,
                    ], 1800);
                    $mcpServerConfig->setToken($token);
                }
            }
            $model->registerMcpServerManager(new McpServerManager($mcpServerConfigs));
        }
    }

    protected function createMemoryManager(ExecutionData $executionData, VertexResult $vertexResult, ModelConfig $modelConfig, ?Component $messagesComponent = null, array $ignoreMessageIds = []): MemoryManager
    {
        if ($modelConfig->isAutoMemory()) {
            $memoryQuery = new MemoryQuery(
                executionType: $executionData->getExecutionType(),
                conversationId: $executionData->getConversationId(),
                originConversationId: $executionData->getOriginConversationId(),
                topicId: $executionData->getTopicId(),
                limit: $modelConfig->getMaxRecord(),
            );
            // 如果来源的是第三方聊天工具，仅获取最近 3 小时的记忆
            if ($executionData->isThirdPlatformChat()) {
                $memoryQuery->setStartTime(new DateTime('-3 hours'));
            }
            $memoryManager = $this->flowMemoryManager->createMemoryManagerByAuto($memoryQuery, $ignoreMessageIds);
        } else {
            // 手动记忆
            $messages = $messagesComponent?->getForm()?->getKeyValue($executionData->getExpressionFieldData()) ?? [];
            $memoryManager = $this->flowMemoryManager->createMemoryManagerByArray($messages);
        }
        $vertexResult->addDebugLog('messages', array_map(fn ($message) => $message->toArray(), $memoryManager->getProcessedMessages()));
        return $memoryManager;
    }

    protected function contentIsInSystemPrompt(ExecutionData $executionData): bool
    {
        /** @var AbstractLLMNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $flow = $executionData->getMagicFlowEntity();
        $startNodeId = $flow?->getStartNode()?->getNodeId();
        if ($startNodeId) {
            $systemNodeId = $flow?->getStartNode()->getSystemNodeId();
            $startNodeMessageFieldsValue = [
                $startNodeId . '.message_content', $startNodeId . '.content',
                $systemNodeId . '.message_content', $systemNodeId . '.content',
            ];
            foreach ($paramsConfig->getSystemPrompt()?->getValue()?->getAllFieldsExpressionItem() ?? [] as $expressionItem) {
                if (in_array($expressionItem->getValue(), $startNodeMessageFieldsValue, true)) {
                    return true;
                }
            }
        }
        return false;
    }

    protected function contentIsInUserPrompt(ExecutionData $executionData): bool
    {
        /** @var AbstractLLMNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $flow = $executionData->getMagicFlowEntity();
        $startNodeId = $flow?->getStartNode()?->getNodeId();
        if ($startNodeId) {
            $systemNodeId = $flow?->getStartNode()->getSystemNodeId();
            $startNodeMessageFieldsValue = [
                $startNodeId . '.message_content', $startNodeId . '.content',
                $systemNodeId . '.message_content', $systemNodeId . '.content',
            ];
            foreach ($paramsConfig->getUserPrompt()?->getValue()?->getAllFieldsExpressionItem() ?? [] as $expressionItem) {
                if (in_array($expressionItem->getValue(), $startNodeMessageFieldsValue, true)) {
                    return true;
                }
            }
        }
        return false;
    }

    private function createTools(ExecutionData $executionData, array $optionTools = [], array $tools = []): array
    {
        // 兼容旧数据
        foreach ($tools as $toolId) {
            if (is_string($toolId)) {
                $optionTools[$toolId] = new OptionTool($toolId);
            }
        }

        return ToolsExecutor::createTools($executionData->getDataIsolation(), $executionData, $optionTools);
    }
}
