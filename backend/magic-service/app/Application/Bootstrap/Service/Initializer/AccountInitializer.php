<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Bootstrap\Service\Initializer;

use App\Domain\Authentication\Service\PasswordService;
use App\Domain\Contact\Entity\ValueObject\UserIdType;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentModel;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;

use function Hyperf\Support\env;

class AccountInitializer
{
    public function __construct(
        private readonly PasswordService $passwordService,
        private readonly MagicUserRepositoryInterface $magicUserRepository,
    ) {
    }

    /**
     * @return array{
     *   success:bool,
     *   admin_magic_id:string,
     *   admin_user_id:string,
     *   is_idempotent_replay:bool
     * }
     */
    public function initialize(
        string $organizationCode,
        string $phone,
        string $plainPassword,
        string $rootDepartmentId
    ): array {
        $envId = (int) env('MAGIC_ENV_ID', 10000);
        $changed = false;

        [$magicId, $accountChanged] = $this->ensureAdminAccount($phone, $plainPassword, $envId);
        $changed = $accountChanged;

        [$userId, $userChanged] = $this->ensureAdminUser($magicId, $organizationCode);
        $changed = $changed || $userChanged;

        $departmentUserChanged = $this->ensureRootDepartmentMembership(
            organizationCode: $organizationCode,
            userId: $userId,
            magicId: $magicId,
            rootDepartmentId: $rootDepartmentId
        );
        $changed = $changed || $departmentUserChanged;

        return [
            'success' => true,
            'admin_magic_id' => $magicId,
            'admin_user_id' => $userId,
            'is_idempotent_replay' => ! $changed,
        ];
    }

    /**
     * @return array{0:string,1:bool}
     */
    private function ensureAdminAccount(string $phone, string $plainPassword, int $envId): array
    {
        $hashedPassword = $this->passwordService->hashPassword($plainPassword);

        /** @var null|array{id:int,magic_id:string,magic_environment_id:int,status:int,password:string,deleted_at:null|string} $existingAccount */
        $existingAccount = Db::table('magic_contact_accounts')
            ->where('country_code', '86')
            ->where('phone', $phone)
            ->orderByRaw('CASE WHEN magic_environment_id = ? THEN 0 ELSE 1 END', [$envId])
            ->orderByDesc('id')
            ->first();

        if ($existingAccount !== null) {
            $updateData = [];
            if (empty((string) ($existingAccount['magic_id'] ?? ''))) {
                $updateData['magic_id'] = (string) IdGenerator::getSnowId();
            }
            if ((int) ($existingAccount['magic_environment_id'] ?? 0) === 0) {
                $updateData['magic_environment_id'] = $envId;
            }
            if ((int) ($existingAccount['status'] ?? 0) !== 0) {
                $updateData['status'] = 0;
            }
            if (($existingAccount['deleted_at'] ?? null) !== null) {
                $updateData['deleted_at'] = null;
            }
            if (empty((string) ($existingAccount['password'] ?? ''))) {
                $updateData['password'] = $hashedPassword;
            }

            if ($updateData !== []) {
                $updateData['updated_at'] = date('Y-m-d H:i:s');
                Db::table('magic_contact_accounts')
                    ->where('id', $existingAccount['id'])
                    ->update($updateData);
            }

            $magicId = (string) ($updateData['magic_id'] ?? $existingAccount['magic_id']);
            return [$magicId, $updateData !== []];
        }

        $magicId = (string) IdGenerator::getSnowId();
        Db::table('magic_contact_accounts')->insert([
            'magic_id' => $magicId,
            'type' => 1,
            'status' => 0,
            'country_code' => '86',
            'phone' => $phone,
            'email' => '',
            'real_name' => '管理员',
            'gender' => 0,
            'magic_environment_id' => $envId,
            'password' => $hashedPassword,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return [$magicId, true];
    }

    /**
     * @return array{0:string,1:bool}
     */
    private function ensureAdminUser(string $magicId, string $organizationCode): array
    {
        /** @var null|array{id:int,user_id:string,status:int,user_type:int,nickname:string,i18n_name:string,deleted_at:null|string} $existingUser */
        $existingUser = Db::table('magic_contact_users')
            ->where('magic_id', $magicId)
            ->where('organization_code', $organizationCode)
            ->orderByDesc('id')
            ->first();

        if ($existingUser !== null) {
            $updateData = [];
            if (empty((string) ($existingUser['user_id'] ?? ''))) {
                $updateData['user_id'] = $this->magicUserRepository->getUserIdByType(UserIdType::UserId, $organizationCode);
            }
            if ((int) ($existingUser['status'] ?? 0) !== 1) {
                $updateData['status'] = 1;
            }
            if ((int) ($existingUser['user_type'] ?? 0) !== 1) {
                $updateData['user_type'] = 1;
            }
            if (($existingUser['deleted_at'] ?? null) !== null) {
                $updateData['deleted_at'] = null;
            }
            if (empty((string) ($existingUser['nickname'] ?? ''))) {
                $updateData['nickname'] = '管理员';
            }
            if (empty((string) ($existingUser['i18n_name'] ?? ''))) {
                $updateData['i18n_name'] = json_encode([
                    'zh-CN' => '管理员',
                    'en-US' => 'Admin',
                ], JSON_UNESCAPED_UNICODE) ?: '{}';
            }

            if ($updateData !== []) {
                $updateData['updated_at'] = date('Y-m-d H:i:s');
                Db::table('magic_contact_users')
                    ->where('id', $existingUser['id'])
                    ->update($updateData);
            }

            return [(string) ($updateData['user_id'] ?? $existingUser['user_id']), $updateData !== []];
        }

        $userId = $this->magicUserRepository->getUserIdByType(UserIdType::UserId, $organizationCode);

        Db::table('magic_contact_users')->insert([
            'magic_id' => $magicId,
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'user_type' => 1,
            'status' => 1,
            'nickname' => '管理员',
            'i18n_name' => json_encode([
                'zh-CN' => '管理员',
                'en-US' => 'Admin',
            ], JSON_UNESCAPED_UNICODE) ?: '{}',
            'avatar_url' => '',
            'description' => '系统初始化管理员账号',
            'like_num' => 0,
            'label' => '',
            'extra' => '',
            'user_manual' => '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return [$userId, true];
    }

    private function ensureRootDepartmentMembership(
        string $organizationCode,
        string $userId,
        string $magicId,
        string $rootDepartmentId
    ): bool {
        $rootDepartment = DepartmentModel::query()
            ->where('organization_code', $organizationCode)
            ->where('department_id', $rootDepartmentId)
            ->first();

        if ($rootDepartment === null) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'root_department_not_found');
        }

        $changed = false;
        /** @var null|array{id:int,is_leader:int,job_title:string,deleted_at:null|string} $existing */
        $existing = Db::table('magic_contact_department_users')
            ->where('organization_code', $organizationCode)
            ->where('user_id', $userId)
            ->where('department_id', $rootDepartmentId)
            ->orderByDesc('id')
            ->first();

        if ($existing !== null) {
            $updateData = [];
            $wasDeleted = ($existing['deleted_at'] ?? null) !== null;
            if ((int) ($existing['is_leader'] ?? 0) !== 1) {
                $updateData['is_leader'] = 1;
            }
            if (empty((string) ($existing['job_title'] ?? ''))) {
                $updateData['job_title'] = '部门经理';
            }
            if ($wasDeleted) {
                $updateData['deleted_at'] = null;
            }
            if ($updateData !== []) {
                $updateData['updated_at'] = date('Y-m-d H:i:s');
                Db::table('magic_contact_department_users')
                    ->where('id', $existing['id'])
                    ->update($updateData);
                $changed = true;

                if ($wasDeleted) {
                    Db::table('magic_contact_departments')
                        ->where('organization_code', $organizationCode)
                        ->where('department_id', $rootDepartmentId)
                        ->increment('employee_sum');
                }
            }
        } else {
            Db::table('magic_contact_department_users')->insert([
                'magic_id' => $magicId,
                'user_id' => $userId,
                'department_id' => $rootDepartmentId,
                'is_leader' => 1,
                'job_title' => '部门经理',
                'leader_user_id' => '',
                'organization_code' => $organizationCode,
                'city' => '北京',
                'country' => 'CN',
                'join_time' => (string) time(),
                'employee_no' => 'EMP' . substr($userId, -4),
                'employee_type' => 1,
                'orders' => '0',
                'custom_attrs' => '{}',
                'is_frozen' => 0,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            Db::table('magic_contact_departments')
                ->where('organization_code', $organizationCode)
                ->where('department_id', $rootDepartmentId)
                ->increment('employee_sum');

            $changed = true;
        }

        $leaderUserId = (string) ($rootDepartment->leader_user_id ?? '');
        if ($leaderUserId !== $userId) {
            Db::table('magic_contact_departments')
                ->where('organization_code', $organizationCode)
                ->where('department_id', $rootDepartmentId)
                ->update([
                    'leader_user_id' => $userId,
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            $changed = true;
        }

        return $changed;
    }
}
