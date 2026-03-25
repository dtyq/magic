<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Audit\Facade;

use App\Application\Audit\ModelCall\Service\AuditService as ModelAuditService;
use App\Application\Audit\Service\AdminOperationLogAppService;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Audit\Assembler\AdminOperationLogAssembler;
use App\Interfaces\Audit\DTO\AdminOperationLogListRequestDTO;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\Permission\Facade\AbstractPermissionApi;
use DateTimeImmutable;
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

    #[Inject]
    protected ModelAuditService $modelAuditService;

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

    /**
     * 模型调用审计列表（展示接口）.
     */
    #[CheckPermission(MagicResourceEnum::SAFE_MODEL_AUDIT_LOG, MagicOperationEnum::QUERY)]
    public function listModelAudit(): array
    {
        $authorization = $this->getAuthorization();
        $currentOrganizationCode = (string) $authorization->getOrganizationCode();
        $isOfficialOrganization = OfficialOrganizationUtil::isOfficialOrganization($currentOrganizationCode);

        $filters = [];
        $type = (string) $this->request->input('type', '');
        $status = (string) $this->request->input('status', '');
        $productCode = (string) $this->request->input('product_code', '');
        $userId = (string) $this->request->input('user_id', '');
        $accessScope = trim((string) $this->request->input('access_scope', ''));
        $magicTopicId = trim((string) $this->request->input('magic_topic_id', ''));
        $organizationCode = trim((string) $this->request->input('organization_code', ''));
        $startDate = (string) $this->request->input('start_date', '');
        $endDate = (string) $this->request->input('end_date', '');

        if ($type !== '') {
            $filters['type'] = $type;
        }
        if ($status !== '') {
            $filters['status'] = $status;
        }
        if ($productCode !== '') {
            $filters['product_code'] = $productCode;
        }
        if ($userId !== '') {
            $filters['user_id'] = $userId;
        }
        if ($accessScope !== '') {
            $filters['access_scope'] = $accessScope;
        }
        if ($magicTopicId !== '') {
            $filters['magic_topic_id'] = $magicTopicId;
        }
        if ($isOfficialOrganization && $organizationCode !== '') {
            $filters['organization_code'] = $organizationCode;
        }
        $startDateMs = $this->parseDateToMs($startDate, false);
        $endDateMs = $this->parseDateToMs($endDate, true);
        if ($startDateMs !== null) {
            $filters['start_operation_time'] = $startDateMs;
        }
        if ($endDateMs !== null) {
            $filters['end_operation_time'] = $endDateMs;
        }

        return $this->modelAuditService->listForAdmin(
            (int) $this->request->input('page', 1),
            (int) $this->request->input('page_size', 10),
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );
    }

    private function parseDateToMs(string $date, bool $isEndOfDay): ?int
    {
        if ($date === '') {
            return null;
        }

        $dateTime = DateTimeImmutable::createFromFormat(
            'Y-m-d H:i:s',
            $date . ($isEndOfDay ? ' 23:59:59' : ' 00:00:00')
        );
        if (! $dateTime) {
            return null;
        }

        return $dateTime->getTimestamp() * 1000;
    }
}
