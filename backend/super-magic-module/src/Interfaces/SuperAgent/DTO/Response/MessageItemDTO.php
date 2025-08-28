<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use JsonSerializable;

class MessageItemDTO implements JsonSerializable
{
    /**
     * @var int 消息ID
     */
    protected int $id;

    /**
     * @var string 角色类型(user/assistant)
     */
    protected string $role;

    /**
     * @var string 发送者ID
     */
    protected string $senderUid;

    /**
     * @var string 接收者ID
     */
    protected string $receiverUid;

    /**
     * @var string 消息ID
     */
    protected string $messageId;

    /**
     * @var string 消息类型
     */
    protected string $type;

    /**
     * @var string 任务ID
     */
    protected string $taskId;

    /**
     * @var null|string 任务状态
     */
    protected ?string $status;

    /**
     * @var string 消息内容
     */
    protected string $content;

    /**
     * @var mixed 原始消息内容
     */
    protected $rawContent;

    /**
     * @var null|array 步骤信息
     */
    protected ?array $steps;

    /**
     * @var null|array 工具调用信息
     */
    protected ?array $tool;

    /**
     * @var int 发送时间戳
     */
    protected int $sendTimestamp;

    /**
     * @var string 事件类型
     */
    protected string $event;

    /**
     * @var array 附件信息
     */
    protected array $attachments;

    /**
     * @var null|string IM状态（来自magic_chat_sequences表）
     */
    protected ?string $imStatus;

    /**
     * 构造函数.
     */
    public function __construct(array $data = [])
    {
        $this->id = (int) ($data['id'] ?? 0);
        $this->role = $data['sender_type'];
        $this->senderUid = (string) ($data['sender_uid'] ?? '');
        $this->receiverUid = (string) ($data['receiver_uid'] ?? '');
        $this->messageId = (string) ($data['message_id'] ?? '');
        $this->type = (string) ($data['type'] ?? '');
        $this->taskId = (string) ($data['task_id'] ?? '');
        $this->status = $data['status'] ?? null;
        $this->content = (string) ($data['content'] ?? '');

        // Handle raw_content: null if empty, json_decode if not empty
        $rawContentValue = $data['raw_content'] ?? null;
        if (empty($rawContentValue)) {
            $this->rawContent = null;
        } else {
            $this->rawContent = json_decode($rawContentValue, true);
        }

        $this->steps = $data['steps'] ?? null;
        $this->tool = $data['tool'] ?? null;
        $this->sendTimestamp = (int) ($data['send_timestamp'] ?? 0);
        $this->event = (string) ($data['event'] ?? '');
        $this->attachments = $data['attachments'] ?? [];
        $this->imStatus = isset($data['im_status']) ? $this->convertImStatusToString((int) $data['im_status']) : null;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'role' => $this->role,
            'sender_uid' => $this->senderUid,
            'receiver_uid' => $this->receiverUid,
            'message_id' => $this->messageId,
            'type' => $this->type,
            'task_id' => $this->taskId,
            'status' => $this->status,
            'content' => $this->content,
            'raw_content' => $this->rawContent,
            'steps' => $this->steps,
            'tool' => $this->tool,
            'send_timestamp' => $this->sendTimestamp,
            'event' => $this->event,
            'attachments' => $this->attachments,
            'im_status' => $this->imStatus,
        ];
    }

    /**
     * 序列化为JSON.
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    /**
     * 将IM状态数字转换为字符串（参考MagicMessageStatus枚举）.
     */
    private function convertImStatusToString(int $status): string
    {
        return match ($status) {
            0 => 'unread',
            1 => 'seen',
            2 => 'read',
            3 => 'revoked',
            default => 'unread',
        };
    }
}
