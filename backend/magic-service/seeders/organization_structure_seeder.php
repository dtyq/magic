<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Chat\Entity\ValueObject\PlatformRootDepartmentId;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Seeders\Seeder;
use Hyperf\DbConnection\Db;

class organizationstructureseeder extends Seeder
{
    public function run(): void
    {
        $organizationCodes = ['test001', 'test002'];
        $organizationNames = ['测试组织', '演示组织'];
        $departmentStructure = [
            [
                'name' => '', // 会被 $organizationNames 替换
                'level' => 0,
                'department_id' => PlatformRootDepartmentId::Magic,
                'parent_department_id' => PlatformRootDepartmentId::Magic, // 表明自己就是根部门
                'children' => [
                    [
                        'name' => '技术部',
                        'level' => 1,
                        'children' => [
                            ['name' => '前端组', 'level' => 2],
                            ['name' => '后端组', 'level' => 2],
                            ['name' => '测试组', 'level' => 2],
                        ],
                    ],
                    [
                        'name' => '产品部',
                        'level' => 1,
                        'children' => [
                            ['name' => '设计组', 'level' => 2],
                            ['name' => '产品组', 'level' => 2],
                        ],
                    ],
                    [
                        'name' => '市场部',
                        'level' => 1,
                        'children' => [
                            ['name' => '营销组', 'level' => 2],
                            ['name' => '销售组', 'level' => 2],
                        ],
                    ],
                    [
                        'name' => '人事部',
                        'level' => 1,
                    ],
                ],
            ],
        ];

        try {
            // 开启事务
            Db::beginTransaction();

            // 确保环境记录存在
            $environmentId = env('MAGIC_ENV_ID');

            // 1. 创建/检查组织与环境的关系
            foreach ($organizationCodes as $index => $orgCode) {
                // 检查组织环境关联是否已存在
                $existingOrgEnv = Db::table('magic_organizations_environment')
                    ->where('magic_organization_code', $orgCode)
                    ->first();

                if ($existingOrgEnv) {
                    echo "组织环境关联已存在: {$existingOrgEnv['magic_organization_code']}, 登录码: {$existingOrgEnv['login_code']}" . PHP_EOL;
                } else {
                    // 创建组织环境关联
                    $orgEnvData = [
                        'login_code' => random_int(100000, 999999),
                        'magic_organization_code' => $orgCode,
                        'origin_organization_code' => $orgCode,
                        'environment_id' => $environmentId,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ];

                    $orgEnvId = Db::table('magic_organizations_environment')->insertGetId($orgEnvData);
                    echo "已创建组织环境关联: {$orgCode}, ID: {$orgEnvId}" . PHP_EOL;
                }

                // 2. 创建部门结构
                $departmentStructure[0]['name'] = $organizationNames[$index];
                $this->createDepartments($departmentStructure, $orgCode);

                // 3. 分配用户到部门
                $this->assignUsersToDepartments($orgCode);
            }

            // 提交事务
            Db::commit();
            echo '组织架构数据填充完成' . PHP_EOL;
        } catch (Throwable $e) {
            // 回滚事务
            Db::rollBack();
            echo '数据填充失败: ' . $e->getMessage() . PHP_EOL;
            echo 'file: ' . $e->getFile() . PHP_EOL;
            echo 'line: ' . $e->getLine() . PHP_EOL;
            echo 'trace: ' . $e->getTraceAsString() . PHP_EOL;

            // 重新抛出异常以终止执行
            throw $e;
        }
    }

    /**
     * 递归创建部门.
     */
    private function createDepartments(array $departments, string $orgCode, ?string $parentDepartmentId = null, ?string $path = null): void
    {
        foreach ($departments as $dept) {
            // 使用预设部门ID或生成新的部门ID
            $departmentId = isset($dept['department_id']) ? $dept['department_id'] : IdGenerator::getSnowId();

            // 使用预设父部门ID或使用传入的父部门ID
            $currentParentDepartmentId = isset($dept['parent_department_id']) ? $dept['parent_department_id'] : $parentDepartmentId;

            // 构建部门路径
            if (isset($dept['department_id']) && $dept['department_id'] === PlatformRootDepartmentId::Magic) {
                // 如果是组织层级（根部门），使用特殊路径
                $currentPath = PlatformRootDepartmentId::Magic;
            } else {
                // 否则使用常规路径构建逻辑
                $currentPath = $path ? $path . '/' . $departmentId : PlatformRootDepartmentId::Magic . '/' . $departmentId;
            }

            // 构建部门数据
            $departmentData = [
                'department_id' => $departmentId,
                'parent_department_id' => $currentParentDepartmentId,
                'name' => $dept['name'],
                'i18n_name' => json_encode(['zh-CN' => $dept['name'], 'en-US' => $this->translateDepartmentName($dept['name'])]),
                'order' => '0',
                'leader_user_id' => '', // 暂时空着，后面更新
                'organization_code' => $orgCode,
                'status' => json_encode(['is_deleted' => false]),
                'document_id' => IdGenerator::getSnowId(),
                'level' => $dept['level'],
                'path' => $currentPath,
                'employee_sum' => 0,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            // 检查部门是否已存在
            $existingDept = Db::table('magic_contact_departments')
                ->where('organization_code', $orgCode)
                ->where('name', $dept['name'])
                ->where('parent_department_id', $currentParentDepartmentId)
                ->first();

            if ($existingDept) {
                echo "部门已存在: {$dept['name']}, ID: {$existingDept['department_id']}" . PHP_EOL;
                $departmentId = $existingDept['department_id'];
                $currentPath = $existingDept['path'];
            } else {
                // 创建部门
                Db::table('magic_contact_departments')->insert($departmentData);
                echo "已创建部门: {$dept['name']}, ID: {$departmentId}, 组织: {$orgCode}" . PHP_EOL;
            }

            // 递归创建子部门
            if (isset($dept['children']) && ! empty($dept['children'])) {
                $this->createDepartments($dept['children'], $orgCode, (string) $departmentId, (string) $currentPath);
            }
        }
    }

    /**
     * 英文部门名称转换.
     */
    private function translateDepartmentName(string $name): string
    {
        $translations = [
            '总部' => 'Headquarters',
            '技术部' => 'Technology Department',
            '产品部' => 'Product Department',
            '市场部' => 'Marketing Department',
            '人事部' => 'HR Department',
            '前端组' => 'Frontend Team',
            '后端组' => 'Backend Team',
            '测试组' => 'QA Team',
            '设计组' => 'Design Team',
            '产品组' => 'Product Team',
            '营销组' => 'Marketing Team',
            '销售组' => 'Sales Team',
        ];

        return $translations[$name] ?? $name;
    }

    /**
     * 分配用户到部门.
     */
    private function assignUsersToDepartments(string $orgCode): void
    {
        // 获取该组织下的用户
        $users = Db::table('magic_contact_users')
            ->where('organization_code', $orgCode)
            ->get()
            ->toArray();

        if (empty($users)) {
            echo "组织 {$orgCode} 下没有用户，跳过部门分配" . PHP_EOL;
            return;
        }

        // 获取该组织下的部门
        $departments = Db::table('magic_contact_departments')
            ->where('organization_code', $orgCode)
            ->get()
            ->toArray();

        if (empty($departments)) {
            echo "组织 {$orgCode} 下没有部门，跳过部门分配" . PHP_EOL;
            return;
        }

        // 记录主管信息的数组
        $leaderInfo = [];

        // 先找出管理员用户作为总部主管
        $adminUser = null;
        foreach ($users as $user) {
            if (str_contains($user['nickname'], '管理员')) {
                $adminUser = $user;
                break;
            }
        }

        if ($adminUser) {
            // 获取总部部门（根部门）
            $hqDept = null;
            foreach ($departments as $dept) {
                if ($dept['parent_department_id'] === PlatformRootDepartmentId::Magic
                    || $dept['department_id'] === PlatformRootDepartmentId::Magic
                    || $dept['parent_department_id'] === ''
                    || $dept['parent_department_id'] === null) {
                    $hqDept = $dept;
                    break;
                }
            }

            if ($hqDept) {
                // 更新总部部门，设置主管
                Db::table('magic_contact_departments')
                    ->where('id', $hqDept['id'])
                    ->update(['leader_user_id' => $adminUser['user_id']]);

                $leaderInfo[$hqDept['department_id']] = $adminUser['user_id'];

                // 将管理员分配到总部
                $this->assignUserToDepartment($adminUser, $hqDept, true, null, $orgCode);
                echo "已将用户 {$adminUser['nickname']}(ID: {$adminUser['user_id']}) 设为总部主管" . PHP_EOL;

                // 确保管理员至少在2个部门中
                $adminAssignedDepartments = 1; // 已分配到总部

                // 为每个一级部门分配领导
                $level1Depts = array_filter($departments, function ($dept) {
                    return $dept['level'] === 1;
                });

                // 首先将管理员分配到第一个一级部门
                if (! empty($level1Depts)) {
                    $firstL1Dept = reset($level1Depts);
                    $this->assignUserToDepartment($adminUser, $firstL1Dept, true, null, $orgCode);
                    echo "已将管理员 {$adminUser['nickname']}(ID: {$adminUser['user_id']}) 分配到{$firstL1Dept['name']}" . PHP_EOL;
                    ++$adminAssignedDepartments;
                }

                // 分配其他用户到不同部门
                $assignedUsers = 1; // 已分配管理员
                $totalUsers = count($users);

                foreach ($level1Depts as $dept) {
                    // 如果还有未分配的普通用户，则分配一个作为部门主管
                    if ($assignedUsers < $totalUsers) {
                        // 找一个非管理员用户
                        $deptLeader = null;
                        foreach ($users as $user) {
                            if ($user['user_id'] !== $adminUser['user_id'] && str_contains($user['nickname'], '普通用户')) {
                                $deptLeader = $user;
                                break;
                            }
                        }

                        if ($deptLeader) {
                            // 更新部门，设置主管
                            Db::table('magic_contact_departments')
                                ->where('id', $dept['id'])
                                ->update(['leader_user_id' => $deptLeader['user_id']]);

                            $leaderInfo[$dept['department_id']] = $deptLeader['user_id'];

                            // 将该用户分配到该部门，并设为主管
                            $this->assignUserToDepartment($deptLeader, $dept, false, $adminUser['user_id'], $orgCode);
                            echo "已将用户 {$deptLeader['nickname']}(ID: {$deptLeader['user_id']}) 分配到{$dept['name']}" . PHP_EOL;

                            // 不再考虑这个用户
                            $users = array_filter($users, function ($user) use ($deptLeader) {
                                return $user['user_id'] !== $deptLeader['user_id'];
                            });

                            ++$assignedUsers;
                        }
                    }
                }

                // 分配剩余用户到二级部门
                $level2Depts = array_filter($departments, function ($dept) {
                    return $dept['level'] === 2;
                });

                foreach ($level2Depts as $dept) {
                    // 找出该部门的父部门
                    $parentDept = null;
                    foreach ($departments as $d) {
                        if ($d['department_id'] === $dept['parent_department_id']) {
                            $parentDept = $d;
                            break;
                        }
                    }

                    // 使用父部门的leader作为当前用户的leader
                    $leaderUserId = $parentDept ? ($leaderInfo[$parentDept['department_id']] ?? null) : null;

                    // 分配剩余用户到部门
                    foreach ($users as $user) {
                        if ($assignedUsers >= $totalUsers) {
                            break; // 所有用户都已分配
                        }

                        $this->assignUserToDepartment($user, $dept, false, $leaderUserId, $orgCode);
                        echo "已将用户 {$user['nickname']}(ID: {$user['user_id']}) 分配到{$dept['name']}" . PHP_EOL;

                        ++$assignedUsers;
                    }
                }
            }
        }
    }

    /**
     * 将用户分配到部门.
     */
    private function assignUserToDepartment(array $user, array $department, bool $isLeader = false, ?string $leaderUserId = null, string $orgCode = ''): void
    {
        // 检查是否已分配
        $existingAssignment = Db::table('magic_contact_department_users')
            ->where('user_id', $user['user_id'])
            ->where('department_id', $department['department_id'])
            ->where('organization_code', $orgCode)
            ->first();

        if ($existingAssignment) {
            echo "用户 {$user['nickname']} 已分配到部门 {$department['name']}" . PHP_EOL;
            return;
        }

        // 创建部门用户关联
        $deptUserData = [
            'magic_id' => $user['magic_id'],
            'user_id' => $user['user_id'],
            'department_id' => $department['department_id'],
            'is_leader' => $isLeader ? 1 : 0,
            'organization_code' => $orgCode,
            'city' => '北京',
            'country' => 'CN',
            'join_time' => (string) time(),
            'employee_no' => 'EMP' . substr($user['user_id'], -4),
            'employee_type' => 1, // 正式员工
            'orders' => '0',
            'custom_attrs' => json_encode(['技能' => '编程', '爱好' => '阅读']),
            'is_frozen' => 0,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        // 只给主管设置职位
        if ($isLeader) {
            $deptUserData['job_title'] = '部门经理';
        }

        // 设置直属领导
        if ($leaderUserId) {
            $deptUserData['leader_user_id'] = $leaderUserId;
        }

        Db::table('magic_contact_department_users')->insert($deptUserData);

        // 更新部门的员工数量
        Db::table('magic_contact_departments')
            ->where('department_id', $department['department_id'])
            ->increment('employee_sum');
    }
}
