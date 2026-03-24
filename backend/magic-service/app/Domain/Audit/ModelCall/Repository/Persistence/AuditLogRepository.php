<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Repository\Persistence;

use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Repository\Facade\AuditLogRepositoryInterface;
use App\Domain\Audit\ModelCall\Repository\Persistence\Model\AuditLogModel;
use App\Domain\ModelGateway\Repository\Persistence\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;

class AuditLogRepository extends AbstractRepository implements AuditLogRepositoryInterface
{
    public function create(AuditLogEntity $entity): void
    {
        $model = new AuditLogModel();
        $model->fill($this->getAttributes($entity));
        $model->save();
    }

    public function backfillStreamUsageByRequestId(string $requestId, string $productCode, array $usage): void
    {
        if ($requestId === '') {
            return;
        }

        /** @var null|AuditLogModel $model */
        $model = AuditLogModel::query()
            ->where('type', AuditType::TEXT->value)
            ->where('status', 'SUCCESS')
            ->where('product_code', $productCode)
            ->where('detail_info->stream', true)
            ->where('detail_info->extras->request_id', $requestId)
            ->orderByDesc('id')
            ->first();

        if (! $model) {
            return;
        }

        $model->usage = $usage;
        $model->save();
    }

    public function queries(
        Page $page,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false
    ): array {
        $builder = AuditLogModel::query();
        $organizationCode = $this->resolveOrganizationCodeFilter(
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );

        if ($organizationCode !== null) {
            $builder->where('organization_code', $organizationCode);
        }

        if (! empty($filters['type'])) {
            $builder->where('type', (string) $filters['type']);
        }
        if (! empty($filters['status'])) {
            $builder->where('status', (string) $filters['status']);
        }
        if (! empty($filters['product_code'])) {
            $builder->where('product_code', (string) $filters['product_code']);
        }
        if (! empty($filters['user_id'])) {
            $builder->where('user_id', (string) $filters['user_id']);
        }
        if (! empty($filters['start_operation_time'])) {
            $builder->where('operation_time', '>=', (int) $filters['start_operation_time']);
        }
        if (! empty($filters['end_operation_time'])) {
            $builder->where('operation_time', '<=', (int) $filters['end_operation_time']);
        }

        $builder->orderByDesc('id');
        $result = $this->getByPage($builder, $page);
        $rawList = $result['list'] ?? [];
        $list = is_array($rawList) ? $rawList : (method_exists($rawList, 'toArray') ? $rawList->toArray() : []);

        return [
            'total' => (int) $result['total'],
            'list' => $this->formatList($list),
        ];
    }

    /**
     * 普通组织始终强制当前组织过滤；官方组织可选按 organization_code 过滤，不传则看全量.
     */
    private function resolveOrganizationCodeFilter(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): ?string {
        if (! $isOfficialOrganization) {
            return $currentOrganizationCode;
        }

        $organizationCode = trim((string) ($filters['organization_code'] ?? ''));
        if ($organizationCode === '') {
            return null;
        }

        return $organizationCode;
    }

    /**
     * @param array<int, array<string, mixed>> $list
     * @return array<int, array<string, mixed>>
     */
    private function formatList(array $list): array
    {
        foreach ($list as &$item) {
            $item['id'] = isset($item['id']) ? (string) $item['id'] : '';
            $item['user_id'] = (string) ($item['user_id'] ?? '');
            $item['organization_code'] = (string) ($item['organization_code'] ?? '');
            $item['operation_time'] = (int) ($item['operation_time'] ?? 0);
            $item['all_latency'] = (int) ($item['all_latency'] ?? 0);
            $item['usage'] = is_array($item['usage'] ?? null) ? $item['usage'] : [];
            $item['detail_info'] = is_array($item['detail_info'] ?? null) ? $item['detail_info'] : null;
        }

        return $list;
    }
}
