<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TransferStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TransferType;

/**
 * Transfer log entity for audit purposes.
 */
class TransferLogEntity extends AbstractEntity
{
    /**
     * @var int Primary key
     */
    protected int $id = 0;

    /**
     * @var string Batch ID for grouping multiple transfers
     */
    protected string $batchId = '';

    /**
     * @var string Organization code
     */
    protected string $organizationCode = '';

    /**
     * @var TransferType Transfer type
     */
    protected TransferType $transferType;

    /**
     * @var int Resource ID (workspace_id or project_id)
     */
    protected int $resourceId = 0;

    /**
     * @var string Resource name
     */
    protected string $resourceName = '';

    /**
     * @var string Original owner user ID
     */
    protected string $fromUserId = '';

    /**
     * @var string New owner user ID
     */
    protected string $toUserId = '';

    /**
     * @var bool Share to original owner
     */
    protected bool $shareToOriginal = false;

    /**
     * @var string Share role (manage/editor/viewer)
     */
    protected string $shareRole = '';

    /**
     * @var int Number of projects transferred (for workspace transfer)
     */
    protected int $projectsCount = 0;

    /**
     * @var int Number of files transferred
     */
    protected int $filesCount = 0;

    /**
     * @var TransferStatus Transfer status
     */
    protected TransferStatus $status;

    /**
     * @var null|string Error message if failed
     */
    protected ?string $errorMessage = null;

    /**
     * @var array Extra information
     */
    protected array $extra = [];

    /**
     * @var null|string Created time
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string Updated time
     */
    protected ?string $updatedAt = null;

    public function __construct()
    {
        $this->transferType = TransferType::PROJECT;
        $this->status = TransferStatus::PENDING;
    }

    // ==================== Getters and Setters ====================

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getBatchId(): string
    {
        return $this->batchId;
    }

    public function setBatchId(string $batchId): self
    {
        $this->batchId = $batchId;
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

    public function getTransferType(): TransferType
    {
        return $this->transferType;
    }

    public function setTransferType(TransferType $transferType): self
    {
        $this->transferType = $transferType;
        return $this;
    }

    public function getResourceId(): int
    {
        return $this->resourceId;
    }

    public function setResourceId(int $resourceId): self
    {
        $this->resourceId = $resourceId;
        return $this;
    }

    public function getResourceName(): string
    {
        return $this->resourceName;
    }

    public function setResourceName(string $resourceName): self
    {
        $this->resourceName = $resourceName;
        return $this;
    }

    public function getFromUserId(): string
    {
        return $this->fromUserId;
    }

    public function setFromUserId(string $fromUserId): self
    {
        $this->fromUserId = $fromUserId;
        return $this;
    }

    public function getToUserId(): string
    {
        return $this->toUserId;
    }

    public function setToUserId(string $toUserId): self
    {
        $this->toUserId = $toUserId;
        return $this;
    }

    public function isShareToOriginal(): bool
    {
        return $this->shareToOriginal;
    }

    public function setShareToOriginal(bool $shareToOriginal): self
    {
        $this->shareToOriginal = $shareToOriginal;
        return $this;
    }

    public function getShareRole(): string
    {
        return $this->shareRole;
    }

    public function setShareRole(string $shareRole): self
    {
        $this->shareRole = $shareRole;
        return $this;
    }

    public function getProjectsCount(): int
    {
        return $this->projectsCount;
    }

    public function setProjectsCount(int $projectsCount): self
    {
        $this->projectsCount = $projectsCount;
        return $this;
    }

    public function getFilesCount(): int
    {
        return $this->filesCount;
    }

    public function setFilesCount(int $filesCount): self
    {
        $this->filesCount = $filesCount;
        return $this;
    }

    public function getStatus(): TransferStatus
    {
        return $this->status;
    }

    public function setStatus(TransferStatus $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): self
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    public function getExtra(): array
    {
        return $this->extra;
    }

    public function setExtra(array $extra): self
    {
        $this->extra = $extra;
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

    // ==================== Business Methods ====================

    /**
     * Mark transfer as successful.
     */
    public function markAsSuccess(int $filesCount, array $extra = []): self
    {
        $this->status = TransferStatus::SUCCESS;
        $this->filesCount = $filesCount;
        $this->extra = array_merge($this->extra, $extra);
        return $this;
    }

    /**
     * Mark transfer as failed.
     */
    public function markAsFailed(string $errorMessage): self
    {
        $this->status = TransferStatus::FAILED;
        $this->errorMessage = $errorMessage;
        return $this;
    }

    /**
     * Add project result to extra.
     */
    public function addProjectResult(int $projectId, string $projectName, string $status, int $filesCount): self
    {
        if (! isset($this->extra['projects'])) {
            $this->extra['projects'] = [];
        }
        $this->extra['projects'][] = [
            'id' => $projectId,
            'name' => $projectName,
            'status' => $status,
            'files_count' => $filesCount,
        ];
        return $this;
    }

    /**
     * Convert to array for persistence.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'batch_id' => $this->batchId,
            'organization_code' => $this->organizationCode,
            'transfer_type' => $this->transferType->value,
            'resource_id' => $this->resourceId,
            'resource_name' => $this->resourceName,
            'from_user_id' => $this->fromUserId,
            'to_user_id' => $this->toUserId,
            'share_to_original' => $this->shareToOriginal ? 1 : 0,
            'share_role' => $this->shareRole,
            'projects_count' => $this->projectsCount,
            'files_count' => $this->filesCount,
            'status' => $this->status->value,
            'error_message' => $this->errorMessage,
            'extra' => json_encode($this->extra),
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
