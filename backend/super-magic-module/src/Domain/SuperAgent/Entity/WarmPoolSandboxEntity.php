<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

/**
 * In-memory representation of a row in `magic_super_agent_warm_pool_sandboxes`.
 *
 * Each row models a single warm-pool sandbox (creating -> ready -> claimed
 * or dead). `bound_*` columns are stamped at claim time for tracing only;
 * the authoritative project / topic binding lives elsewhere.
 */
class WarmPoolSandboxEntity
{
    private ?int $id = null;

    private string $sandboxId = '';

    private string $sandboxName = '';

    private string $agentImage = '';

    private string $status = '';

    private ?string $boundUserId = null;

    private ?string $boundProjectId = null;

    private ?string $boundAt = null;

    private ?string $expiresAt = null;

    private ?string $deadReason = null;

    private ?string $createdAt = null;

    private ?string $updatedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): void
    {
        $this->sandboxId = $sandboxId;
    }

    public function getSandboxName(): string
    {
        return $this->sandboxName;
    }

    public function setSandboxName(string $sandboxName): void
    {
        $this->sandboxName = $sandboxName;
    }

    public function getAgentImage(): string
    {
        return $this->agentImage;
    }

    public function setAgentImage(string $agentImage): void
    {
        $this->agentImage = $agentImage;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getBoundUserId(): ?string
    {
        return $this->boundUserId;
    }

    public function setBoundUserId(?string $boundUserId): void
    {
        $this->boundUserId = $boundUserId;
    }

    public function getBoundProjectId(): ?string
    {
        return $this->boundProjectId;
    }

    public function setBoundProjectId(?string $boundProjectId): void
    {
        $this->boundProjectId = $boundProjectId;
    }

    public function getBoundAt(): ?string
    {
        return $this->boundAt;
    }

    public function setBoundAt(?string $boundAt): void
    {
        $this->boundAt = $boundAt;
    }

    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(?string $expiresAt): void
    {
        $this->expiresAt = $expiresAt;
    }

    public function getDeadReason(): ?string
    {
        return $this->deadReason;
    }

    public function setDeadReason(?string $deadReason): void
    {
        $this->deadReason = $deadReason;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }
}
