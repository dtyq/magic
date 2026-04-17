<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Entity;

use App\Domain\Audit\ModelCall\Entity\ValueObject\ModelAuditAccessScope;
use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class AuditLogEntity extends AbstractEntity
{
    protected ?string $id = null;

    protected string $userId = '';

    protected string $organizationCode = '';

    protected string $type = '';

    protected string $productCode = '';

    protected string $status = '';

    protected string $ak = '';

    /** API Key 名称快照，来自 magic_api_access_tokens.name */
    protected string $accessTokenName = '';

    /** 模型部署名快照，即发给上游的真实 model id，来自 service_provider_models.model_version */
    protected string $modelVersion = '';

    /** 服务商名称快照，来自 service_provider_configs.alias 或 service_provider.name */
    protected string $providerName = '';

    protected int $operationTime = 0;

    protected int $allLatency = 0;

    /** 首次响应延时（TTFT），仅流式有值，单位毫秒 */
    protected int $firstResponseLatency = 0;

    protected array $usage = [];

    protected ?array $detailInfo = null;

    protected ModelAuditAccessScope $accessScope = ModelAuditAccessScope::Magic;

    protected ?string $magicTopicId = null;

    protected ?string $requestId = null;

    /** 单次调用事件 ID（雪花字符串），与 MQ / 计费侧关联 */
    protected ?string $eventId = null;

    /** 计费回写积分；仅列表/详情展示用，审计落库路径不得写入 */
    protected ?int $points = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (string) $id : null;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getProductCode(): string
    {
        return $this->productCode;
    }

    public function setProductCode(string $productCode): void
    {
        $this->productCode = $productCode;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getAk(): string
    {
        return $this->ak;
    }

    public function setAk(string $ak): void
    {
        $this->ak = $ak;
    }

    public function getAccessTokenName(): string
    {
        return $this->accessTokenName;
    }

    public function setAccessTokenName(string $accessTokenName): void
    {
        $this->accessTokenName = $accessTokenName;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function setModelVersion(string $modelVersion): void
    {
        $this->modelVersion = $modelVersion;
    }

    public function getProviderName(): string
    {
        return $this->providerName;
    }

    public function setProviderName(string $providerName): void
    {
        $this->providerName = $providerName;
    }

    public function getOperationTime(): int
    {
        return $this->operationTime;
    }

    public function setOperationTime(int $operationTime): void
    {
        $this->operationTime = $operationTime;
    }

    public function getAllLatency(): int
    {
        return $this->allLatency;
    }

    public function setAllLatency(int $allLatency): void
    {
        $this->allLatency = $allLatency;
    }

    public function getFirstResponseLatency(): int
    {
        return $this->firstResponseLatency;
    }

    public function setFirstResponseLatency(int $firstResponseLatency): void
    {
        $this->firstResponseLatency = $firstResponseLatency;
    }

    public function getUsage(): array
    {
        return $this->usage;
    }

    public function setUsage(array $usage): void
    {
        $this->usage = $usage;
    }

    public function getDetailInfo(): ?array
    {
        return $this->detailInfo;
    }

    public function setDetailInfo(?array $detailInfo): void
    {
        $this->detailInfo = $detailInfo;
    }

    public function getAccessScope(): ModelAuditAccessScope
    {
        return $this->accessScope;
    }

    public function setAccessScope(ModelAuditAccessScope $accessScope): void
    {
        $this->accessScope = $accessScope;
    }

    public function getMagicTopicId(): ?string
    {
        return $this->magicTopicId;
    }

    public function setMagicTopicId(?string $magicTopicId): void
    {
        $this->magicTopicId = $magicTopicId;
    }

    public function getRequestId(): ?string
    {
        return $this->requestId;
    }

    public function setRequestId(?string $requestId): void
    {
        $this->requestId = $requestId;
    }

    public function getEventId(): ?string
    {
        return $this->eventId;
    }

    public function setEventId(?string $eventId): void
    {
        $trimmed = $eventId !== null ? trim($eventId) : '';
        $this->eventId = $trimmed === '' ? null : $trimmed;
    }

    public function getPoints(): ?int
    {
        return $this->points;
    }

    public function setPoints(?int $points): void
    {
        $this->points = $points;
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
}
