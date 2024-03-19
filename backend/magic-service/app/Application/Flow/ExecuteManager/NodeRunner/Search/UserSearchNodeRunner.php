<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Search;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\Operator;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure\LeftType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure\OperatorType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\UserSearchNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use Hyperf\DbConnection\Db;

#[FlowNodeDefine(
    type: NodeType::UserSearch->value,
    code: NodeType::UserSearch->name,
    name: '人员检索',
    paramsConfig: UserSearchNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: true,
)]
class UserSearchNodeRunner extends AbstractSearchNodeRunner
{
    // 用户检索最大返回数量限制
    private const MAX_SEARCH_RESULTS = 200;

    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $allUserIds = $this->getAvailableIds($executionData, function (
            Operator $operator,
            LeftType $leftType,
            OperatorType $operatorType,
            mixed $rightValue,
            ?array $rangeIds = null
        ): ?array {
            return match ($leftType) {
                LeftType::Username => $this->getUserIdsByUsername($operator, $operatorType, $rightValue, $rangeIds),
                LeftType::WorkNumber => $this->getUserIdsByWorkNumber($operator, $operatorType, $rightValue, $rangeIds),
                LeftType::Position => $this->getUserIdsByPosition($operator, $operatorType, $rightValue, $rangeIds),
                LeftType::Phone => $this->getUserIdsByPhone($operator, $operatorType, $rightValue, $rangeIds),
                LeftType::DepartmentName => $this->getUserIdsByDepartmentName($operator, $operatorType, $rightValue, $rangeIds),
                LeftType::GroupName => $this->getUserIdsByGroupName($operator, $operatorType, $rightValue, $rangeIds),
                default => null,
            };
        });
        $users = [];
        if (! empty($allUserIds)) {
            $magicUserDomain = di(MagicUserDomainService::class);
            $magicAccountDomain = di(MagicAccountDomainService::class);
            $departmentUserDomain = di(MagicDepartmentUserDomainService::class);
            $departmentDomain = di(MagicDepartmentDomainService::class);

            $contactDataIsolation = ContactDataIsolation::create($executionData->getOperator()->getOrganizationCode(), $executionData->getOperator()->getUid());
            $magicUsers = $magicUserDomain->getByUserIds($contactDataIsolation, $allUserIds);
            $magicIds = [];
            foreach ($magicUsers as $magicUser) {
                $magicIds[] = $magicUser->getMagicId();
            }
            $magicAccounts = $magicAccountDomain->getByMagicIds($magicIds);
            $departmentUsers = $departmentUserDomain->getDepartmentUsersByUserIds($allUserIds, $contactDataIsolation);
            $departmentIds = array_column($departmentUsers, 'department_id');

            $departments = $departmentDomain->getDepartmentByIds($contactDataIsolation, $departmentIds, true);
            // 添加 path 去再查一次
            foreach ($departments as $department) {
                $pathDepartments = explode('/', $department->getPath());
                $departmentIds = array_merge($departmentIds, $pathDepartments);
            }
            $departmentIds = array_values(array_unique($departmentIds));
            $departments = $departmentDomain->getDepartmentByIds($contactDataIsolation, $departmentIds, true);

            $userDepartments = [];
            // 一个人可以有很多部门
            foreach ($departmentUsers as $departmentUser) {
                $userDepartments[$departmentUser['user_id']][] = $departmentUser;
            }

            $phoneDesensitization = false;
            if (count($magicUsers) > 1) {
                $phoneDesensitization = true;
            }
            foreach ($magicUsers as $magicUser) {
                // 如果不是人类，过滤
                if ($magicUser->getUserType() !== UserType::Human) {
                    continue;
                }
                if (! $magicAccount = $magicAccounts[$magicUser->getMagicId()] ?? null) {
                    continue;
                }
                $departmentArray = [];
                $userDepartment = $userDepartments[$magicUser->getUserId()] ?? [];
                foreach ($userDepartment as $department) {
                    if (! $departmentEntity = $departments[$department['department_id']] ?? null) {
                        continue;
                    }
                    $pathNames = [];
                    $pathDepartments = explode('/', $departmentEntity->getPath());
                    foreach ($pathDepartments as $pathDepartmentId) {
                        if (isset($departments[$pathDepartmentId])) {
                            $pathNames[] = $departments[$pathDepartmentId]->getName() ?? '';
                        }
                    }
                    $departmentArray[] = [
                        'id' => $departmentEntity->getDepartmentId(),
                        'name' => $departmentEntity->getName(),
                        'path' => implode('/', $pathNames),
                    ];
                }

                $users[] = [
                    'user_id' => $magicUser->getUserId(),
                    'username' => $magicAccount->getRealName(),
                    'position' => $userDepartment[0]['job_title'] ?? '',
                    'country_code' => $magicAccount->getCountryCode(),
                    'phone' => $magicAccount->getPhone($phoneDesensitization),
                    'work_number' => $userDepartment[0]['employee_no'] ?? '',
                    'department' => $departmentArray,
                ];
            }
        }

        $result = [
            'users' => $users,
        ];
        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }

    // -------- 以下方法十分粗暴，不建议学习 🔞🈲 --------  todo 等 es 或 flink cdc 之类的出来再优化

    private function getUserIdsByUsername(Operator $operator, OperatorType $operatorType, mixed $username, ?array $filterUserIds = null): array
    {
        if (! is_string($username) || empty($username)) {
            return [];
        }
        $db = Db::table('magic_contact_accounts')
            ->select(['magic_id'])
            ->where('type', '=', 1);
        switch ($operatorType) {
            case OperatorType::Equals:
                $db->where('real_name', '=', $username);
                break;
            case OperatorType::NoEquals:
                $db->where('real_name', '<>', $username);
                break;
            case OperatorType::Contains:
                $db->where('real_name', 'like', "%{$username}%");
                break;
            case OperatorType::NoContains:
                $db->where('real_name', 'not like', "%{$username}%");
                break;
            default:
                return [];
        }
        $magicIds = $db->limit(self::MAX_SEARCH_RESULTS)->pluck('magic_id')->toArray();
        if (empty($magicIds)) {
            return [];
        }
        $userDB = Db::table('magic_contact_users')
            ->select(['user_id'])
            ->whereIn('magic_id', $magicIds)
            ->where('organization_code', '=', $operator->getOrganizationCode())
            ->where('user_type', '=', 1);
        if (! empty($filterUserIds)) {
            $userDB->whereIn('user_id', $filterUserIds);
        }
        return $userDB->limit(self::MAX_SEARCH_RESULTS)->pluck('user_id')->toArray();
    }

    private function getUserIdsByWorkNumber(Operator $operator, OperatorType $operatorType, mixed $workNumber, ?array $filterUserIds = null): array
    {
        if (! is_string($workNumber) || empty($workNumber)) {
            return [];
        }
        $db = Db::table('magic_contact_department_users')
            ->select(['user_id'])
            ->where('organization_code', '=', $operator->getOrganizationCode());
        switch ($operatorType) {
            case OperatorType::Equals:
                $db->where('employee_no', '=', $workNumber);
                break;
            case OperatorType::NoEquals:
                $db->where('employee_no', '<>', $workNumber);
                break;
            case OperatorType::Contains:
                $db->where('employee_no', 'like', "%{$workNumber}%");
                break;
            case OperatorType::NoContains:
                $db->where('employee_no', 'not like', "%{$workNumber}%");
                break;
            case OperatorType::Empty:
                $db->where('employee_no', '=', '');
                break;
            case OperatorType::NotEmpty:
                $db->where('employee_no', '<>', '');
                break;
            default:
                return [];
        }
        if (! empty($filterUserIds)) {
            $db->whereIn('user_id', $filterUserIds);
        }
        return $db->limit(self::MAX_SEARCH_RESULTS)->pluck('user_id')->toArray();
    }

    private function getUserIdsByPosition(Operator $operator, OperatorType $operatorType, mixed $position, ?array $filterUserIds = null): array
    {
        if (! is_string($position)) {
            return [];
        }
        $db = Db::table('magic_contact_department_users')
            ->select(['user_id'])
            ->where('organization_code', '=', $operator->getOrganizationCode());
        switch ($operatorType) {
            case OperatorType::Equals:
                $db->where('job_title', '=', $position);
                break;
            case OperatorType::NoEquals:
                $db->where('job_title', '<>', $position);
                break;
            case OperatorType::Contains:
                $db->where('job_title', 'like', "%{$position}%");
                break;
            case OperatorType::NoContains:
                $db->where('job_title', 'not like', "%{$position}%");
                break;
            case OperatorType::Empty:
                $db->where('job_title', '=', '');
                break;
            case OperatorType::NotEmpty:
                $db->where('job_title', '<>', '');
                break;
            default:
                return [];
        }
        if (! empty($filterUserIds)) {
            $db->whereIn('user_id', $filterUserIds);
        }
        return $db->limit(self::MAX_SEARCH_RESULTS)->pluck('user_id')->toArray();
    }

    private function getUserIdsByPhone(Operator $operator, OperatorType $operatorType, mixed $phone, ?array $filterUserIds = null): array
    {
        if (! is_string($phone)) {
            return [];
        }
        $db = Db::table('magic_contact_accounts')
            ->select(['magic_id'])
            ->where('type', '=', 1);
        switch ($operatorType) {
            case OperatorType::Equals:
                $db->where('phone', '=', $phone);
                break;
            case OperatorType::NoEquals:
                $db->where('phone', '<>', $phone);
                break;
            case OperatorType::Contains:
                $db->where('phone', 'like', "%{$phone}%");
                break;
            case OperatorType::NoContains:
                $db->where('phone', 'not like', "%{$phone}%");
                break;
            default:
                return [];
        }
        $magicIds = $db->limit(self::MAX_SEARCH_RESULTS)->pluck('magic_id')->toArray();
        if (empty($magicIds)) {
            return [];
        }
        $userDB = Db::table('magic_contact_users')
            ->select(['user_id'])
            ->whereIn('magic_id', $magicIds)
            ->where('organization_code', '=', $operator->getOrganizationCode())
            ->where('user_type', '=', 1);
        if (! empty($filterUserIds)) {
            $userDB->whereIn('user_id', $filterUserIds);
        }
        return $userDB->limit(self::MAX_SEARCH_RESULTS)->pluck('user_id')->toArray();
    }

    private function getUserIdsByGroupName(Operator $operator, OperatorType $operatorType, mixed $groupName, ?array $filterUserIds = null): array
    {
        $db = Db::table('magic_chat_groups')
            ->select(['id'])
            ->where('organization_code', '=', $operator->getOrganizationCode());
        switch ($operatorType) {
            case OperatorType::Equals:
                if (is_array($groupName)) {
                    $groupName = $groupName[0] ?? '';
                }
                if (is_string($groupName) && ! empty($groupName)) {
                    $db->where('group_name', '=', $groupName);
                }
                break;
            case OperatorType::NoEquals:
                if (is_array($groupName)) {
                    $groupName = $groupName[0] ?? '';
                }
                if (is_string($groupName) && ! empty($groupName)) {
                    $db->where('group_name', '<>', $groupName);
                }
                break;
            case OperatorType::Contains:
                if (is_string($groupName)) {
                    $db->where('group_name', 'like', "%{$groupName}%");
                } elseif (is_array($groupName)) {
                    $db->whereIn('group_name', $groupName);
                }
                break;
            case OperatorType::NoContains:
                if (is_string($groupName)) {
                    $db->where('group_name', 'not like', "%{$groupName}%");
                } elseif (is_array($groupName)) {
                    $db->whereNotIn('group_name', $groupName);
                }
                break;
            default:
                return [];
        }
        $groupIds = $db->limit(self::MAX_SEARCH_RESULTS)->pluck('id')->toArray();
        if (empty($groupIds)) {
            return [];
        }
        $userDB = Db::table('magic_chat_group_users')
            ->select(['user_id'])
            ->whereIn('group_id', $groupIds)
            ->where('organization_code', '=', $operator->getOrganizationCode());
        if (! empty($filterUserIds)) {
            $userDB->whereIn('user_id', $filterUserIds);
        }
        return $userDB->limit(self::MAX_SEARCH_RESULTS)->pluck('user_id')->toArray();
    }

    private function getUserIdsByDepartmentName(Operator $operator, OperatorType $operatorType, mixed $department, ?array $filterUserIds = null): array
    {
        $db = Db::table('magic_contact_departments')
            ->select(['department_id', 'path'])
            ->where('organization_code', '=', $operator->getOrganizationCode());
        switch ($operatorType) {
            case OperatorType::Equals:
                $departmentName = $department;
                if (is_array($department)) {
                    $departmentName = $department[0]['name'] ?? '';
                }
                if (is_string($departmentName) && ! empty($departmentName)) {
                    $db->where('name', '=', $departmentName);
                }
                break;
            case OperatorType::NoEquals:
                $departmentName = $department;
                if (is_array($department)) {
                    $departmentName = $department[0]['name'] ?? '';
                }
                if (is_string($departmentName) && ! empty($departmentName)) {
                    $db->where('name', '<>', $departmentName);
                }
                break;
            case OperatorType::Contains:
                if (is_string($department)) {
                    $db = $db->where('name', 'like', "%{$department}%");
                } elseif (is_array($department)) {
                    $db->whereIn('name', array_column($department, 'name'));
                }
                break;
            case OperatorType::NoContains:
                if (is_string($department)) {
                    $db->where('name', 'not like', "%{$department}%");
                } elseif (is_array($department)) {
                    $db->whereNotIn('name', array_column($department, 'name'));
                }
                break;
            default:
                return [];
        }
        $departmentPaths = $db->limit(self::MAX_SEARCH_RESULTS)->pluck('path', 'department_id')->toArray();
        if (empty($departmentPaths)) {
            return [];
        }
        // 获取这些部门的所有下级部门id
        $departmentSubIds = $this->getAllChildrenByDepartmentIds($operator, $departmentPaths);
        $departmentIds = array_merge(array_keys($departmentPaths), $departmentSubIds);
        $userDB = Db::table('magic_contact_department_users')
            ->select(['user_id'])
            ->whereIn('department_id', $departmentIds)
            ->where('organization_code', '=', $operator->getOrganizationCode());
        if (! empty($filterUserIds)) {
            $userDB->whereIn('user_id', $filterUserIds);
        }
        return $userDB->limit(self::MAX_SEARCH_RESULTS)->pluck('user_id')->toArray();
    }

    private function getAllChildrenByDepartmentIds(Operator $operator, array $departmentPaths): array
    {
        $allDepartments = Db::table('magic_contact_departments')
            ->select(['department_id', 'parent_department_id', 'name', 'path'])
            ->where('organization_code', '=', $operator->getOrganizationCode())
            ->get()
            ->toArray();

        $childrenDepartments = [];
        foreach ($allDepartments as $department) {
            foreach ($departmentPaths as $departmentId => $departmentPath) {
                if (str_starts_with($department->path, $departmentPath)) {
                    $childrenDepartments[$departmentId][] = $department->department_id;
                }
            }
        }

        $departmentsChildrenIds = $childrenDepartments;
        // 合并 && 去重
        $departmentIds = array_merge(...$departmentsChildrenIds);
        return array_values(array_unique($departmentIds));
    }
}
