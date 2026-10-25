<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Project\Facade;

use App\Application\SuperMagic\Project\DTO\Request\CreateMicroAppProjectRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\MicroAppListRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\PublishedMicroAppListRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\PublishMicroAppRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\UpdateMicroAppRequestDTO;
use App\Application\SuperMagic\Project\Service\MicroAppProjectAppService;
use App\Application\SuperMagic\Project\Service\MicroAppTransferAppService;
use App\Application\SuperMagic\Project\Service\ProjectAppService;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\DTO\Request\TransferResourceRequestDTO;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Micro app project API.
 */
#[ApiResponse('low_code')]
class MicroAppProjectApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectAppService $projectAppService,
        private readonly MicroAppTransferAppService $microAppTransferAppService,
        private readonly MicroAppProjectAppService $microAppProjectAppService
    ) {
        parent::__construct($request);
    }

    /**
     * Create micro app project.
     */
    public function store(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = CreateMicroAppProjectRequestDTO::fromRequest($this->request);

        return $this->projectAppService->createMicroAppProject($requestContext, $requestDTO);
    }

    public function transfer(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->microAppTransferAppService->transfer($requestContext, $appId, TransferResourceRequestDTO::fromRequest($this->request));
    }

    public function publish(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = PublishMicroAppRequestDTO::fromRequest($this->request);

        return $this->microAppProjectAppService->publish($requestContext, $appId, $requestDTO);
    }

    public function unpublish(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->microAppProjectAppService->unpublish($requestContext, $appId);
    }

    public function destroy(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->microAppProjectAppService->delete($requestContext, $appId);
    }

    public function publishedList(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = PublishedMicroAppListRequestDTO::fromRequest($this->request);

        return $this->microAppProjectAppService->publishedList($requestContext, $requestDTO);
    }

    public function list(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = MicroAppListRequestDTO::fromRequest($this->request);

        return $this->microAppProjectAppService->list($requestContext, $requestDTO);
    }

    public function mentionList(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = PublishedMicroAppListRequestDTO::fromRequest($this->request);

        return $this->microAppProjectAppService->mentionList($requestContext, $requestDTO);
    }

    public function recordVisit(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->microAppProjectAppService->recordVisit($requestContext, $appId);
    }

    public function update(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = UpdateMicroAppRequestDTO::fromRequest($this->request);

        return $this->microAppProjectAppService->update($requestContext, $appId, $requestDTO);
    }

    public function show(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->microAppProjectAppService->show($requestContext, $appId);
    }

    public function getRuntimeProject(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->microAppProjectAppService->getRuntimeProject($requestContext, $appId);
    }

    public function ensureRuntimeProject(RequestContext $requestContext, int $appId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->microAppProjectAppService->ensureRuntimeProject($requestContext, $appId);
    }

    public function showByProject(RequestContext $requestContext, int $projectId): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->microAppProjectAppService->showByProject($requestContext, $projectId);
    }

    public function resolvePublished(int $appId): array
    {
        return $this->microAppProjectAppService->resolvePublished($appId);
    }
}
