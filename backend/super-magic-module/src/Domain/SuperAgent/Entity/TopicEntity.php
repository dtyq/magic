<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Throwable;

/**
 * 话题实体.
 */
class TopicEntity extends AbstractEntity
{
    /**
     * @var int 话题ID
     */
    protected int $id;

    /**
     * @var string 用户ID
     */
    protected string $userId;

    /**
     * @var string 用户组织编码
     */
    protected string $userOrganizationCode = '';

    /**
     * @var int 工作区ID
     */
    protected int $workspaceId = 0;

    /**
     * @var int 项目ID
     */
    protected int $projectId = 0;

    /**
     * @var string Chat话题ID
     */
    protected string $chatTopicId = '';

    /**
     * @var string Chat会话ID
     */
    protected string $chatConversationId = '';

    /**
     * @var string 沙箱ID
     */
    protected string $sandboxId = '';

    /**
     * @var null|string 沙箱配置信息（JSON字符串）
     */
    protected ?string $sandboxConfig = null;

    /**
     * @var string 工作目录
     */
    protected string $workDir = '';

    /**
     * @var string 话题名称
     */
    protected string $topicName = '';

    /**
     * @var null|string 话题描述
     */
    protected ?string $description = null;

    /**
     * @var string 任务模式（chat: 聊天模式, plan: 规划模式）
     */
    protected string $taskMode = 'chat';

    /**
     * @var string 话题模式 (支持自定义字符串)
     */
    protected string $topicMode = '';

    /**
     * @var float 话题成本
     */
    protected float $cost = 0.0;

    /**
     * @var null|int 当前任务ID
     */
    protected ?int $currentTaskId = null;

    /**
     * @var null|TaskStatus 当前任务状态
     */
    protected ?TaskStatus $currentTaskStatus = null;

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

    /**
     * @var string 创建者用户ID
     */
    protected string $createdUid = '';

    /**
     * @var string 更新者用户ID
     */
    protected string $updatedUid = '';

    /**
     * @var string commit hash
     */
    protected ?string $workspaceCommitHash = '';

    protected ?string $chatHistoryCommitHash = '';

    public function __construct(array $data = [])
    {
        $this->initProperty($data);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id ?? 0,
            'user_id' => $this->userId ?? 0,
            'user_organization_code' => $this->userOrganizationCode ?? '',
            'workspace_id' => $this->workspaceId ?? 0,
            'project_id' => $this->projectId ?? 0,
            'chat_topic_id' => $this->chatTopicId ?? '',
            'chat_conversation_id' => $this->chatConversationId ?? '',
            'sandbox_id' => $this->sandboxId ?? '',
            'sandbox_config' => $this->sandboxConfig,
            'work_dir' => $this->workDir ?? '',
            'topic_name' => $this->topicName ?? '',
            'description' => $this->description,
            'task_mode' => $this->taskMode ?? 'chat',
            'topic_mode' => $this->topicMode,
            'cost' => $this->cost ?? 0.0,
            'current_task_id' => $this->currentTaskId,
            'current_task_status' => $this->currentTaskStatus?->value,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
            'created_uid' => $this->createdUid,
            'updated_uid' => $this->updatedUid,
            'workspace_commit_hash' => $this->workspaceCommitHash,
            'chat_history_commit_hash' => $this->chatHistoryCommitHash,
        ];

        // 移除null值
        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId($id): self
    {
        // 当输入不是整数时进行转换
        if (! is_int($id)) {
            $id = (int) $id;
        }

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

    public function getUserOrganizationCode(): string
    {
        return $this->userOrganizationCode;
    }

    public function setUserOrganizationCode(string $userOrganizationCode): self
    {
        $this->userOrganizationCode = $userOrganizationCode;
        return $this;
    }

    public function getWorkspaceId(): int
    {
        return $this->workspaceId;
    }

    public function setWorkspaceId($workspaceId): self
    {
        // 当输入不是整数时进行转换
        if (! is_int($workspaceId)) {
            $workspaceId = (int) $workspaceId;
        }

        $this->workspaceId = $workspaceId;
        return $this;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId($projectId): self
    {
        // 当输入不是整数时进行转换
        if (! is_int($projectId)) {
            $projectId = (int) $projectId;
        }

        $this->projectId = $projectId;
        return $this;
    }

    /**
     * 获取Chat话题ID.
     */
    public function getChatTopicId(): string
    {
        return $this->chatTopicId;
    }

    /**
     * 设置Chat话题ID.
     */
    public function setChatTopicId(string $chatTopicId): self
    {
        $this->chatTopicId = $chatTopicId;
        return $this;
    }

    /**
     * 获取Chat会话ID.
     */
    public function getChatConversationId(): string
    {
        return $this->chatConversationId;
    }

    /**
     * 设置Chat会话ID.
     */
    public function setChatConversationId(string $chatConversationId): self
    {
        $this->chatConversationId = $chatConversationId;
        return $this;
    }

    /**
     * 获取沙箱ID.
     */
    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    /**
     * 设置沙箱ID.
     */
    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    /**
     * 获取沙箱配置.
     */
    public function getSandboxConfig(): ?string
    {
        return $this->sandboxConfig;
    }

    /**
     * 设置沙箱配置.
     */
    public function setSandboxConfig(?string $sandboxConfig): self
    {
        $this->sandboxConfig = $sandboxConfig;
        return $this;
    }

    /**
     * 获取工作目录.
     */
    public function getWorkDir(): string
    {
        return $this->workDir;
    }

    /**
     * 设置工作目录.
     */
    public function setWorkDir(string $workDir): self
    {
        $this->workDir = $workDir;
        return $this;
    }

    public function getTopicName(): string
    {
        return $this->topicName;
    }

    public function setTopicName(string $topicName): self
    {
        $this->topicName = $topicName;
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;
        return $this;
    }

    public function getCurrentTaskId(): ?int
    {
        return $this->currentTaskId;
    }

    public function setCurrentTaskId($currentTaskId): self
    {
        // 当输入不是整数时进行转换
        if ($currentTaskId !== null && ! is_int($currentTaskId)) {
            $currentTaskId = (int) $currentTaskId;
        }

        $this->currentTaskId = $currentTaskId;
        return $this;
    }

    public function getCurrentTaskStatus(): ?TaskStatus
    {
        return $this->currentTaskStatus;
    }

    public function setCurrentTaskStatus($currentTaskStatus): self
    {
        // 如果输入不是TaskStatus类型但不为空，尝试转换
        if ($currentTaskStatus !== null && ! ($currentTaskStatus instanceof TaskStatus)) {
            try {
                $currentTaskStatus = TaskStatus::from($currentTaskStatus);
            } catch (Throwable $e) {
                // 转换失败时设为null
                $currentTaskStatus = null;
            }
        }

        $this->currentTaskStatus = $currentTaskStatus;
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
     * 获取创建者用户ID.
     */
    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    /**
     * 设置创建者用户ID.
     * @param mixed $createdUid
     */
    public function setCreatedUid($createdUid): self
    {
        // 如果传入null，则设置为空字符串
        $this->createdUid = $createdUid === null ? '' : (string) $createdUid;
        return $this;
    }

    /**
     * 获取更新者用户ID.
     */
    public function getUpdatedUid(): string
    {
        return $this->updatedUid;
    }

    /**
     * 设置更新者用户ID.
     * @param mixed $updatedUid
     */
    public function setUpdatedUid($updatedUid): self
    {
        // 如果传入null，则设置为空字符串
        $this->updatedUid = $updatedUid === null ? '' : (string) $updatedUid;
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
     * 获取话题模式.
     */
    public function getTopicMode(): string
    {
        return $this->topicMode;
    }

    /**
     * 设置话题模式.
     */
    public function setTopicMode(string $topicMode): self
    {
        $this->topicMode = $topicMode;
        return $this;
    }

    /**
     * 获取话题成本.
     */
    public function getCost(): float
    {
        return $this->cost;
    }

    /**
     * 设置话题成本.
     * @param mixed $cost
     */
    public function setCost($cost): self
    {
        // 当输入不是浮点数时进行转换
        if (! is_float($cost)) {
            $cost = (float) $cost;
        }

        $this->cost = $cost;
        return $this;
    }

    public function getWorkspaceCommitHash(): string
    {
        return $this->workspaceCommitHash;
    }

    public function setWorkspaceCommitHash(?string $workspaceCommitHash): self
    {
        $this->workspaceCommitHash = $workspaceCommitHash;
        return $this;
    }

    public function getChatHistoryCommitHash(): string
    {
        return $this->chatHistoryCommitHash;
    }

    public function setChatHistoryCommitHash(?string $chatHistoryCommitHash): self
    {
        $this->chatHistoryCommitHash = $chatHistoryCommitHash;
        return $this;
    }
}
