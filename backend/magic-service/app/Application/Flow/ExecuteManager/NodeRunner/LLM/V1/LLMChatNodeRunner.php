<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\LLM\V1;

use App\Application\Flow\ExecuteManager\Attachment\AttachmentInterface;
use App\Application\Flow\ExecuteManager\Compressible\CompressibleContent;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\Memory\MultiModal\MultiModalBuilder;
use App\Application\Flow\ExecuteManager\Memory\MultiModal\MultiModalContentFormatter;
use App\Application\Flow\ExecuteManager\NodeRunner\LLM\AbstractLLMNodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\V1\LLMChatNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\MagicFlowMessageType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\ReplyMessage\ReplyMessageNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\Flow\Service\MagicFlowMultiModalLogDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Util\Odin\Agent;
use Dtyq\FlowExprEngine\Structure\Expression\ValueType;
use Hyperf\Odin\Agent\Tool\UsedTool;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\UserMessage;
use Hyperf\Odin\Message\UserMessageContent;
use Hyperf\Odin\Tool\Definition\ToolDefinition;

#[FlowNodeDefine(
    type: NodeType::LLM->value,
    code: NodeType::LLM->name,
    name: '大模型调用',
    paramsConfig: LLMChatNodeParamsConfig::class,
    version: 'v1',
    singleDebug: true,
    needInput: false,
    needOutput: true
)]
class LLMChatNodeRunner extends AbstractLLMNodeRunner
{
    /**
     * 执行LLM聊天节点.
     *
     * @param VertexResult $vertexResult 节点执行结果
     * @param ExecutionData $executionData 执行数据
     * @param array $frontResults 前置节点结果
     */
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var LLMChatNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $modelName = $paramsConfig->getModel()->getValue()->getResult($executionData->getExpressionFieldData());
        $orgCode = $executionData->getOperator()->getOrganizationCode();
        $dataIsolation = ModelGatewayDataIsolation::createByOrganizationCodeWithoutSubscription($executionData->getDataIsolation()->getCurrentOrganizationCode(), $executionData->getDataIsolation()->getCurrentUserId());
        $model = $this->modelGatewayMapper->getChatModelProxy($dataIsolation, $modelName);

        // 默认视觉模型配置就是自己
        if ($paramsConfig->getModelConfig()->getVisionModel() === '') {
            $paramsConfig->getModelConfig()->setVisionModel($modelName);
        }

        // 如果主动关闭视觉能力。或者 当前模型支持，但是选择了别的模型，也是相当于要关闭当前模型的视觉能力
        if (! $paramsConfig->getModelConfig()->isVision() || ($model->getModelOptions()->isMultiModal() && $paramsConfig->getModelConfig()->getVisionModel() !== $modelName)) {
            $model->getModelOptions()->setMultiModal(false);
        }

        [$systemPrompt, $userPrompt] = $this->preparePrompts($vertexResult, $executionData, $paramsConfig);

        $userHasContent = false;
        $ignoreMessageIds = [];
        $checkUserContent = (bool) ($frontResults['check_user_content'] ?? true);
        if ($checkUserContent) {
            // system 中是否包含 content
            $systemHasContent = $this->contentIsInSystemPrompt($executionData);
            // user 中是否包含 content
            $userHasContent = $this->contentIsInUserPrompt($executionData);

            if ($systemHasContent || $userHasContent) {
                $ignoreMessageIds = [$executionData->getTriggerData()->getMessageEntity()->getMagicMessageId()];
            }
        }

        // 加载记忆
        $memoryManager = $this->createMemoryManager($executionData, $vertexResult, $paramsConfig->getModelConfig(), $paramsConfig->getMessages(), $ignoreMessageIds);

        // 只有自动记忆需要处理以下多模态消息
        if ($paramsConfig->getModelConfig()->isAutoMemory()) {
            $contentMessageId = $executionData->getTriggerData()->getMessageEntity()->getMagicMessageId();
            $contentMessage = null;
            // 尝试在记忆中找到 content 消息
            foreach ($memoryManager->getMessages() as $message) {
                if ($message->getIdentifier() === $contentMessageId) {
                    $contentMessage = $message;
                    break;
                }
            }
            if ($userPrompt !== '') {
                if ($userHasContent) {
                    if (! $contentMessage) {
                        $contentMessage = new UserMessage();
                        $contentMessage->setContent($userPrompt);
                        $contentMessage->setIdentifier($contentMessageId);
                        // 仅仅添加附件
                        $imageUrls = $executionData->getTriggerData()->getAttachmentImageUrls();
                        if ($imageUrls) {
                            // 有content且有附件，添加文本和图片内容
                            $contentMessage->addContent(UserMessageContent::text($userPrompt));
                            foreach ($imageUrls as $imageUrl) {
                                $contentMessage->addContent(UserMessageContent::imageUrl($imageUrl));
                            }
                        }
                        $contentMessage->setParams([
                            'attachments' => $executionData->getTriggerData()->getAttachments(),
                        ]);
                        $memoryManager->addMessage($contentMessage);
                    }
                } else {
                    // 创建一个新的，在后续使用
                    $currentMessage = new UserMessage();
                    $currentMessage->setContent($userPrompt);
                    $memoryManager->addMessage($currentMessage);
                }
            }

            // 处理当前的多模态消息 - 只有 content 的需要立刻调用去处理
            /** @var null|UserMessage $contentMessage */
            if ($contentMessage?->hasImageMultiModal() && $paramsConfig->getModelConfig()->isVision()) {
                $currentModel = $model->getModelName();
                $visionModel = $paramsConfig->getModelConfig()->getVisionModel();

                // 只有 当前模型与视觉模型不一致，或者 当前模型不支持多模态 时。在视觉模型的工具中，当前模型等于视觉模型并且具有视觉能力，就不会产生死循环
                if ($currentModel !== $visionModel || ! $model->getModelOptions()->isMultiModal()) {
                    $multiModalLoglog = MultiModalBuilder::vision(
                        executionData: $executionData,
                        visionModel: $paramsConfig->getModelConfig()->getVisionModel()
                    );
                    if ($multiModalLoglog) {
                        $contentMessage->setParams([
                            'attachments' => $executionData->getTriggerData()->getAttachments(),
                            'analysis_result' => $multiModalLoglog->getAnalysisResult(),
                        ]);
                    }
                }
            }

            // 永远处理当前节点的历史附件消息
            $magicMessageIds = [];
            foreach ($memoryManager->getMessages() as $message) {
                $magicMessageIds[] = $message->getIdentifier();
            }
            $multiModalLogs = di(MagicFlowMultiModalLogDomainService::class)->getByMessageIds($executionData->getDataIsolation(), $magicMessageIds, true);
            foreach ($memoryManager->getMessages() as $message) {
                if ($message instanceof UserMessage) {
                    $multiModalLog = $multiModalLogs[$message->getIdentifier()] ?? null;
                    if ($multiModalLog) {
                        $visionResponse = $multiModalLog->getAnalysisResult();
                    } else {
                        $visionResponse = $message->getParams()['analysis_result'] ?? '';
                    }
                    /** @var AttachmentInterface[] $attachments */
                    $attachments = $message->getParams()['attachments'] ?? [];
                    $content = MultiModalContentFormatter::formatAllAttachments(
                        $message->getContent(),
                        $visionResponse,
                        $attachments,
                    );
                    $lastMessage = clone $message;
                    $message->setContent($content);
                    $message->setContents(null);
                    // 重新组织多模态
                    if ($model->getModelOptions()->isMultiModal()) {
                        $message->addContent(UserMessageContent::text($content));
                        // 补充多模态
                        $imageUrls = [];
                        foreach ($lastMessage->getContents() ?? [] as $userContent) {
                            if (! empty($userContent->getImageUrl())) {
                                $imageUrls[] = $userContent->getImageUrl();
                                $message->addContent(UserMessageContent::imageUrl($userContent->getImageUrl()));
                            }
                        }
                        foreach ($attachments as $attachment) {
                            if ($attachment->isImage() && ! in_array($attachment->getUrl(), $imageUrls)) {
                                $message->addContent(UserMessageContent::imageUrl($attachment->getUrl()));
                            }
                        }
                    }
                }
            }
        } else {
            if ($userPrompt !== '') {
                // 创建一个新的，在后续使用
                $currentMessage = new UserMessage();
                $currentMessage->setContent($userPrompt);
                $memoryManager->addMessage($currentMessage);
            }
        }

        $agent = $this->createAgent($executionData, $vertexResult, $paramsConfig, $memoryManager, $systemPrompt, $model);

        $response = $this->executeAgent($agent, $vertexResult, $executionData);

        $vertexResult->addDebugLog('used_tools', array_map(function (UsedTool $useTool) {
            return $useTool->toArray();
        }, $agent->getUsedTools()));

        $vertexResult->addDebugLog('mcp_tools', array_map(function (ToolDefinition $toolDefinition) {
            return $toolDefinition->toArray();
        }, $agent->getMcpTools()));

        [$reasoningResponseText, $responseText] = $response;

        $result = [
            'response' => $responseText,
            'reasoning' => $reasoningResponseText,
            'tool_calls' => array_map(function (UsedTool $useTool) {
                return [
                    'name' => $useTool->getName(),
                    'success' => $useTool->isSuccess(),
                    'error_message' => $useTool->getErrorMessage(),
                    'arguments' => json_encode($useTool->getArguments(), JSON_UNESCAPED_UNICODE),
                    'call_result' => $useTool->getResult(),
                    'elapsed_time' => $useTool->getElapsedTime(),
                ];
            }, $agent->getUsedTools()),
        ];

        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }

    private function preparePrompts(VertexResult $vertexResult, ExecutionData $executionData, LLMChatNodeParamsConfig $paramsConfig): array
    {
        $paramsConfig->getSystemPrompt()->getValue()?->getExpressionValue()?->setIsStringTemplate(true);
        $systemPrompt = (string) $paramsConfig->getSystemPrompt()->getValue()->getResult($executionData->getExpressionFieldData());
        $vertexResult->addDebugLog('system_prompt', $systemPrompt);

        $paramsConfig->getUserPrompt()->getValue()?->getExpressionValue()?->setIsStringTemplate(true);
        $userPrompt = (string) $paramsConfig->getUserPrompt()->getValue()->getResult($executionData->getExpressionFieldData());

        return [$systemPrompt, $userPrompt];
    }

    /**
     * 执行代理并获取响应.
     *
     * @param Agent $agent 代理对象
     * @param VertexResult $vertexResult 节点执行结果
     * @param ExecutionData $executionData 执行数据
     * @return array [推理文本, 响应文本]
     */
    private function executeAgent(Agent $agent, VertexResult $vertexResult, ExecutionData $executionData): array
    {
        if ($executionData->isStream() && $this->isIntrovertedReplyMessageNode($vertexResult, $executionData)) {
            return $this->handleStreamedResponse($agent, $vertexResult, $executionData);
        }
        return $this->handleNormalResponse($agent, $vertexResult);
    }

    private function handleStreamedResponse(Agent $agent, VertexResult $vertexResult, ExecutionData $executionData): array
    {
        $chatCompletionChoiceGenerator = $agent->chatStreamed();
        // 内敛回复
        $frontResults['chat_completion_choice_generator'] = $chatCompletionChoiceGenerator;
        return $this->tryIntrovertedReplyMessageNode($vertexResult, $executionData, $frontResults);
    }

    private function handleNormalResponse(Agent $agent, VertexResult $vertexResult): array
    {
        $chatCompletionResponse = $agent->chat();
        $reasoningResponseText = $responseText = '';

        if ($choice = $chatCompletionResponse->getFirstChoice()) {
            $choiceMessage = $choice->getMessage();
            if ($choiceMessage instanceof AssistantMessage) {
                $responseText = $choiceMessage->getContent();
                $reasoningResponseText = $choiceMessage->getReasoningContent() ?? '';

                $vertexResult->addDebugLog('reasoning', $reasoningResponseText);
                $vertexResult->addDebugLog('origin_response', $responseText);

                // 解压
                $responseText = CompressibleContent::deCompress($responseText, false);
                $vertexResult->addDebugLog('response', $responseText);
            }
        }

        return [$reasoningResponseText, $responseText];
    }

    private function tryIntrovertedReplyMessageNode(VertexResult $vertexResult, ExecutionData $executionData, $frontResults): array
    {
        $nextNodeId = $vertexResult->getChildrenIds()[0];
        $flow = $executionData->getMagicFlowEntity();
        $nextNode = $flow?->getNodeById($nextNodeId);
        if ($nextNode?->getNodeType() !== NodeType::ReplyMessage->value) {
            return ['', ''];
        }

        $this->executeNodeIntroverted($vertexResult, $nextNode, $executionData, $frontResults);
        $responseText = $vertexResult->getDebugLog()['llm_stream_response'] ?? '';
        $reasoningResponseText = $vertexResult->getDebugLog()['llm_stream_reasoning_response'] ?? '';
        $executionData->saveNodeContext($this->node->getNodeId(), [
            'response' => $responseText,
            'reasoning' => $reasoningResponseText,
        ]);
        return [$reasoningResponseText, $responseText];
    }

    private function isIntrovertedReplyMessageNode(VertexResult $vertexResult, ExecutionData $executionData): bool
    {
        // 只有一个子节点
        if (count($vertexResult->getChildrenIds()) !== 1) {
            return false;
        }
        $nextNodeId = $vertexResult->getChildrenIds()[0];

        $flow = $executionData->getMagicFlowEntity();

        $nextNode = $flow?->getNodeById($nextNodeId);
        if ($nextNode?->getNodeType() !== NodeType::ReplyMessage->value) {
            return false;
        }
        /** @var ReplyMessageNodeParamsConfig $paramsConfig */
        $paramsConfig = $nextNode->getNodeParamsConfig();
        // 只支持 text 和 markdown
        if (! in_array($paramsConfig->getType(), [MagicFlowMessageType::Text, MagicFlowMessageType::Markdown], true)) {
            return false;
        }

        $contentValue = $paramsConfig->getContent()?->getValue();
        if (! $contentValue) {
            return false;
        }

        // 有且只有一个当前节点的表达式引用
        $expressionItems = $contentValue->getAllFieldsExpressionItem() ?? [];
        if (count($expressionItems) !== 1) {
            return false;
        }

        // 可能还有其他字符串拼接，暂时也不内敛
        $items = match ($contentValue->getType()) {
            ValueType::Const => $contentValue->getConstValue()?->getItems() ?? [],
            ValueType::Expression => $contentValue->getExpressionValue()?->getItems() ?? [],
        };
        if (count($items) !== 1) {
            return false;
        }

        $expressionItem = $expressionItems[0];
        $currentNodeOutput = ["{$this->node->getNodeId()}.text", "{$this->node->getNodeId()}.response"];
        if (! in_array($expressionItem->getValue(), $currentNodeOutput)) {
            return false;
        }

        return true;
    }
}
