<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Chat\DTO\PageResponseDTO\DepartmentsPageResponseDTO;
use App\Domain\Chat\Entity\ValueObject\PlatformRootDepartmentId;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Domain\Contact\Repository\Facade\MagicDepartmentRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Chat\Assembler\DepartmentAssembler;
use Hyperf\Cache\Annotation\Cacheable;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use JetBrains\PhpStorm\ArrayShape;
use Psr\Log\LoggerInterface;
use Throwable;

class MagicDepartmentRepository implements MagicDepartmentRepositoryInterface
{
    public function __construct(
        protected DepartmentModel $model,
        protected Redis $redis,
        protected LockerInterface $locker,
        protected LoggerInterface $logger,
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(get_class($this));
        } catch (Throwable) {
        }
    }

    public function getDepartmentById(string $departmentId, string $organizationCode): ?MagicDepartmentEntity
    {
        $department = $this->model->newQuery()
            ->where('organization_code', $organizationCode)
            ->where('department_id', $departmentId);
        $department = Db::select($department->toSql(), $department->getBindings())[0] ?? null;
        if (empty($department)) {
            return null;
        }
        return DepartmentAssembler::getDepartmentEntity($department);
    }

    /**
     * @return MagicDepartmentEntity[]
     */
    public function getDepartmentsByIds(array $departmentIds, string $organizationCode, bool $keyById = false): array
    {
        if (empty($departmentIds)) {
            return [];
        }
        $departments = $this->model->newQuery()
            ->where('organization_code', $organizationCode)
            ->whereIn('department_id', $departmentIds);
        $departments = Db::select($departments->toSql(), $departments->getBindings());
        return $this->getDepartmentsEntity($departments, $keyById);
    }

    /**
     * @return MagicDepartmentEntity[]
     */
    public function getDepartmentsByIdsInMagic(array $departmentIds, bool $keyById = false): array
    {
        if (empty($departmentIds)) {
            return [];
        }
        $departments = $this->model->newQuery()
            ->whereIn('department_id', $departmentIds);
        $departments = Db::select($departments->toSql(), $departments->getBindings());
        return $this->getDepartmentsEntity($departments, $keyById);
    }

    public function getSubDepartmentsById(string $departmentId, string $organizationCode, int $size, int $offset): DepartmentsPageResponseDTO
    {
        $departments = $this->model->newQuery()
            ->where('organization_code', $organizationCode)
            ->where('parent_department_id', $departmentId)
            ->limit($size)
            ->offset($offset)
            ->orderBy('id');
        $departments = Db::select($departments->toSql(), $departments->getBindings());
        $items = $this->getDepartmentsEntity($departments);
        $hasMore = count($items) === $size;
        $pageToken = $hasMore ? (string) ($offset + $size) : '';
        return new DepartmentsPageResponseDTO([
            'items' => $items,
            'has_more' => $hasMore,
            'page_token' => $pageToken,
        ]);
    }

    /**
     * 获取某一层级的部门.
     */
    public function getSubDepartmentsByLevel(int $level, string $organizationCode, int $depth, int $size, int $offset): DepartmentsPageResponseDTO
    {
        $departments = $this->getSubDepartmentsByLevelCache($level, $organizationCode, $depth, $size, $offset);
        $magicDepartmentEntities = $this->getDepartmentsEntity($departments);
        // 下一级子部门有不可预测的数量，因此只要返回数量与limit一致，就认为有下一页
        $hasMore = count($magicDepartmentEntities) === $size;
        $pageToken = $hasMore ? (string) ($offset + $size) : '';
        return new DepartmentsPageResponseDTO([
            'items' => $magicDepartmentEntities,
            'has_more' => $hasMore,
            'page_token' => $pageToken,
        ]);
    }

    // 给定的部门id是否有下级部门
    #[ArrayShape([
        'parent_department_id' => 'string',
    ])]
    public function hasChildDepartment(array $departmentIds, string $organizationCode): array
    {
        $query = $this->model->newQuery()
            ->select('parent_department_id')
            ->where('organization_code', $organizationCode)
            ->whereIn('parent_department_id', $departmentIds)
            ->groupBy(['parent_department_id']);
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function getDepartmentByParentId(string $departmentId, string $organizationCode): ?MagicDepartmentEntity
    {
        // 对于前端来说, -1 表示根部门信息.
        $query = $this->model->newQuery()->where('organization_code', $organizationCode);
        if ($departmentId === PlatformRootDepartmentId::Magic) {
            $query->where(function (Builder $query) {
                $query->where('parent_department_id', '=', '')->orWhereNull('parent_department_id');
            });
        } else {
            $query->whereIn('parent_department_id', $departmentId);
        }
        $department = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        if (empty($department)) {
            return null;
        }
        return DepartmentAssembler::getDepartmentEntity($department);
    }

    /**
     * @return MagicDepartmentEntity[]
     */
    public function searchDepartments(string $departmentName, string $organizationCode, string $pageToken = '', ?int $pageSize = null): array
    {
        $departments = $this->model->newQuery()
            ->where('organization_code', $organizationCode)
            ->where('name', 'like', sprintf('%%%s%%', $departmentName))
            ->limit(100)
            /* @phpstan-ignore-next-line */
            ->when($pageSize, function (Builder $query) use ($pageToken, $pageSize) {
                // $pageToken 为查询总量
                $page = ((int) ceil((int) $pageToken / $pageSize)) + 1;
                $query->forPage($page, $pageSize);
            });
        $departments = Db::select($departments->toSql(), $departments->getBindings());
        return $this->getDepartmentsEntity($departments);
    }

    /**
     * 获取组织的所有部门.
     * @return MagicDepartmentEntity[]
     */
    public function getOrganizationDepartments(string $organizationCode, array $fields = ['*'], bool $keyById = false): array
    {
        $departments = $this->getOrganizationDepartmentsRaw($organizationCode);
        return $this->getDepartmentsEntity($departments, $keyById);
    }

    public function addDepartmentDocument(string $departmentId, string $documentId): void
    {
        $this->model->newQuery()->where('department_id', $departmentId)->update(['document_id' => $documentId]);
    }

    /**
     * 获取部门的所有子部门的成员总数.
     * 使用自旋锁避免并发，一次性查询所有部门数据并缓存到 Redis.
     */
    public function getSelfAndChildrenEmployeeSum(MagicDepartmentEntity $magicDepartmentEntity): int
    {
        $organizationCode = $magicDepartmentEntity->getOrganizationCode();
        $departmentId = $magicDepartmentEntity->getDepartmentId();

        // 先尝试从 Redis 缓存获取
        $cacheKey = sprintf('department_employee_sum:%s', $organizationCode);

        $cachedData = $this->redis->hget($cacheKey, $departmentId);
        if ($cachedData !== false) {
            return (int) $cachedData;
        }

        // 使用自旋锁避免并发计算
        $lockKey = sprintf('department_calc_lock:%s', $organizationCode);
        $lockOwner = uniqid('dept_calc_', true);

        if (! $this->locker->spinLock($lockKey, $lockOwner, 30)) {
            return 0;
        }

        try {
            // 一次性获取组织下的所有部门数据
            $allDepartments = $this->getAllDepartmentsForCalculation($organizationCode);

            // 计算每个部门的员工总数并缓存到 Redis
            $this->calculateAndCacheAllDepartmentEmployeeSums($organizationCode, $allDepartments, $cacheKey);
            $result = $this->redis->hget($cacheKey, $departmentId);

            return $result !== false ? (int) $result : 0;
        } catch (Throwable $e) {
            $this->logger->error('Exception in getSelfAndChildrenEmployeeSum', [
                'organization_code' => $organizationCode,
                'department_id' => $departmentId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // 发生异常时直接计算不走缓存
            return $this->calculateSelfAndChildrenEmployeeSum($organizationCode, $departmentId);
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    /**
     * @param MagicDepartmentEntity[] $magicDepartmentsDTO
     * @return MagicDepartmentEntity[]
     */
    public function createDepartments(array $magicDepartmentsDTO): array
    {
        $time = date('Y-m-d H:i:s');
        $departments = [];
        foreach ($magicDepartmentsDTO as $magicDepartmentDTO) {
            if (empty($magicDepartmentDTO->getId())) {
                $department['id'] = (string) IdGenerator::getSnowId();
                $magicDepartmentDTO->setId($department['id']);
            }
            if (empty($magicDepartmentDTO->getCreatedAt())) {
                $magicDepartmentDTO->setCreatedAt($time);
            }
            if (empty($magicDepartmentDTO->getUpdatedAt())) {
                $magicDepartmentDTO->setUpdatedAt($time);
            }
            $department = $magicDepartmentDTO->toArray();
            unset($department['has_child']);
            $departments[] = $department;
        }
        $this->model::query()->insert($departments);
        return $magicDepartmentsDTO;
    }

    public function updateDepartment(string $departmentId, array $data, string $organizationCode): int
    {
        unset($data['has_child']);
        return $this->model->newQuery()
            ->where('department_id', $departmentId)
            ->where('organization_code', $organizationCode)
            ->update($data);
    }

    public function updateDepartmentsOptionByIds(array $departmentIds, ?DepartmentOption $departmentOption = null): int
    {
        if (empty($departmentIds)) {
            return 0;
        }
        $data['option'] = $departmentOption?->value;
        $data['updated_at'] = date('Y-m-d H:i:s');
        return $this->model->newQuery()->whereIn('department_id', $departmentIds)->update($data);
    }

    /**
     * 根据部门ID批量删除部门（逻辑删除，设置 deleted_at 字段）。
     */
    public function deleteDepartmentsByIds(array $departmentIds, string $organizationCode): int
    {
        if (empty($departmentIds)) {
            return 0;
        }
        return $this->model->newQuery()
            ->where('organization_code', $organizationCode)
            ->whereIn('department_id', $departmentIds)
            ->delete();
    }

    public function getDepartmentRootId(string $organizationCode): ?string
    {
        $department = $this->model->newQuery()
            ->where('organization_code', $organizationCode)
            ->where('department_id', '=', PlatformRootDepartmentId::Magic)
            ->first();

        return $department?->department_id;
    }

    /**
     * 批量获取多个组织的根部门信息.
     * @param array $organizationCodes 组织代码数组
     * @return MagicDepartmentEntity[] 根部门实体数组
     */
    public function getOrganizationsRootDepartment(array $organizationCodes): array
    {
        if (empty($organizationCodes)) {
            return [];
        }

        $departments = $this->model->newQuery()
            ->whereIn('organization_code', $organizationCodes)
            ->where('department_id', '=', PlatformRootDepartmentId::Magic);

        $departments = Db::select($departments->toSql(), $departments->getBindings());
        return $this->getDepartmentsEntity($departments);
    }

    /**
     * Get all organizations root departments with pagination support.
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param string $organizationName Organization name for fuzzy search (optional)
     * @return array Array containing total and list
     */
    public function getAllOrganizationsRootDepartments(int $page = 1, int $pageSize = 20, string $organizationName = ''): array
    {
        $query = $this->model->newQuery()
            ->where('department_id', '=', PlatformRootDepartmentId::Magic)
            ->where('parent_department_id', '-1');

        // Add organization name fuzzy search if provided
        if (! empty($organizationName)) {
            $query->where(function ($query) use ($organizationName) {
                $query->orWhere('name', 'like', sprintf('%%%s%%', $organizationName));
                $query->orWhere('organization_code', '=', $organizationName);
            });
        }

        // Get total count for pagination
        $totalQuery = clone $query;
        $total = $totalQuery->count();

        // Apply pagination
        $offset = ($page - 1) * $pageSize;
        $query->limit($pageSize)->offset($offset)->orderBy('created_at', 'desc');

        $departments = Db::select($query->toSql(), $query->getBindings());
        $list = $this->getDepartmentsEntity($departments);

        return [
            'total' => $total,
            'list' => $list,
        ];
    }

    /**
     * @return MagicDepartmentEntity[]
     */
    protected function getDepartmentsEntity(array $departments, bool $keyById = false): array
    {
        $departmentsEntity = [];
        foreach ($departments as $department) {
            $departmentEntity = DepartmentAssembler::getDepartmentEntity($department);
            if ($keyById) {
                $departmentsEntity[$departmentEntity->getDepartmentId()] = $departmentEntity;
            } else {
                $departmentsEntity[] = $departmentEntity;
            }
        }
        return $departmentsEntity;
    }

    #[Cacheable(prefix: 'get_organization_departments_raw', value: '#{organizationCode}', ttl: 60)]
    private function getOrganizationDepartmentsRaw(string $organizationCode): array
    {
        $departments = $this->model->newQuery()->where('organization_code', $organizationCode);
        return Db::select($departments->toSql(), $departments->getBindings());
    }

    #[Cacheable(prefix: 'getSubDepartmentsByLevel', ttl: 60)]
    private function getSubDepartmentsByLevelCache(int $currentDepartmentLevel, string $organizationCode, int $depth, int $size, int $offset): array
    {
        $minDepth = $currentDepartmentLevel + 1;
        $maxDepth = $currentDepartmentLevel + $depth;
        if ($minDepth > $maxDepth) {
            return [];
        }
        $query = $this->model->newQuery()
            ->where('organization_code', $organizationCode);
        if ($minDepth === $maxDepth) {
            $query->where('level', $minDepth);
        } else {
            $query->whereBetween('level', [$minDepth, $maxDepth]);
        }
        $query->limit($size)->offset($offset)->orderBy('id');
        return Db::select($query->toSql(), $query->getBindings());
    }

    /**
     * 一次性获取组织下的所有部门数据，用于员工数计算.
     */
    private function getAllDepartmentsForCalculation(string $organizationCode): array
    {
        $query = $this->model::query()
            ->select(['department_id', 'parent_department_id', 'path', 'employee_sum', 'level'])
            ->where('organization_code', $organizationCode);

        return Db::select($query->toSql(), $query->getBindings());
    }

    /**
     * 计算并缓存所有部门的员工总数.
     */
    private function calculateAndCacheAllDepartmentEmployeeSums(string $organizationCode, array $allDepartments, string $cacheKey): void
    {
        $departmentSums = [];

        // 1) 初始化：每个部门先放入自身直属人数
        foreach ($allDepartments as $department) {
            $deptId = (string) $department['department_id'];
            $departmentSums[$deptId] = (int) ($department['employee_sum'] ?? 0);
        }

        // 2) 自底向上：按 level 从大到小，把子部门累计值加到父部门
        usort($allDepartments, static function (array $a, array $b): int {
            return (int) ($b['level'] ?? 0) <=> (int) ($a['level'] ?? 0);
        });

        foreach ($allDepartments as $department) {
            $deptId = (string) $department['department_id'];
            $parentId = (string) ($department['parent_department_id'] ?? '');

            if ($parentId === '' || $parentId === '-1') {
                continue; // 跳过无父级或根节点
            }

            $childSum = (int) ($departmentSums[$deptId] ?? 0);
            if ($childSum === 0) {
                continue;
            }

            if (! isset($departmentSums[$parentId])) {
                $departmentSums[$parentId] = 0;
            }
            $departmentSums[$parentId] += $childSum;
        }

        // 批量写入 Redis 缓存
        try {
            if (! empty($departmentSums)) {
                // 确保所有值都是字符串格式
                $stringDepartmentSums = [];
                foreach ($departmentSums as $deptId => $sum) {
                    $stringDepartmentSums[$deptId] = (string) $sum;
                }
                $this->redis->multi();
                // 使用 hmset 一次性设置多个 hash 字段
                $this->redis->hmset($cacheKey, $stringDepartmentSums);
                // 设置缓存过期时间
                $this->redis->expire($cacheKey, 60 * 5);
                $results = $this->redis->exec();

                // 检查事务执行结果
                if ($results === false) {
                    $this->logger->error('Redis transaction failed', [
                        'cache_key' => $cacheKey,
                        'organization_code' => $organizationCode,
                    ]);
                }
            } else {
                $this->logger->warning('departmentSums is empty, skipping Redis write', [
                    'organization_code' => $organizationCode,
                ]);
            }
        } catch (Throwable $e) {
            // Redis 异常时记录日志，但不影响业务流程
            $this->logger->warning('calculateAndCacheAllDepartmentEmployeeSums Failed to cache department employee sums', [
                'organization_code' => $organizationCode,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 直接计算单个部门的员工总数（不使用缓存）.
     */
    private function calculateSelfAndChildrenEmployeeSum(string $organizationCode, string $departmentId): int
    {
        $query = $this->model->newQuery()
            ->select(['employee_sum'])
            ->where('organization_code', $organizationCode)
            ->where('path', 'like', sprintf('%%%s%%', $departmentId));

        $departments = Db::select($query->toSql(), $query->getBindings());

        $employeeSum = 0;
        foreach ($departments as $department) {
            $employeeSum += (int) ($department['employee_sum'] ?? 0);
        }

        return $employeeSum;
    }
}
