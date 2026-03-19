<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\RecycleBin;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\BatchMoveProjectInRecycleBinRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\BatchMoveTopicsInRecycleBinRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\CheckParentRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\MoveProjectInRecycleBinRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\MoveTopicInRecycleBinRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\PermanentDeleteRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\RecycleBinListRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\DTO\RestoreRequestDTO;
use Dtyq\SuperMagic\Application\RecycleBin\Service\RecycleBinAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
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

    /**
     * 获取回收站列表.
     */
    public function getRecycleBinList(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $requestDTO = RecycleBinListRequestDTO::fromRequest($this->request);

        return $this->recycleBinAppService->getRecycleBinList($requestContext, $requestDTO)->toArray();
    }

    /**
     * 检查父级是否存在.
     *
     * @throws BusinessException
     */
    public function checkParent(RequestContext $requestContext): array
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

        return $this->recycleBinAppService->checkParent($requestContext, $requestDTO)->toArray();
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
