<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioMarkerEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\AudioMarkerRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

class AudioMarkerDomainService
{
    public function __construct(
        protected AudioMarkerRepositoryInterface $audioMarkerRepository
    ) {
    }

    /**
     * Create audio marker.
     */
    public function createMarker(
        DataIsolation $dataIsolation,
        int $projectId,
        int $positionSeconds,
        string $content
    ): AudioMarkerEntity {
        $currentTime = date('Y-m-d H:i:s');
        $currentUserId = $dataIsolation->getCurrentUserId();

        $entity = new AudioMarkerEntity();
        $entity->setId(IdGenerator::getSnowId()); // Generate snowflake ID
        $entity->setProjectId($projectId);
        $entity->setPositionSeconds($positionSeconds);
        $entity->setContent($content);
        $entity->setUserId($currentUserId);
        $entity->setUserOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setCreatedUid($currentUserId);
        $entity->setUpdatedUid($currentUserId);
        $entity->setCreatedAt($currentTime);
        $entity->setUpdatedAt($currentTime);

        return $this->audioMarkerRepository->create($entity);
    }

    /**
     * Update audio marker.
     */
    public function updateMarker(
        DataIsolation $dataIsolation,
        int $markerId,
        ?int $positionSeconds = null,
        ?string $content = null
    ): AudioMarkerEntity {
        $entity = $this->audioMarkerRepository->getById($markerId);
        if (! $entity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::AUDIO_MARKER_NOT_FOUND, 'audio_marker.not_found');
        }

        // Verify ownership
        if ($entity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::AUDIO_MARKER_ACCESS_DENIED, 'audio_marker.access_denied');
        }

        // Update fields
        if ($positionSeconds !== null) {
            $entity->setPositionSeconds($positionSeconds);
        }
        if ($content !== null) {
            $entity->setContent($content);
        }

        $entity->setUpdatedUid($dataIsolation->getCurrentUserId());
        $entity->setUpdatedAt(date('Y-m-d H:i:s'));

        $this->audioMarkerRepository->update($entity);
        return $entity;
    }

    /**
     * Get marker by ID.
     */
    public function getMarkerById(int $markerId): ?AudioMarkerEntity
    {
        return $this->audioMarkerRepository->getById($markerId);
    }

    /**
     * Get markers by project ID.
     */
    public function getMarkersByProjectId(
        int $projectId,
        int $page = 1,
        int $pageSize = 20
    ): array {
        return $this->audioMarkerRepository->getByProjectId(
            $projectId,
            $page,
            $pageSize,
            'position_seconds',
            'asc'
        );
    }

    /**
     * Get markers by project ID and user ID (for private markers).
     */
    public function getMarkersByProjectIdAndUserId(
        int $projectId,
        string $userId,
        int $page = 1,
        int $pageSize = 20
    ): array {
        return $this->audioMarkerRepository->getByProjectIdAndUserId(
            $projectId,
            $userId,
            $page,
            $pageSize,
            'position_seconds',
            'asc'
        );
    }

    /**
     * Delete marker.
     */
    public function deleteMarker(DataIsolation $dataIsolation, int $markerId): bool
    {
        $entity = $this->audioMarkerRepository->getById($markerId);
        if (! $entity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::AUDIO_MARKER_NOT_FOUND, 'audio_marker.not_found');
        }

        // Verify ownership
        if ($entity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::AUDIO_MARKER_ACCESS_DENIED, 'audio_marker.access_denied');
        }

        $entity->setDeletedAt(date('Y-m-d H:i:s'));
        $entity->setUpdatedUid($dataIsolation->getCurrentUserId());

        $this->audioMarkerRepository->save($entity);
        return true;
    }
}
