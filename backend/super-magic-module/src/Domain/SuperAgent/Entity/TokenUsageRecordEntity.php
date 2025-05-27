<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

/**
 * Token使用记录实体.
 */
class TokenUsageRecordEntity extends AbstractEntity
{
    /**
     * @var int 主键ID
     */
    protected int $id = 0;

    /**
     * @var int 话题ID
     */
    protected int $topicId = 0;

    /**
     * @var string 任务ID
     */
    protected string $taskId = '';

    /**
     * @var null|string 沙箱ID
     */
    protected ?string $sandboxId = null;

    /**
     * @var string 组织代码
     */
    protected string $organizationCode = '';

    /**
     * @var string 用户ID
     */
    protected string $userId = '';

    /**
     * @var string 任务状态
     */
    protected string $taskStatus = '';

    /**
     * @var string 使用类型(summary/item)
     */
    protected string $usageType = '';

    /**
     * @var int 总输入token数
     */
    protected int $totalInputTokens = 0;

    /**
     * @var int 总输出token数
     */
    protected int $totalOutputTokens = 0;

    /**
     * @var int 总token数
     */
    protected int $totalTokens = 0;

    /**
     * @var null|string 模型ID
     */
    protected ?string $modelId = null;

    /**
     * @var null|string 模型名称
     */
    protected ?string $modelName = null;

    /**
     * @var int 缓存token数
     */
    protected int $cachedTokens = 0;

    /**
     * @var int 缓存写入token数
     */
    protected int $cacheWriteTokens = 0;

    /**
     * @var int 推理token数
     */
    protected int $reasoningTokens = 0;

    /**
     * @var null|array 完整的使用详情JSON
     */
    protected ?array $usageDetails = null;

    /**
     * @var null|string 创建时间
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string 更新时间
     */
    protected ?string $updatedAt = null;

    public function __construct(array $data = [])
    {
        $this->id = IdGenerator::getSnowId();
        $this->initProperty($data);
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

    public function getSandboxId(): ?string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(?string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
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

    public function getTaskStatus(): string
    {
        return $this->taskStatus;
    }

    public function setTaskStatus(string $taskStatus): self
    {
        $this->taskStatus = $taskStatus;
        return $this;
    }

    public function getUsageType(): string
    {
        return $this->usageType;
    }

    public function setUsageType(string $usageType): self
    {
        $this->usageType = $usageType;
        return $this;
    }

    public function getTotalInputTokens(): int
    {
        return $this->totalInputTokens;
    }

    public function setTotalInputTokens(int $totalInputTokens): self
    {
        $this->totalInputTokens = $totalInputTokens;
        return $this;
    }

    public function getTotalOutputTokens(): int
    {
        return $this->totalOutputTokens;
    }

    public function setTotalOutputTokens(int $totalOutputTokens): self
    {
        $this->totalOutputTokens = $totalOutputTokens;
        return $this;
    }

    public function getTotalTokens(): int
    {
        return $this->totalTokens;
    }

    public function setTotalTokens(int $totalTokens): self
    {
        $this->totalTokens = $totalTokens;
        return $this;
    }

    public function getModelId(): ?string
    {
        return $this->modelId;
    }

    public function setModelId(?string $modelId): self
    {
        $this->modelId = $modelId;
        return $this;
    }

    public function getModelName(): ?string
    {
        return $this->modelName;
    }

    public function setModelName(?string $modelName): self
    {
        $this->modelName = $modelName;
        return $this;
    }

    public function getCachedTokens(): int
    {
        return $this->cachedTokens;
    }

    public function setCachedTokens(int $cachedTokens): self
    {
        $this->cachedTokens = $cachedTokens;
        return $this;
    }

    public function getCacheWriteTokens(): int
    {
        return $this->cacheWriteTokens;
    }

    public function setCacheWriteTokens(int $cacheWriteTokens): self
    {
        $this->cacheWriteTokens = $cacheWriteTokens;
        return $this;
    }

    public function getReasoningTokens(): int
    {
        return $this->reasoningTokens;
    }

    public function setReasoningTokens(int $reasoningTokens): self
    {
        $this->reasoningTokens = $reasoningTokens;
        return $this;
    }

    public function getUsageDetails(): ?array
    {
        return $this->usageDetails;
    }

    public function setUsageDetails(?array $usageDetails): self
    {
        $this->usageDetails = $usageDetails;
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

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'topic_id' => $this->topicId,
            'task_id' => $this->taskId,
            'sandbox_id' => $this->sandboxId,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'task_status' => $this->taskStatus,
            'usage_type' => $this->usageType,
            'total_input_tokens' => $this->totalInputTokens,
            'total_output_tokens' => $this->totalOutputTokens,
            'total_tokens' => $this->totalTokens,
            'model_id' => $this->modelId,
            'model_name' => $this->modelName,
            'cached_tokens' => $this->cachedTokens,
            'cache_write_tokens' => $this->cacheWriteTokens,
            'reasoning_tokens' => $this->reasoningTokens,
            'usage_details' => $this->usageDetails,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
