<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

/**
 * Project fork event
 * Triggered when a project fork is initiated to start file migration process.
 */
class ProjectForkEvent extends AbstractEvent
{
    /**
     * Constructor.
     *
     * @param int $sourceProjectId Source project ID to fork from
     * @param int $forkProjectId Forked project ID
     * @param string $userId User ID who initiated the fork
     * @param string $organizationCode Organization code
     * @param int $forkRecordId Fork record ID for tracking
     */
    public function __construct(
        private int $sourceProjectId,
        private int $forkProjectId,
        private string $userId,
        private string $organizationCode,
        private int $forkRecordId
    ) {
        // Call parent constructor to generate snowflake ID
        parent::__construct();
    }

    /**
     * Create event from array.
     *
     * @param array $data Event data array
     */
    public static function fromArray(array $data): self
    {
        $sourceProjectId = (int) ($data['source_project_id'] ?? 0);
        $forkProjectId = (int) ($data['fork_project_id'] ?? 0);
        $userId = (string) ($data['user_id'] ?? '');
        $organizationCode = (string) ($data['organization_code'] ?? '');
        $forkRecordId = (int) ($data['fork_record_id'] ?? 0);

        return new self($sourceProjectId, $forkProjectId, $userId, $organizationCode, $forkRecordId);
    }

    /**
     * Convert to array.
     *
     * @return array Event data array
     */
    public function toArray(): array
    {
        return [
            'event_id' => $this->getEventId(),
            'source_project_id' => $this->sourceProjectId,
            'fork_project_id' => $this->forkProjectId,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'fork_record_id' => $this->forkRecordId,
            'timestamp' => time(),
        ];
    }

    /**
     * Get source project ID.
     */
    public function getSourceProjectId(): int
    {
        return $this->sourceProjectId;
    }

    /**
     * Get fork project ID.
     */
    public function getForkProjectId(): int
    {
        return $this->forkProjectId;
    }

    /**
     * Get user ID.
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * Get organization code.
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * Get fork record ID.
     */
    public function getForkRecordId(): int
    {
        return $this->forkRecordId;
    }
}
