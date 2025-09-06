<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Entity;

use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryType;
use App\Infrastructure\Core\AbstractEntity;
use DateTime;
use Hyperf\Codec\Json;

/**
 * 长期记忆实体.
 */
final class LongTermMemoryEntity extends AbstractEntity
{
    protected string $id = '';

    protected string $content = '';

    protected ?string $pendingContent = null;

    protected ?string $explanation = null;

    protected ?string $originText = null;

    protected MemoryType $memoryType;

    protected MemoryStatus $status;

    protected bool $enabled = false;

    protected float $confidence = 0.8;

    protected float $importance = 0.5;

    protected int $accessCount = 0;

    protected int $reinforcementCount = 0;

    protected float $decayFactor = 1.0;

    protected array $tags = [];

    protected array $metadata = [];

    protected string $orgId = '';

    protected string $appId = '';

    protected ?string $projectId = null;

    protected string $userId = '';

    protected ?string $sourceMessageId = null;

    protected ?DateTime $lastAccessedAt = null;

    protected ?DateTime $lastReinforcedAt = null;

    protected ?DateTime $expiresAt = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected ?DateTime $deletedAt = null;

    public function __construct(?array $data = [])
    {
        parent::__construct($data);

        // 默认值设置
        if (! isset($this->memoryType)) {
            $this->memoryType = MemoryType::MANUAL_INPUT;
        }
        if (! isset($this->status)) {
            $this->status = MemoryStatus::PENDING;
        }
    }

    // Getters and Setters

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): void
    {
        $this->content = $content;
    }

    public function getPendingContent(): ?string
    {
        return $this->pendingContent;
    }

    public function setPendingContent(?string $pendingContent): void
    {
        $this->pendingContent = $pendingContent;
    }

    public function getExplanation(): ?string
    {
        return $this->explanation;
    }

    public function setExplanation(?string $explanation): void
    {
        $this->explanation = $explanation;
    }

    public function getOriginText(): ?string
    {
        return $this->originText;
    }

    public function setOriginText(?string $originText): void
    {
        $this->originText = $originText;
    }

    public function getMemoryType(): MemoryType
    {
        return $this->memoryType;
    }

    public function setMemoryType(MemoryType|string $memoryType): void
    {
        if (is_string($memoryType)) {
            $memoryType = MemoryType::from($memoryType);
        }
        $this->memoryType = $memoryType;
    }

    public function getStatus(): MemoryStatus
    {
        return $this->status;
    }

    public function setStatus(MemoryStatus|string $status): void
    {
        if (is_string($status)) {
            $this->status = MemoryStatus::from($status);
        } else {
            $this->status = $status;
        }
    }

    public function getConfidence(): float
    {
        return $this->confidence;
    }

    public function setConfidence(float $confidence): void
    {
        $this->confidence = max(0.0, min(1.0, $confidence));
    }

    public function getImportance(): float
    {
        return $this->importance;
    }

    public function setImportance(float $importance): void
    {
        $this->importance = max(0.0, min(1.0, $importance));
    }

    public function getAccessCount(): int
    {
        return $this->accessCount;
    }

    public function setAccessCount(int $accessCount): void
    {
        $this->accessCount = max(0, $accessCount);
    }

    public function getReinforcementCount(): int
    {
        return $this->reinforcementCount;
    }

    public function setReinforcementCount(int $reinforcementCount): void
    {
        $this->reinforcementCount = max(0, $reinforcementCount);
    }

    public function getDecayFactor(): float
    {
        return $this->decayFactor;
    }

    public function setDecayFactor(float $decayFactor): void
    {
        $this->decayFactor = max(0.0, min(1.0, $decayFactor));
    }

    public function getTags(): array
    {
        return $this->tags;
    }

    public function setTags(array|string $tags): void
    {
        if (is_string($tags)) {
            $tags = Json::decode($tags);
        }
        $this->tags = $tags ?? [];
    }

    public function getMetadata(): array
    {
        return $this->metadata;
    }

    public function setMetadata(array|string $metadata): void
    {
        if (is_string($metadata)) {
            $metadata = Json::decode($metadata);
        }
        $this->metadata = $metadata ?? [];
    }

    public function getOrgId(): string
    {
        return $this->orgId;
    }

    public function setOrgId(string $orgId): void
    {
        $this->orgId = $orgId;
    }

    public function getAppId(): string
    {
        return $this->appId;
    }

    public function setAppId(string $appId): void
    {
        $this->appId = $appId;
    }

    public function getProjectId(): ?string
    {
        return $this->projectId;
    }

    public function setProjectId(?string $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getSourceMessageId(): ?string
    {
        return $this->sourceMessageId;
    }

    public function setSourceMessageId(?string $sourceMessageId): void
    {
        $this->sourceMessageId = $sourceMessageId;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    /**
     * 内部设置启用状态（不进行业务规则检查）.
     * 用于数据初始化和内部操作，跳过业务规则限制.
     */
    public function setEnabledInternal(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getLastAccessedAt(): ?DateTime
    {
        return $this->lastAccessedAt;
    }

    public function setLastAccessedAt(mixed $lastAccessedAt): void
    {
        $this->lastAccessedAt = $this->createDatetime($lastAccessedAt);
    }

    public function getLastReinforcedAt(): ?DateTime
    {
        return $this->lastReinforcedAt;
    }

    public function setLastReinforcedAt(mixed $lastReinforcedAt): void
    {
        $this->lastReinforcedAt = $this->createDatetime($lastReinforcedAt);
    }

    public function getExpiresAt(): ?DateTime
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(mixed $expiresAt): void
    {
        $this->expiresAt = $this->createDatetime($expiresAt);
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): void
    {
        $this->createdAt = $this->createDatetime($createdAt);
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): void
    {
        $this->updatedAt = $this->createDatetime($updatedAt);
    }

    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(mixed $deletedAt): void
    {
        $this->deletedAt = $this->createDatetime($deletedAt);
    }

    // 业务方法

    /**
     * 访问记忆（更新访问次数和时间）.
     */
    public function access(): void
    {
        ++$this->accessCount;
        $this->lastAccessedAt = new DateTime();
    }

    /**
     * 强化记忆（更新强化次数和时间，提升重要性）.
     */
    public function reinforce(): void
    {
        ++$this->reinforcementCount;
        $this->lastReinforcedAt = new DateTime();

        // 强化会提升重要性，但有上限
        $this->importance = min(1.0, $this->importance + 0.1);
    }

    /**
     * 计算当前记忆的有效分数（考虑衰减）.
     */
    public function getEffectiveScore(): float
    {
        $baseScore = $this->importance * $this->confidence;

        // 计算时间衰减
        $timeDecay = $this->calculateTimeDecay();

        // 计算访问频率加成
        $accessBonus = $this->calculateAccessBonus();

        return $baseScore * $timeDecay * $this->decayFactor + $accessBonus;
    }

    /**
     * 添加标签.
     */
    public function addTag(string $tag): void
    {
        if (! in_array($tag, $this->tags)) {
            $this->tags[] = $tag;
        }
    }

    /**
     * 移除标签.
     */
    public function removeTag(string $tag): void
    {
        $this->tags = array_values(array_filter($this->tags, fn ($t) => $t !== $tag));
    }

    /**
     * 添加元数据.
     */
    public function addMetadata(string $key, mixed $value): void
    {
        $this->metadata[$key] = $value;
    }

    /**
     * 获取元数据.
     */
    public function getMetadataValue(string $key): mixed
    {
        return $this->metadata[$key] ?? null;
    }

    /**
     * 重写 set 方法，对 enabled 字段进行特殊处理.
     */
    protected function set(string $key, mixed $value): void
    {
        // enabled 字段在初始化时使用内部方法，跳过业务规则检查
        if (strtolower($key) === 'enabled' && is_bool($value)) {
            $this->setEnabledInternal($value);
            return;
        }

        parent::set($key, $value);
    }

    /**
     * 计算时间衰减因子.
     */
    private function calculateTimeDecay(): float
    {
        if (! $this->lastAccessedAt) {
            return 1.0;
        }

        $daysSinceLastAccess = (new DateTime())->diff($this->lastAccessedAt)->days;

        // 根据访问时间计算衰减，最多衰减到 0.5
        return max(0.5, 1.0 - ($daysSinceLastAccess * 0.01));
    }

    /**
     * 计算访问频率加成.
     */
    private function calculateAccessBonus(): float
    {
        if ($this->accessCount === 0) {
            return 0.0;
        }

        // 访问次数的对数加成，避免过度奖励
        return min(0.3, log($this->accessCount + 1) * 0.1);
    }
}
