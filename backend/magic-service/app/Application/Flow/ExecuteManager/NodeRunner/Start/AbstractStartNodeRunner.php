<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Start;

use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\Attachment\AttachmentUtil;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\Memory\LLMMemoryMessage;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Chat\DTO\Message\ChatMessage\AIImageCardMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\VoiceMessage;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\MagicFlowMessage;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\StartNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\Branch;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Tiptap\TiptapUtil;
use Carbon\Carbon;
use Hyperf\Context\ApplicationContext;
use Hyperf\Odin\Message\Role;
use Throwable;

abstract class AbstractStartNodeRunner extends NodeRunner
{
    protected function chatMessage(VertexResult $vertexResult, ExecutionData $executionData, ?Branch $triggerBranch = null): array
    {
        if ($triggerBranch) {
            $vertexResult->setChildrenIds($triggerBranch->getNextNodes());
        }

        $result = $this->getChatMessageResult($executionData);
        // content 或者 files 同时为空
        if ($result['content'] === '' && empty($result['files'])) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.start.content_empty');
        }

        $LLMMemoryMessage = new LLMMemoryMessage(Role::User, $result['content'], $executionData->getTriggerData()->getMessageEntity()->getMagicMessageId());
        $LLMMemoryMessage->setConversationId($executionData->getConversationId());
        $LLMMemoryMessage->setMessageId($executionData->getTriggerData()->getMessageEntity()->getMagicMessageId());
        $LLMMemoryMessage->setAttachments($executionData->getTriggerData()->getAttachments());
        $LLMMemoryMessage->setOriginalContent(
            MagicFlowMessage::createContent(
                message: $executionData->getTriggerData()->getMessageEntity()->getContent(),
                attachments: $executionData->getTriggerData()->getAttachments()
            )
        );
        $LLMMemoryMessage->setTopicId($executionData->getTopicIdString());
        $LLMMemoryMessage->setRequestId($executionData->getId());
        $LLMMemoryMessage->setUid($executionData->getOperator()->getUid());
        $this->flowMemoryManager->receive(
            memoryType: $this->getMemoryType($executionData),
            LLMMemoryMessage: $LLMMemoryMessage,
            nodeDebug: $this->isNodeDebug($executionData),
        );
        return $result;
    }

    protected function openChatWindow(VertexResult $vertexResult, ExecutionData $executionData, Branch $triggerBranch): array
    {
        $vertexResult->clearChildren();
        $userEntity = $executionData->getTriggerData()->getUserEntity();
        $openChatTime = $executionData->getTriggerData()->getTriggerTime();
        $result = [
            'user_id' => $userEntity->getUserId(),
            'nickname' => $userEntity->getNickname(),
            'open_time' => $openChatTime->format('Y-m-d H:i:s'),
            'organization_code' => $executionData->getDataIsolation()->getCurrentOrganizationCode(),
            'conversation_id' => $executionData->getConversationId(),
            'topic_id' => $executionData->getTopicIdString(),
        ];

        // Get the last time the opening was triggered
        $key = 'open_chat_notice_' . $executionData->getConversationId();
        $lastNoticeTime = $this->cache->get($key);

        // If there is no last time, or the seconds since the last time have exceeded, then it needs to be executed
        $config = $triggerBranch->getConfig();
        $intervalSeconds = $this->getIntervalSeconds($config['interval'] ?? 0, $config['unit'] ?? '');
        if (! $lastNoticeTime || (Carbon::make($openChatTime)->diffInSeconds(Carbon::make($lastNoticeTime)) > $intervalSeconds)) {
            $vertexResult->setChildrenIds($triggerBranch->getNextNodes());
            $this->cache->set($key, Carbon::now()->toDateTimeString(), $intervalSeconds);
        }
        return $result;
    }

    protected function addFriend(VertexResult $vertexResult, ExecutionData $executionData, Branch $triggerBranch): array
    {
        $vertexResult->setChildrenIds($triggerBranch->getNextNodes());

        $userEntity = $executionData->getTriggerData()->getUserEntity();
        $accountEntity = $executionData->getTriggerData()->getAccountEntity();
        return [
            'user' => [
                'id' => $userEntity->getUserId(),
                'nickname' => $userEntity->getNickname(),
                'real_name' => $accountEntity?->getRealName() ?? '',
            ],
            'add_time' => $executionData->getTriggerData()->getTriggerTime()->format('Y-m-d H:i:s'),
        ];
    }

    protected function paramCall(VertexResult $vertexResult, ExecutionData $executionData, Branch $triggerBranch): array
    {
        $vertexResult->setChildrenIds($triggerBranch->getNextNodes());

        $result = [];
        $outputForm = $triggerBranch->getOutput()?->getFormComponent()?->getForm();
        if ($outputForm) {
            $outputForm->appendConstValue($executionData->getTriggerData()->getParams());
            $result = $outputForm->getKeyValue(check: true);
        }

        // Add system output
        $systemOutputResult = $this->getChatMessageResult($executionData);
        $executionData->saveNodeContext($this->node->getSystemNodeId(), $systemOutputResult);
        $vertexResult->addDebugLog('system_response', $executionData->getNodeContext($this->node->getSystemNodeId()));

        // Add custom system output
        $customSystemOutput = $triggerBranch->getCustomSystemOutput()?->getFormComponent()?->getForm();
        if ($customSystemOutput) {
            $customSystemOutput->appendConstValue($executionData->getTriggerData()->getSystemParams());
            $customSystemOutputResult = $customSystemOutput->getKeyValue(check: true);
            $executionData->saveNodeContext($this->node->getCustomSystemNodeId(), $customSystemOutputResult);
        }
        $vertexResult->addDebugLog('custom_system_response', $executionData->getNodeContext($this->node->getCustomSystemNodeId()));

        return $result;
    }

    protected function routine(VertexResult $vertexResult, ExecutionData $executionData, StartNodeParamsConfig $startNodeParamsConfig): array
    {
        // Scheduled parameters, all called externally, determine which branch
        $branchId = $executionData->getTriggerData()->getParams()['branch_id'] ?? '';
        if (empty($branchId)) {
            // No branch found, run directly
            $vertexResult->setChildrenIds([]);
            return [];
        }
        $triggerBranch = $startNodeParamsConfig->getBranches()[$branchId] ?? null;
        if (! $triggerBranch) {
            $vertexResult->setChildrenIds([]);
            return [];
        }
        $vertexResult->setChildrenIds($triggerBranch->getNextNodes());
        return $executionData->getTriggerData()->getParams();
    }

    protected function getIntervalSeconds(int $interval, string $unit): int
    {
        return match ($unit) {
            'minutes', 'minute' => $interval * 60,
            'hours', 'hour' => $interval * 3600,
            'seconds', 'second' => $interval,
            default => ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.start.unsupported_unit', ['unit' => $unit]),
        };
    }

    private function getChatMessageResult(ExecutionData $executionData): array
    {
        // Process into current parameter format
        $userEntity = $executionData->getTriggerData()->getUserEntity();
        $messageEntity = $executionData->getTriggerData()->getMessageEntity();

        // Process attachments
        $this->appendAttachments($executionData, $messageEntity);

        // Other types of messages to be supplemented
        switch ($messageEntity->getMessageType()) {
            case ChatMessageType::Text:
            case ChatMessageType::Markdown:
                $content = $messageEntity->getContent()->toArray()['content'] ?? '';
                break;
            case ChatMessageType::RichText:
                $richContent = $messageEntity->getContent()->toArray()['content'] ?? '';
                $content = TiptapUtil::getTextContent($richContent);
                if (trim($content) === '') {
                    $content = $richContent;
                }
                break;
            case ChatMessageType::File:
            case ChatMessageType::Files:
            case ChatMessageType::Image:
            case ChatMessageType::Video:
            case ChatMessageType::Attachment:
                $content = '';
                break;
            case ChatMessageType::Voice:
                $content = $this->handleVoiceMessage($messageEntity, $executionData);
                break;
            case ChatMessageType::AIImageCard:
                /** @var AIImageCardMessage $messageContent */
                $messageContent = $messageEntity->getContent();
                $content = $messageContent->getText();
                break;
            default:
                $this->logger->error('unsupported_message_type', ['message_type' => $messageEntity->getMessageType()->getName()]);
                return [];
        }
        $content = trim($content);
        return [
            'user_id' => $userEntity->getUserId(),
            'nickname' => $userEntity->getNickname(),
            'chat_time' => $executionData->getTriggerData()->getTriggerTime()->format('Y-m-d H:i:s'),
            'message_type' => $messageEntity->getMessageType()->getName(),
            'message_content' => $content,
            'content' => $content,
            'files' => array_map(function (AbstractAttachment $attachment) {
                return [
                    'chat_file_id' => $attachment->getChatFileId(),
                    'file_name' => $attachment->getName(),
                    'file_url' => $attachment->getUrl(),
                    'file_ext' => $attachment->getExt(),
                    'file_size' => $attachment->getSize(),
                ];
            }, $executionData->getTriggerData()->getAttachments()),
            'organization_code' => $executionData->getDataIsolation()->getCurrentOrganizationCode(),
            'conversation_id' => $executionData->getConversationId(),
            'topic_id' => $executionData->getTopicIdString(),
        ];
    }

    private function appendAttachments(ExecutionData $executionData, MagicMessageEntity $messageEntity): void
    {
        $attachments = AttachmentUtil::getByMagicMessageEntity($messageEntity);
        foreach ($attachments as $attachment) {
            $executionData->getTriggerData()->addAttachment($attachment);
        }
    }

    /**
     * Handle voice messages with timing and update logic.
     */
    private function handleVoiceMessage(MagicMessageEntity $messageEntity, ExecutionData $executionData): string
    {
        $messageContent = $messageEntity->getContent();

        // Ensure it's a VoiceMessage instance
        if (! $messageContent instanceof VoiceMessage) {
            return '';
        }

        // Set magicMessageId for subsequent updates
        $messageContent->setMagicMessageId($messageEntity->getMagicMessageId());

        // Record start time
        $startTime = microtime(true);

        // Call getTextContent to get voice-to-text content
        $textContent = $messageContent->getTextContent();

        // Calculate duration
        $endTime = microtime(true);
        $duration = $endTime - $startTime;

        // If duration is greater than 1 second, update message content to database
        if ($duration > 1.0) {
            $this->updateVoiceMessageContent($messageEntity->getMagicMessageId(), $messageContent);
        }

        // Clear audio attachments as they have been converted to text content
        $executionData->getTriggerData()->setAttachments([]);

        return $textContent;
    }

    /**
     * Update voice message content to database.
     */
    private function updateVoiceMessageContent(string $magicMessageId, VoiceMessage $voiceMessage): void
    {
        try {
            $container = ApplicationContext::getContainer();
            $messageRepository = $container->get(MagicMessageRepositoryInterface::class);

            // Convert VoiceMessage to array format for update
            $messageContent = $voiceMessage->toArray();

            $messageRepository->updateMessageContent($magicMessageId, $messageContent);

            $this->logger->info('Voice message content updated successfully', [
                'magic_message_id' => $magicMessageId,
                'has_transcription' => $voiceMessage->hasTranscription(),
                'transcription_length' => strlen($voiceMessage->getTranscriptionText() ?? ''),
            ]);
        } catch (Throwable $e) {
            // Silently handle update failure, does not affect main process
            $this->logger->warning('Failed to update voice message content', [
                'magic_message_id' => $magicMessageId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
