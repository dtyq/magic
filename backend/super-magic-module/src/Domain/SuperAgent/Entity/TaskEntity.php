<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;

/**
 * 任务实体.
 */
class TaskEntity extends AbstractEntity
{
    /**
     * @var int 主键ID
     */
    protected int $id = 0;

    /**
     * @var string 用户ID
     */
    protected string $userId = '';

    /**
     * @var int 工作区ID
     */
    protected int $workspaceId = 0;

    /**
     * @var int 项目ID
     */
    protected int $projectId = 0;

    /**
     * @var int 话题ID
     */
    protected int $topicId = 0;

    /**
     * @var string 任务ID（沙箱服务返回的）
     */
    protected string $taskId = '';

    /**
     * @var string 沙箱ID
     */
    protected string $sandboxId = '';

    /**
     * @var string 用户的问题
     */
    protected string $prompt = '';

    /**
     * @var string 用户上传的附件信息(JSON格式)
     */
    protected string $attachments = '';

    /**
     * @var string 提及信息(JSON格式)
     */
    protected ?string $mentions;

    /**
     * @var string 任务状态
     */
    protected string $taskStatus = '';

    /**
     * @var string 工作区目录
     */
    protected string $workDir = '';

    /**
     * @var string 任务模式（chat: 聊天模式, plan: 规划模式）
     */
    protected string $taskMode = 'chat';

    /**
     * @var null|string 错误信息
     */
    protected ?string $errMsg = null;

    /**
     * @var null|string 会话ID
     */
    protected ?string $conversationId = null;

    /**
     * @var null|string 创建时间
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string 更新时间
     */
    protected ?string $updatedAt = null;

    /**
     * @var null|string 删除时间
     */
    protected ?string $deletedAt = null;

    public function __construct(array $data = [])
    {
        // 默认设置
        $this->taskStatus = TaskStatus::WAITING->value;
        parent::__construct($data);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'user_id' => $this->userId,
            'workspace_id' => $this->workspaceId,
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'task_id' => $this->taskId,
            'sandbox_id' => $this->sandboxId,
            'prompt' => $this->prompt,
            'attachments' => $this->attachments,
            'mentions' => $this->getMentions(),
            'task_status' => $this->taskStatus,
            'work_dir' => $this->workDir,
            'task_mode' => $this->taskMode,
            'err_msg' => $this->errMsg,
            'conversation_id' => $this->conversationId,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];

        // 移除null值
        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }

    /**
     * Create DTO from array.
     */
    public static function fromArray(array $data): self
    {
        return new self([
            'id' => $data['id'] ?? $data['Id'] ?? 0,
            'user_id' => $data['user_id'] ?? $data['userId'] ?? '',
            'workspace_id' => $data['workspace_id'] ?? $data['workspaceId'] ?? 0,
            'project_id' => $data['project_id'] ?? $data['projectId'] ?? 0,
            'topic_id' => $data['topic_id'] ?? $data['topicId'] ?? 0,
            'task_id' => $data['task_id'] ?? $data['taskId'] ?? '',
            'sandbox_id' => $data['sandbox_id'] ?? $data['sandboxId'] ?? '',
            'prompt' => $data['prompt'] ?? '',
            'attachments' => $data['attachments'] ?? '',
            'mentions' => $data['mentions'] ?? null,
            'task_status' => $data['task_status'] ?? $data['taskStatus'] ?? TaskStatus::WAITING->value,
            'work_dir' => $data['work_dir'] ?? $data['workDir'] ?? '',
            'task_mode' => $data['task_mode'] ?? $data['taskMode'] ?? 'chat',
            'err_msg' => $data['err_msg'] ?? $data['errMsg'] ?? null,
            'conversation_id' => $data['conversation_id'] ?? $data['conversationId'] ?? null,
            'created_at' => $data['created_at'] ?? $data['createdAt'] ?? null,
            'updated_at' => $data['updated_at'] ?? $data['updatedAt'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? $data['deletedAt'] ?? null,
        ]);
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getWorkspaceId(): int
    {
        return $this->workspaceId;
    }

    public function setWorkspaceId(int $workspaceId): self
    {
        $this->workspaceId = $workspaceId;
        return $this;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function setTopicId(int $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(string $prompt): self
    {
        $this->prompt = $prompt;
        return $this;
    }

    public function getAttachments(): string
    {
        return $this->attachments;
    }

    public function setAttachments(string $attachments): self
    {
        $this->attachments = $attachments;
        return $this;
    }

    public function getMentions(): ?string
    {
        return $this->mentions ?? null;
    }

    public function setMentions(?string $mentions): self
    {
        $this->mentions = $mentions;
        return $this;
    }

    public function getTaskStatus(): string
    {
        return $this->taskStatus;
    }

    public function setTaskStatus(string $taskStatus): self
    {
        $this->taskStatus = $taskStatus;
        return $this;
    }

    /**
     * 设置任务状态（TaskStatus 枚举类型）.
     */
    public function setStatus(TaskStatus $status): self
    {
        $this->taskStatus = $status->value;
        return $this;
    }

    /**
     * 获取任务状态（TaskStatus 枚举类型）.
     */
    public function getStatus(): TaskStatus
    {
        return TaskStatus::from($this->taskStatus);
    }

    public function getWorkDir(): string
    {
        return $this->workDir;
    }

    public function setWorkDir(string $workDir): self
    {
        $this->workDir = $workDir;
        return $this;
    }

    public function getConversationId(): ?string
    {
        return $this->conversationId;
    }

    public function setConversationId(?string $conversationId): self
    {
        $this->conversationId = $conversationId;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    /**
     * 获取任务模式.
     */
    public function getTaskMode(): string
    {
        return $this->taskMode;
    }

    /**
     * 设置任务模式.
     */
    public function setTaskMode(string $taskMode): self
    {
        $this->taskMode = $taskMode;
        return $this;
    }

    /**
     * 获取错误信息.
     */
    public function getErrMsg(): ?string
    {
        return $this->errMsg;
    }

    /**
     * 设置错误信息.
     */
    public function setErrMsg(?string $errMsg): self
    {
        $this->errMsg = $errMsg;
        return $this;
    }
}
