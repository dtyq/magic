<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Audit\Facade;

use App\Application\Audit\Service\AdminOperationLogAppService;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Audit\Assembler\AdminOperationLogAssembler;
use App\Interfaces\Audit\DTO\AdminOperationLogListRequestDTO;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\Permission\Facade\AbstractPermissionApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

/**
 * 管理员操作日志 API.
 * 需具备操作日志-查询权限（由 Facade 层 CheckPermission 注解校验）.
 */
#[ApiResponse(version: 'low_code')]
class AdminOperationLogApi extends AbstractPermissionApi
{
    #[Inject]
    protected AdminOperationLogAppService $appService;

    /**
     * 查询操作日志列表.
     */
    #[CheckPermission(MagicResourceEnum::SAFE_OPERATION_LOG, MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = AdminOperationLogListRequestDTO::fromRequest($this->request);
        $result = $this->appService->queriesByAuthorization(
            $authorization,
            $requestDTO->page,
            $requestDTO->pageSize,
            $requestDTO->toFilters()
        );
        $dtoList = AdminOperationLogAssembler::toDTOList($result['list']);

        return (new PageDTO($result['page'], $result['total'], $dtoList))->toArray();
    }

    /**
     * 获取操作日志详情.
     */
    #[CheckPermission(MagicResourceEnum::SAFE_OPERATION_LOG, MagicOperationEnum::QUERY)]
    public function show(int $id): array
    {
        $entity = $this->appService->getByIdByAuthorization($this->getAuthorization(), $id);
        if (! $entity) {
            return [];
        }

        return AdminOperationLogAssembler::toDTO($entity)->toArray();
    }
}
