<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AudioMarkerDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\AudioMarkerListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateAudioMarkerRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateAudioMarkerRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\AudioMarkerItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\AudioMarkerListResponseDTO;

class AudioMarkerAppService extends AbstractAppService
{
    public function __construct(
        protected AudioMarkerDomainService $audioMarkerDomainService
    ) {
    }

    /**
     * Create audio marker.
     */
    public function createMarker(
        RequestContext $requestContext,
        CreateAudioMarkerRequestDTO $requestDTO
    ): AudioMarkerItemDTO {
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // Verify project access permission (require EDITOR role)
        $projectId = (int) $requestDTO->getProjectId();
        $this->getAccessibleProjectWithEditor(
            $projectId,
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode()
        );

        $entity = $this->audioMarkerDomainService->createMarker(
            $dataIsolation,
            $projectId,
            $requestDTO->getPositionSeconds(),
            $requestDTO->getContent()
        );

        return AudioMarkerItemDTO::fromEntity($entity);
    }

    /**
     * Update audio marker.
     */
    public function updateMarker(
        RequestContext $requestContext,
        UpdateAudioMarkerRequestDTO $requestDTO
    ): AudioMarkerItemDTO {
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // Convert markerId from string to int
        $markerId = (int) $requestDTO->getMarkerId();

        // Get marker first to check project access
        $existingMarker = $this->audioMarkerDomainService->getMarkerById($markerId);
        if (! $existingMarker) {
            ExceptionBuilder::throw(SuperAgentErrorCode::AUDIO_MARKER_NOT_FOUND, 'audio_marker.not_found');
        }

        // Verify project access permission (require EDITOR role)
        $this->getAccessibleProjectWithEditor(
            $existingMarker->getProjectId(),
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode()
        );

        $entity = $this->audioMarkerDomainService->updateMarker(
            $dataIsolation,
            $markerId,
            $requestDTO->getPositionSeconds(),
            $requestDTO->getContent()
        );

        return AudioMarkerItemDTO::fromEntity($entity);
    }

    /**
     * Get marker detail.
     */
    public function getMarkerDetail(RequestContext $requestContext, string $markerId): AudioMarkerItemDTO
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // Convert markerId from string to int
        $markerIdInt = (int) $markerId;

        $entity = $this->audioMarkerDomainService->getMarkerById($markerIdInt);
        if (! $entity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::AUDIO_MARKER_NOT_FOUND, 'audio_marker.not_found');
        }

        // Verify project access permission (require VIEWER role)
        $this->getAccessibleProject(
            $entity->getProjectId(),
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode()
        );

        // Verify marker ownership (only owner can view their own markers)
        if ($entity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::AUDIO_MARKER_ACCESS_DENIED, 'audio_marker.access_denied');
        }

        return AudioMarkerItemDTO::fromEntity($entity);
    }

    /**
     * Get markers list.
     */
    public function getMarkersList(
        RequestContext $requestContext,
        AudioMarkerListRequestDTO $requestDTO
    ): AudioMarkerListResponseDTO {
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // Verify project access permission (require VIEWER role)
        $projectId = (int) $requestDTO->getProjectId();
        $this->getAccessibleProject(
            $projectId,
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode()
        );

        // Get markers filtered by current user (only show user's own markers)
        $result = $this->audioMarkerDomainService->getMarkersByProjectIdAndUserId(
            $projectId,
            $dataIsolation->getCurrentUserId(),
            $requestDTO->getPage(),
            $requestDTO->getPageSize()
        );

        return AudioMarkerListResponseDTO::fromResult($result);
    }

    /**
     * Delete marker.
     */
    public function deleteMarker(RequestContext $requestContext, string $markerId): bool
    {
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // Convert markerId from string to int
        $markerIdInt = (int) $markerId;

        // Get marker first to check project access
        $existingMarker = $this->audioMarkerDomainService->getMarkerById($markerIdInt);
        if (! $existingMarker) {
            ExceptionBuilder::throw(SuperAgentErrorCode::AUDIO_MARKER_NOT_FOUND, 'audio_marker.not_found');
        }

        // Verify project access permission (require EDITOR role)
        $this->getAccessibleProjectWithEditor(
            $existingMarker->getProjectId(),
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode()
        );

        return $this->audioMarkerDomainService->deleteMarker($dataIsolation, $markerIdInt);
    }
}
