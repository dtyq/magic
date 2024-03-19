<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\LLM;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\ToolNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\PromptUtil;
use Hyperf\Odin\Message\UserMessage;

#[FlowNodeDefine(type: NodeType::Tool->value, code: NodeType::Tool->name, name: '工具', paramsConfig: ToolNodeParamsConfig::class, version: 'v0', singleDebug: true, needInput: true, needOutput: true)]
class ToolNodeRunner extends AbstractLLMNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var ToolNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        // 实时获取
        $toolFlow = ToolsExecutor::getToolFlows($executionData->getDataIsolation(), [$paramsConfig->getToolId()])[0] ?? null;
        if (! $toolFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.tool.flow_not_found', ['flow_code' => $paramsConfig->getToolId()]);
        }
        $toolFlow->setCreator($executionData->getFlowCreator());

        $inputResult = [];
        if ($inputForm = $toolFlow->getInput()?->getFormComponent()?->getForm()) {
            if ($paramsConfig->getMode()->isLLM()) {
                $paramsConfig->getUserPrompt()->getValue()->getExpressionValue()?->setIsStringTemplate(true);
                $userPrompt = $paramsConfig->getUserPrompt()->getValue()->getResult($executionData->getExpressionFieldData());
                $llmInput = $this->parseInputByLLM($vertexResult, $executionData, $toolFlow, $userPrompt);
                $inputForm->appendConstValue($llmInput);
                $inputResult = $inputForm->getKeyValue(check: true, execExpression: false);
            } else {
                $inputResult = $this->node->getInput()?->getFormComponent()?->getForm()?->getKeyValue(expressionSourceData: $executionData->getExpressionFieldData(), check: true) ?? [];
            }
        }
        $vertexResult->setInput($inputResult);

        //  自定义系统输入
        $customSystemInput = $paramsConfig->getCustomSystemInput()?->getFormComponent()?->getForm()?->getKeyValue($executionData->getExpressionFieldData()) ?? [];
        $vertexResult->addDebugLog('custom_system_input', $customSystemInput);

        $result = ToolsExecutor::execute($executionData, $toolFlow, $inputResult, $customSystemInput, $paramsConfig->isAsync());

        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }

    private function parseInputByLLM(VertexResult $vertexResult, ExecutionData $executionData, MagicFlowEntity $magicFlowEntity, string $userPrompt): array
    {
        /** @var ToolNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $systemPrompt = $this->buildSystemPrompt($magicFlowEntity);
        $paramsConfig->setSystemPrompt($systemPrompt);

        // 一定是忽略当前消息
        $ignoreMessageIds = [$executionData->getTriggerData()->getMessageEntity()->getMagicMessageId()];

        $memoryManager = $this->createMemoryManager($executionData, $vertexResult, $paramsConfig->getModelConfig(), ignoreMessageIds: $ignoreMessageIds);

        $agent = $this->createAgent($executionData, $vertexResult, $paramsConfig, $memoryManager, $systemPrompt);
        $response = $agent->chat(new UserMessage($userPrompt));
        $content = (string) $response;
        $vertexResult->addDebugLog('response', $content);
        return $this->formatJson($content);
    }

    private function buildSystemPrompt(MagicFlowEntity $magicFlowEntity): string
    {
        return PromptUtil::getToolCallPrompt([':tool' => json_encode($magicFlowEntity->getInput()?->getForm()?->getForm()->toJsonSchema() ?? [], JSON_UNESCAPED_UNICODE)]);
    }
}
