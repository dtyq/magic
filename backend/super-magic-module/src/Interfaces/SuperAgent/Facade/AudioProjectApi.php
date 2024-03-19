<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAudioProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\GetAudioProjectListRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\ImportAudioFilesRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\UpdateAudioProjectTagsRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Audio Project API.
 */
#[ApiResponse('low_code')]
class AudioProjectApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectAppService $projectAppService
    ) {
        parent::__construct($request);
    }

    /**
     * Create audio project.
     */
    public function store(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CreateAudioProjectRequestDTO::fromRequest($this->request);

        return $this->projectAppService->createAudioProject($requestContext, $requestDTO);
    }

    /**
     * Get audio project list.
     */
    public function index(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = GetAudioProjectListRequestDTO::fromRequest($this->request);

        return $this->projectAppService->getAudioProjectList($requestContext, $requestDTO);
    }

    /**
     * Get ungrouped audio projects count.
     */
    public function getUngroupedCount(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $count = $this->projectAppService->getUngroupedAudioProjectCount($requestContext);

        return ['count' => $count];
    }

    /**
     * Update audio project tags.
     */
    public function updateTags(RequestContext $requestContext, int $projectId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = UpdateAudioProjectTagsRequestDTO::fromRequest($this->request);

        $this->projectAppService->updateAudioProjectTags($requestContext, $projectId, $requestDTO);

        return ['message' => 'Tags updated successfully'];
    }

    /**
     * Import existing audio files to project.
     */
    public function importFiles(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = ImportAudioFilesRequestDTO::fromRequest($this->request);

        return $this->projectAppService->importAudioFiles($requestContext, $requestDTO);
    }
}
