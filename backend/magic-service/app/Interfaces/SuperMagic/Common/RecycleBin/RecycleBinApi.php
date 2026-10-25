<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Common\RecycleBin;

use App\Application\SuperMagic\Common\RecycleBin\DTO\BatchMoveProjectInRecycleBinRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\BatchMoveTopicsInRecycleBinRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\CheckParentRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\MoveProjectInRecycleBinRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\MoveTopicInRecycleBinRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\PermanentDeleteRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RecycleBinCountsRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RecycleBinListRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\DTO\RestoreRequestDTO;
use App\Application\SuperMagic\Common\RecycleBin\Service\RecycleBinAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use InvalidArgumentException;

#[ApiResponse('low_code')]
class RecycleBinApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected RecycleBinAppService $recycleBinAppService,
    ) {
        parent::__construct($request);
    }

    public function previewFile(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $projectId = $this->request->query('project_id');
        if ($projectId !== null && (! is_string($projectId) || ! ctype_digit($projectId) || (int) $projectId <= 0)) {
            throw new BusinessException(\Hyperf\Translation\trans('recycle_bin.query.project_invalid'), GenericErrorCode::ParameterValidationFailed->value);
        }
        return $this->recycleBinAppService->previewFile($requestContext, (int) $id, $projectId === null ? null : (int) $projectId)->toArray();
    }

    /**
     * 获取回收站列表.
     */
    public function getRecycleBinList(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        try {
            $requestDTO = RecycleBinListRequestDTO::fromRequest($this->request);
            return $this->recycleBinAppService->getRecycleBinList($requestContext, $requestDTO)->toArray();
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                \Hyperf\Translation\trans($e->getMessage()),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }
    }

    /**
     * 获取各资源类型的回收站数量.
     */
    public function getRecycleBinCounts(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        try {
            $requestDTO = RecycleBinCountsRequestDTO::fromRequest($this->request);
            return $this->recycleBinAppService->getRecycleBinCounts($requestContext, $requestDTO)->toArray();
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                \Hyperf\Translation\trans($e->getMessage()),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }
    }

    /**
     * Check restore conflicts for a batch of resources (all resource types).
     *
     * Returns unified items_with_conflict / items_no_conflict for all types:
     * - File: parent_missing + name_conflict
     * - Project/Topic: parent_missing
     * - Workspace: always no-conflict
     *
     * @throws BusinessException
     */
    public function checkConflicts(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        try {
            $requestDTO = CheckParentRequestDTO::fromRequest($this->request);
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                $e->getMessage(),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }

        return $this->recycleBinAppService->checkConflicts($requestContext, $requestDTO)->toArray();
    }

    /**
     * 恢复资源.
     *
     * @throws BusinessException
     */
    public function restore(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        try {
            $requestDTO = RestoreRequestDTO::fromRequest($this->request);
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                $e->getMessage(),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }

        return $this->recycleBinAppService->restore($requestContext, $requestDTO)->toArray();
    }

    /**
     * 移动回收站内的项目到新工作区.
     *
     * @throws BusinessException
     */
    public function moveProject(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        try {
            $requestDTO = MoveProjectInRecycleBinRequestDTO::fromRequest($this->request);
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                $e->getMessage(),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }

        return $this->recycleBinAppService->moveProject($requestContext, $requestDTO);
    }

    /**
     * 批量移动回收站内的项目到新工作区.
     *
     * @throws BusinessException
     */
    public function batchMoveProject(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        try {
            $requestDTO = BatchMoveProjectInRecycleBinRequestDTO::fromRequest($this->request);
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                $e->getMessage(),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }

        return $this->recycleBinAppService->batchMoveProject($requestContext, $requestDTO);
    }

    /**
     * 移动回收站中的话题.
     *
     * @throws BusinessException
     */
    public function moveTopic(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        try {
            $requestDTO = MoveTopicInRecycleBinRequestDTO::fromRequest($this->request);
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                $e->getMessage(),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }

        return $this->recycleBinAppService->moveTopic($requestContext, $requestDTO);
    }

    /**
     * 批量移动回收站中的话题.
     *
     * @throws BusinessException
     */
    public function batchMoveTopic(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        try {
            $requestDTO = BatchMoveTopicsInRecycleBinRequestDTO::fromRequest($this->request);
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                $e->getMessage(),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }

        return $this->recycleBinAppService->batchMoveTopic($requestContext, $requestDTO);
    }

    /**
     * 彻底删除回收站记录.
     *
     * @throws BusinessException
     */
    public function permanentDelete(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        try {
            $requestDTO = PermanentDeleteRequestDTO::fromRequest($this->request);
        } catch (InvalidArgumentException $e) {
            throw new BusinessException(
                $e->getMessage(),
                GenericErrorCode::ParameterValidationFailed->value
            );
        }

        return $this->recycleBinAppService->permanentDelete($requestContext, $requestDTO);
    }
}
