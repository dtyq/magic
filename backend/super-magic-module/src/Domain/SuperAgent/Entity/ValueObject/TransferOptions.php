<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Transfer Options Value Object.
 *
 * Encapsulates all transfer-related options to simplify method signatures
 * and centralize transfer configuration logic.
 */
final class TransferOptions
{
    public function __construct(
        private readonly string $fromUserName,
        private readonly string $transferSuffix,
        private readonly bool $shareToOriginalOwner = false,
        private readonly string $shareRole = '',
        private readonly bool $retainOriginalLocation = false,
        private readonly string $originalWorkspaceName = '',
    ) {
    }

    /**
     * Create options for project transfer.
     */
    public static function forProject(
        string $fromUserName,
        string $transferSuffix,
        bool $shareToOriginalOwner = false,
        string $shareRole = '',
        bool $retainOriginalLocation = false,
        string $originalWorkspaceName = ''
    ): self {
        return new self(
            $fromUserName,
            $transferSuffix,
            $shareToOriginalOwner,
            $shareRole,
            $retainOriginalLocation,
            $originalWorkspaceName
        );
    }

    /**
     * Create options for workspace transfer.
     */
    public static function forWorkspace(
        string $fromUserName,
        string $transferSuffix,
        bool $shareToOriginalOwner = false,
        string $shareRole = '',
        bool $retainOriginalLocation = false
    ): self {
        return new self(
            $fromUserName,
            $transferSuffix,
            $shareToOriginalOwner,
            $shareRole,
            $retainOriginalLocation,
            ''
        );
    }

    public function getFromUserName(): string
    {
        return $this->fromUserName;
    }

    public function getTransferSuffix(): string
    {
        return $this->transferSuffix;
    }

    public function shouldShareToOriginalOwner(): bool
    {
        return $this->shareToOriginalOwner;
    }

    public function getShareRole(): string
    {
        return $this->shareRole;
    }

    public function shouldRetainOriginalLocation(): bool
    {
        return $this->retainOriginalLocation;
    }

    public function getOriginalWorkspaceName(): string
    {
        return $this->originalWorkspaceName;
    }

    /**
     * Check if should create new workspace (when not retaining location).
     */
    public function shouldCreateNewWorkspace(): bool
    {
        return ! $this->retainOriginalLocation || ! $this->shareToOriginalOwner;
    }

    /**
     * Get original workspace ID for binding (0 if not applicable).
     */
    public function getBindWorkspaceId(int $originalWorkspaceId): int
    {
        return ($this->retainOriginalLocation && $this->shareToOriginalOwner) ? $originalWorkspaceId : 0;
    }
}
