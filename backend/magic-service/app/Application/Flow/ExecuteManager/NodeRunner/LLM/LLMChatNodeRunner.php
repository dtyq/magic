<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\LLM;

use App\Application\Flow\ExecuteManager\Compressible\CompressibleContent;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\LLMChatNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use Hyperf\Odin\Agent\Tool\UsedTool;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\UserMessage;
use Hyperf\Odin\Message\UserMessageContent;

#[FlowNodeDefine(type: NodeType::LLM->value, code: NodeType::LLM->name, name: '大模型调用', paramsConfig: LLMChatNodeParamsConfig::class, version: 'v0', singleDebug: true, needInput: false, needOutput: true)]
class LLMChatNodeRunner extends AbstractLLMNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var LLMChatNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $paramsConfig->getSystemPrompt()->getValue()?->getExpressionValue()?->setIsStringTemplate(true);
        $systemPrompt = (string) $paramsConfig->getSystemPrompt()->getValue()->getResult($executionData->getExpressionFieldData());
        $vertexResult->addDebugLog('system_prompt', $systemPrompt);

        $paramsConfig->getUserPrompt()->getValue()?->getExpressionValue()?->setIsStringTemplate(true);
        $userPrompt = (string) $paramsConfig->getUserPrompt()->getValue()->getResult($executionData->getExpressionFieldData());
        $vertexResult->addDebugLog('user_prompt', $userPrompt);

        // system 中是否包含 content
        $systemHasContent = $this->contentIsInSystemPrompt($executionData);
        // user 中是否包含 content
        $userHasContent = $this->contentIsInUserPrompt($executionData);
        if ($frontResults['force_user_has_content'] ?? false) {
            $userHasContent = true;
        }

        $ignoreMessageIds = [];
        if ($systemHasContent || $userHasContent) {
            $ignoreMessageIds = [$executionData->getTriggerData()->getMessageEntity()->getMagicMessageId()];
        }

        // 加载记忆
        $memoryManager = $this->createMemoryManager($executionData, $vertexResult, $paramsConfig->getModelConfig(), $paramsConfig->getMessages(), $ignoreMessageIds);

        $contentMessageId = $executionData->getTriggerData()->getMessageEntity()->getMagicMessageId();
        $contentMessage = $currentMessage = null;
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
                    $memoryManager->addMessage($contentMessage);
                }
            } else {
                // 创建一个新的，在后续使用
                $currentMessage = new UserMessage();
                $currentMessage->setContent($userPrompt);
            }
        }

        $agent = $this->createAgent($executionData, $vertexResult, $paramsConfig, $memoryManager, $systemPrompt);

        $chatCompletionResponse = $agent->chat($currentMessage);
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

        $vertexResult->addDebugLog('reasoning', $reasoningResponseText);
        $vertexResult->addDebugLog('used_tools', array_map(function (UsedTool $useTool) {
            return $useTool->toArray();
        }, $agent->getUsedTools()));

        $result = [
            'text' => $responseText,
            'use_tools' => array_map(function (UsedTool $useTool) {
                return [
                    'tool_name' => $useTool->getName(),
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
}
