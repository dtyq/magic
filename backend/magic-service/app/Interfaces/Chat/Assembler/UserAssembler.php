<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicDepartmentUserEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Domain\Contact\Entity\ValueObject\EmployeeType;
use App\Interfaces\Chat\DTO\UserDepartmentDetailDTO;
use App\Interfaces\Chat\DTO\UserDetailDTO;
use Hyperf\Logger\LoggerFactory;

class UserAssembler
{
    public function __construct()
    {
    }

    /**
     * @param AccountEntity[] $accounts
     */
    public static function getAgentList(array $agents, array $accounts): array
    {
        /** @var AccountEntity[] $accounts */
        $accounts = array_column($accounts, null, 'magic_id');
        $agentList = [];
        foreach ($agents as $agent) {
            $agentAccount = $accounts[$agent['magic_id']] ?? null;
            if ($agentAccount instanceof AccountEntity) {
                $agentAccount = $agentAccount->toArray();
            } else {
                $agentAccount = [];
            }
            $label = explode(',', $agentAccount['extra']['label'] ?? '');
            $label = empty($label[0]) ? [] : $label;
            $agentList[] = [
                'id' => $agent['user_id'],
                'label' => $label,
                'like_num' => $agentAccount['extra']['like_num'] ?? 0,
                'friend_num' => $agentAccount['extra']['friend_num'] ?? 0,
                'nickname' => $agent['nickname'],
                'description' => $agent['description'],
                'avatar_url' => $agent['avatar_url'],
            ];
        }
        return $agentList;
    }

    public static function getUserInfos(array $userInfos): array
    {
        // 强转用户 id 类型为 string
        foreach ($userInfos as &$user) {
            // 不返回 magic_id 和 id
            unset($user['magic_id'], $user['id']);
        }
        return $userInfos;
    }

    public static function getUserEntity(array $user): MagicUserEntity
    {
        return new MagicUserEntity($user);
    }

    public static function getUserEntities(array $users): array
    {
        $userEntities = [];
        foreach ($users as $user) {
            $userEntities[] = self::getUserEntity($user);
        }
        return $userEntities;
    }

    public static function getAccountEntity(array $account): AccountEntity
    {
        return new AccountEntity($account);
    }

    public static function getAccountEntities(array $accounts): array
    {
        $accountEntities = [];
        foreach ($accounts as $account) {
            $accountEntities[] = self::getAccountEntity($account);
        }
        return $accountEntities;
    }

    /**
     * @param AccountEntity[] $accounts
     * @param MagicUserEntity[] $users
     * @return array<UserDetailDTO>
     */
    public static function getUsersDetail(array $users, array $accounts): array
    {
        $logger = di(LoggerFactory::class)->get('UserAssembler');
        /** @var array<AccountEntity> $accounts */
        $accounts = array_column($accounts, null, 'magic_id');
        $userDetailDTOList = [];
        foreach ($users as $user) {
            $account = $accounts[$user['magic_id']] ?? null;
            if (empty($account)) {
                $logger->warning("用户[magic_id: {$user['magic_id']} ]不存在, 跳过！");
                continue;
            }
            // 如果存在手机号，将手机号的中间四位替换为*
            $phone = $account->getPhone();
            if (! empty($phone)) {
                $phone = substr_replace($phone, '****', 3, 4);
            }
            $userDetailAdd = [
                'country_code' => $account->getCountryCode(),
                'phone' => $phone,
                'email' => empty($account->getEmail()) ? null : $account->getEmail(),
                'real_name' => $account->getRealName(),
                'account_type' => $account->getType()->value,
                'ai_code' => $account->getAiCode(),
            ];

            foreach ($user->toArray() as $key => $value) {
                if (isset($userDetailAdd[$key])) {
                    // 如果已经存在，跳过
                    continue;
                }
                $userDetailAdd[$key] = $value;
            }
            $userDetailDTOList[] = new UserDetailDTO($userDetailAdd);
        }
        return $userDetailDTOList;
    }

    /**
     * 一个用户可能存在于多个部门.
     * @param MagicDepartmentUserEntity[] $departmentUsers
     * @param UserDetailDTO[] $usersDetail
     * @param array<string, MagicDepartmentEntity[]> $departmentsInfo
     * @param bool $withDepartmentFullPath 是否返回部门的完整路径
     * @return UserDepartmentDetailDTO[]
     */
    public static function getUserDepartmentDetailDTOList(
        array $departmentUsers,
        array $usersDetail,
        array $departmentsInfo,
        bool $withDepartmentFullPath = false
    ): array {
        /** @var array<UserDepartmentDetailDTO> $usersDepartmentDetailDTOList */
        $usersDepartmentDetailDTOList = [];

        // 步骤1: 构建用户ID到部门关系的映射
        $userDepartmentMap = [];
        foreach ($departmentUsers as $departmentUser) {
            $userDepartmentMap[$departmentUser->getUserId()][] = $departmentUser;
        }

        // 步骤2: 为每个用户构建详细信息
        foreach ($usersDetail as $userInfo) {
            $userId = $userInfo->getUserId();
            $userDepartmentRelations = $userDepartmentMap[$userId] ?? [];

            // 步骤2.1: 收集部门路径信息
            $allPathNodes = [];
            $fullPathNodes = [];

            foreach ($userDepartmentRelations as $departmentUser) {
                $userDepartmentId = $departmentUser['department_id'] ?? '';
                /** @var MagicDepartmentEntity[] $departments */
                $departments = $departmentsInfo[$userDepartmentId] ?? [];

                if (! empty($departments)) {
                    if ($withDepartmentFullPath) {
                        // 完整路径模式: 为每个部门保存完整层级结构
                        $pathNodes = array_map(
                            fn (MagicDepartmentEntity $department) => self::assemblePathNodeByDepartmentInfo($department),
                            $departments
                        );
                        $fullPathNodes[$userDepartmentId] = $pathNodes;
                    } else {
                        // 简略模式: 只取每个部门的最后一个节点
                        $departmentInfo = end($departments);
                        $pathNode = self::assemblePathNodeByDepartmentInfo($departmentInfo);
                        $allPathNodes[] = $pathNode;
                    }
                }
            }

            // 步骤2.2: 使用默认部门关系作为基础信息
            $defaultDepartmentUser = $userDepartmentRelations[0] ?? [];

            // 步骤2.3: 更新或创建用户部门详情对象
            if (! empty($usersDepartmentDetailDTOList[$userId])) {
                // 更新已存在的用户部门详情
                $userDepartmentDetailDTO = $usersDepartmentDetailDTOList[$userId];

                if ($withDepartmentFullPath && ! empty($fullPathNodes)) {
                    $userDepartmentDetailDTO->setFullPathNodes($fullPathNodes);
                } elseif (! empty($allPathNodes)) {
                    $userDepartmentDetailDTO->setPathNodes($allPathNodes);
                }
            } else {
                // 创建新的用户部门详情
                $userDepartmentDetail = [
                    'employee_type' => $defaultDepartmentUser['employee_type'] ?? EmployeeType::Unknown->value,
                    'employee_no' => $defaultDepartmentUser['employee_no'] ?? '',
                    'job_title' => $defaultDepartmentUser['job_title'] ?? '',
                    'is_leader' => (bool) ($defaultDepartmentUser['is_leader'] ?? false),
                ];

                // 添加路径节点信息
                if ($withDepartmentFullPath) {
                    $userDepartmentDetail['full_path_nodes'] = $fullPathNodes;
                } else {
                    $userDepartmentDetail['path_nodes'] = $allPathNodes;
                }

                // 合并用户基本信息
                $userInfoArray = $userInfo->toArray();
                foreach ($userInfoArray as $key => $value) {
                    $userDepartmentDetail[$key] = $value;
                }

                $userDepartmentDetailDTO = new UserDepartmentDetailDTO($userDepartmentDetail);
                $usersDepartmentDetailDTOList[$userId] = $userDepartmentDetailDTO;
            }
        }

        return array_values($usersDepartmentDetailDTOList);
    }

    private static function assemblePathNodeByDepartmentInfo(MagicDepartmentEntity $departmentInfo): array
    {
        return [
            // 部门名称
            'department_name' => $departmentInfo->getName(),
            // 部门id
            'department_id' => $departmentInfo->getDepartmentId(),
            'parent_department_id' => $departmentInfo->getParentDepartmentId(),
            // 部门路径
            'path' => $departmentInfo->getPath(),
            // 可见性
            'visible' => ! ($departmentInfo->getOption() === DepartmentOption::Hidden),
            'option' => $departmentInfo->getOption(),
        ];
    }
}
