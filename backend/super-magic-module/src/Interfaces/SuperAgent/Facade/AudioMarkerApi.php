<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AudioMarkerAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\AudioMarkerListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateAudioMarkerRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateAudioMarkerRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class AudioMarkerApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected AudioMarkerAppService $audioMarkerAppService
    ) {
        parent::__construct($request);
    }

    /**
     * Create audio marker.
     */
    public function createMarker(RequestContext $requestContext, string $projectId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $requestDTO = CreateAudioMarkerRequestDTO::fromRequest($this->request);
        $requestDTO->projectId = $projectId;
        return $this->audioMarkerAppService->createMarker($requestContext, $requestDTO)->toArray();
    }

    /**
     * Update audio marker.
     */
    public function updateMarker(RequestContext $requestContext, string $projectId, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $requestDTO = UpdateAudioMarkerRequestDTO::fromRequest($this->request);
        $requestDTO->markerId = $id;
        return $this->audioMarkerAppService->updateMarker($requestContext, $requestDTO)->toArray();
    }

    /**
     * Get audio marker detail.
     */
    public function getMarkerDetail(RequestContext $requestContext, string $projectId, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->audioMarkerAppService->getMarkerDetail($requestContext, $id)->toArray();
    }

    /**
     * Get audio markers list.
     */
    public function getMarkersList(RequestContext $requestContext, string $projectId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $requestDTO = AudioMarkerListRequestDTO::fromRequest($this->request);
        $requestDTO->projectId = $projectId;
        return $this->audioMarkerAppService->getMarkersList($requestContext, $requestDTO)->toArray();
    }

    /**
     * Delete audio marker.
     */
    public function deleteMarker(RequestContext $requestContext, string $projectId, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $this->audioMarkerAppService->deleteMarker($requestContext, $id);
        return ['id' => $id];
    }
}
