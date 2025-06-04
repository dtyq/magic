<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\SuperAgentTool;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessage;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;

/**
 * 消息构建服务 - 专注于构建各种消息格式.
 */
class MessageBuilderDomainService
{
    /**
     * 构建初始化消息.
     *
     * @param string $userId 用户ID
     * @param array $uploadCredential 上传凭证
     * @param MessageMetadata $metaData 元数据或元数据对象
     * @param bool $isFirstTaskMessage 是否是第一次任务消息
     * @param null|array $sandboxConfig 沙箱配置
     * @param string $taskMode 任务模式
     * @return array 构建的消息
     */
    public function buildInitMessage(
        string $userId,
        array $uploadCredential,
        MessageMetadata $metaData,
        bool $isFirstTaskMessage,
        ?array $sandboxConfig,
        string $taskMode = 'chat'
    ): array {
        // 处理元数据
        $metaDataArray = $metaData;
        if ($metaData instanceof MessageMetadata) {
            $metaDataArray = $metaData->toArray();
        }

        return [
            'message_id' => (string) IdGenerator::getSnowId(),
            'user_id' => $userId,
            'type' => MessageType::Init->value,
            'fetch_workdir' => ! $isFirstTaskMessage, // 只要不是第一次创建，涉及到初始化就会去拉取沙箱
            'upload_config' => $uploadCredential,
            'message_subscription_config' => [
                'method' => 'POST',
                'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/tasks/deliver-message',
                'headers' => [
                    'token' => config('super-magic.sandbox.token', ''),
                ],
            ],
            'sts_token_refresh' => [
                'method' => 'POST',
                'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/file/refresh-sts-token',
                'headers' => [
                    'token' => config('super-magic.sandbox.token', ''),
                ],
            ],
            'metadata' => $metaDataArray,
            'project_archive' => $sandboxConfig,
            'task_mode' => $taskMode,
        ];
    }

    /**
     * 构建聊天消息.
     *
     * @param string $userId 用户ID
     * @param int $taskId 任务ID
     * @param string $contextType 上下文类型
     * @param string $prompt 用户提示
     * @param array $attachmentUrls 附件URL列表
     * @param string $taskMode 任务模式
     * @return array 构建的消息
     */
    public function buildChatMessage(
        string $userId,
        int $taskId,
        string $contextType,
        string $prompt,
        array $attachmentUrls = [],
        string $taskMode = 'chat'
    ): array {
        return [
            'message_id' => (string) IdGenerator::getSnowId(),
            'user_id' => $userId,
            'task_id' => (string) $taskId,
            'type' => MessageType::Chat->value,
            'context_type' => $contextType,
            'prompt' => $prompt,
            'attachments' => $attachmentUrls,
            'task_mode' => $taskMode,
        ];
    }

    public function buildInterruptMessage(string $userId, int $taskId, string $taskMode = 'chat', string $remark = '')
    {
        return [
            'message_id' => (string) IdGenerator::getSnowId(),
            'user_id' => $userId,
            'task_id' => (string) $taskId,
            'type' => MessageType::Chat->value,
            'context_type' => ChatInstruction::Interrupted->value,
            'prompt' => '',
            'attachments' => [],
            'task_mode' => $taskMode,
            'remark' => $remark,
        ];
    }

    /**
     * 创建通用代理消息.
     */
    public function createSuperAgentMessage(
        int $topicId,
        string $taskId,
        ?string $content,
        string $messageType,
        string $status,
        string $event,
        ?array $steps = null,
        ?array $tool = null,
        ?array $attachments = null
    ): SuperAgentMessage {
        $message = new SuperAgentMessage();
        $message->setMessageId((string) IdGenerator::getSnowId());
        $message->setTopicId((string) $topicId);
        $message->setTaskId($taskId);
        $message->setType($messageType);
        $message->setStatus($status);
        $message->setEvent($event);
        $message->setRole('assistant');
        $message->setAttachments($attachments);
        if ($content !== null) {
            $message->setContent($content);
        } else {
            $message->setContent('');
        }

        if ($tool !== null) {
            $toolObj = new SuperAgentTool([
                'id' => $tool['id'] ?? '',
                'name' => $tool['name'] ?? '',
                'action' => $tool['action'] ?? '',
                'status' => $tool['status'] ?? 'running',
                'remark' => $tool['remark'] ?? '',
                'detail' => $tool['detail'] ?? [],
                'attachments' => $tool['attachments'] ?? null,
            ]);
            $message->setTool($toolObj);
        }

        if ($steps !== null) {
            $message->setSteps($steps);
        }
        return $message;
    }
}
