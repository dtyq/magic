<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Bootstrap\Service\Initializer;

use App\Domain\Chat\Entity\ValueObject\PlatformRootDepartmentId;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentModel;
use App\Domain\OrganizationEnvironment\Entity\ValueObject\DeploymentEnum;
use App\Domain\OrganizationEnvironment\Entity\ValueObject\EnvironmentEnum;
use App\Domain\OrganizationEnvironment\Repository\Model\MagicEnvironmentModel;
use App\Domain\OrganizationEnvironment\Repository\Model\MagicOrganizationsEnvironmentModel;
use App\Domain\OrganizationEnvironment\Repository\Persistence\Model\OrganizationModel;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;

use function Hyperf\Support\env;

class OrganizationInitializer
{
    /**
     * @param array{zh_CN:string,en_US:string} $organizationNameI18n
     * @return array{
     *   success:bool,
     *   organization_code:string,
     *   organization_name:string,
     *   organization_name_i18n:array{zh_CN:string,en_US:string},
     *   login_code:string,
     *   root_department_id:string,
     *   is_idempotent_replay:bool
     * }
     */
    public function initialize(string $organizationCode, array $organizationNameI18n): array
    {
        $envId = (int) env('MAGIC_ENV_ID', 10000);
        $changed = $this->ensureEnvironmentExists($envId);

        $organizationName = $organizationNameI18n['zh_CN'] ?: $organizationNameI18n['en_US'];

        [$loginCode, $orgEnvChanged] = $this->ensureOrganizationEnvironment($organizationCode, $envId);
        $changed = $changed || $orgEnvChanged;

        $organizationChanged = $this->ensureOrganizationRecord($organizationCode, $organizationName);
        $changed = $changed || $organizationChanged;

        $departmentChanged = $this->ensureDefaultDepartmentTree($organizationCode, $organizationName, $organizationNameI18n);
        $changed = $changed || $departmentChanged;

        return [
            'success' => true,
            'organization_code' => $organizationCode,
            'organization_name' => $organizationName,
            'organization_name_i18n' => $organizationNameI18n,
            'login_code' => $loginCode,
            'root_department_id' => PlatformRootDepartmentId::Magic,
            'is_idempotent_replay' => ! $changed,
        ];
    }

    private function ensureEnvironmentExists(int $envId): bool
    {
        if ($envId <= 0) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'common.invalid',
                ['label' => 'MAGIC_ENV_ID']
            );
        }

        $environment = MagicEnvironmentModel::query()
            ->where('id', $envId)
            ->first();

        if ($environment !== null) {
            if ($environment->deleted_at !== null) {
                $environment->deleted_at = null;
                $environment->updated_at = date('Y-m-d H:i:s');
                $environment->save();
                return true;
            }
            return false;
        }

        $privateConfig = json_encode([
            'name' => '麦吉开源',
            'domain' => [
                [
                    'type' => PlatformType::Magic->value,
                ],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';

        $created = Db::table('magic_environments')->insertOrIgnore([
            'id' => $envId,
            'environment_code' => '',
            'deployment' => DeploymentEnum::OpenSource->value,
            'environment' => EnvironmentEnum::Production->value,
            'open_platform_config' => '{}',
            'private_config' => $privateConfig,
            'extra' => null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $created > 0;
    }

    /**
     * @return array{0:string,1:bool}
     */
    private function ensureOrganizationEnvironment(string $organizationCode, int $envId): array
    {
        /** @var null|array{id:string,login_code:string,environment_id:int,origin_organization_code:string} $existing */
        $existing = Db::table('magic_organizations_environment')
            ->where('magic_organization_code', $organizationCode)
            ->first();

        if ($existing !== null) {
            $updateData = [];
            if (($existing['origin_organization_code'] ?? '') !== $organizationCode) {
                $updateData['origin_organization_code'] = $organizationCode;
            }
            if ((int) ($existing['environment_id'] ?? 0) !== $envId) {
                $updateData['environment_id'] = $envId;
            }
            if (empty($existing['login_code'])) {
                $updateData['login_code'] = $this->generateUniqueLoginCode();
            }

            if ($updateData !== []) {
                $updateData['updated_at'] = date('Y-m-d H:i:s');
                Db::table('magic_organizations_environment')
                    ->where('id', $existing['id'])
                    ->update($updateData);
            }

            $loginCode = (string) ($updateData['login_code'] ?? $existing['login_code'] ?? '');
            return [$loginCode, $updateData !== []];
        }

        $loginCode = $this->generateUniqueLoginCode();
        MagicOrganizationsEnvironmentModel::query()->create([
            'login_code' => $loginCode,
            'magic_organization_code' => $organizationCode,
            'origin_organization_code' => $organizationCode,
            'environment_id' => $envId,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return [$loginCode, true];
    }

    private function ensureOrganizationRecord(string $organizationCode, string $organizationName): bool
    {
        $organization = OrganizationModel::withTrashed()
            ->where('magic_organization_code', $organizationCode)
            ->first();

        if ($organization === null) {
            OrganizationModel::query()->create([
                'magic_organization_code' => $organizationCode,
                'name' => $organizationName,
                'industry_type' => '互联网',
                'number' => '1-50人',
                'type' => 0,
                'status' => OrganizationModel::STATUS_NORMAL,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
            return true;
        }

        $changed = false;
        if ($organization->trashed()) {
            $organization->deleted_at = null;
            $changed = true;
        }
        if ((int) $organization->status !== OrganizationModel::STATUS_NORMAL) {
            $organization->status = OrganizationModel::STATUS_NORMAL;
            $changed = true;
        }
        if (empty((string) $organization->name)) {
            $organization->name = $organizationName;
            $changed = true;
        }
        if (empty((string) $organization->industry_type)) {
            $organization->industry_type = '互联网';
            $changed = true;
        }
        if (empty((string) $organization->number)) {
            $organization->number = '1-50人';
            $changed = true;
        }
        if ((int) $organization->type !== 0) {
            $organization->type = 0;
            $changed = true;
        }

        if ($changed) {
            $organization->updated_at = Carbon::now();
            $organization->save();
        }

        return $changed;
    }

    /**
     * @param array{zh_CN:string,en_US:string} $organizationNameI18n
     */
    private function ensureDefaultDepartmentTree(
        string $organizationCode,
        string $organizationName,
        array $organizationNameI18n
    ): bool {
        $tree = [
            [
                'name' => $organizationName,
                'level' => 0,
                'department_id' => PlatformRootDepartmentId::Magic,
                'parent_department_id' => PlatformRootDepartmentId::Magic,
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

        return $this->ensureDepartments(
            departments: $tree,
            organizationCode: $organizationCode,
            organizationNameI18n: $organizationNameI18n
        );
    }

    /**
     * @param array<int, array<string, mixed>> $departments
     * @param array{zh_CN:string,en_US:string} $organizationNameI18n
     */
    private function ensureDepartments(
        array $departments,
        string $organizationCode,
        ?string $parentDepartmentId = null,
        ?string $path = null,
        array $organizationNameI18n = ['zh_CN' => '官方组织', 'en_US' => 'Official Organization']
    ): bool {
        $changed = false;
        foreach ($departments as $department) {
            $departmentId = isset($department['department_id'])
                ? (string) $department['department_id']
                : (string) IdGenerator::getSnowId();
            $currentParentDepartmentId = isset($department['parent_department_id'])
                ? (string) $department['parent_department_id']
                : (string) $parentDepartmentId;

            if (
                isset($department['department_id'])
                && (string) $department['department_id'] === PlatformRootDepartmentId::Magic
            ) {
                $currentPath = PlatformRootDepartmentId::Magic;
            } else {
                $currentPath = $path
                    ? $path . '/' . $departmentId
                    : PlatformRootDepartmentId::Magic . '/' . $departmentId;
            }

            $existing = DepartmentModel::withTrashed()
                ->where('organization_code', $organizationCode)
                ->where('name', (string) $department['name'])
                ->where('parent_department_id', $currentParentDepartmentId)
                ->first();

            if ($existing !== null) {
                $departmentId = (string) $existing->department_id;
                $currentPath = (string) $existing->path;

                $rowChanged = false;
                if ($existing->trashed()) {
                    $existing->deleted_at = null;
                    $rowChanged = true;
                }
                if ((string) $existing->path === '') {
                    $existing->path = $currentPath;
                    $rowChanged = true;
                }
                if ((int) $existing->level !== (int) ($department['level'] ?? 0)) {
                    $existing->level = (int) ($department['level'] ?? 0);
                    $rowChanged = true;
                }
                if ($rowChanged) {
                    $existing->updated_at = date('Y-m-d H:i:s');
                    $existing->save();
                    $changed = true;
                }
            } else {
                DepartmentModel::query()->create([
                    'department_id' => $departmentId,
                    'parent_department_id' => $currentParentDepartmentId,
                    'name' => (string) $department['name'],
                    'i18n_name' => json_encode(
                        $this->buildDepartmentI18nName((string) $department['name'], $organizationNameI18n),
                        JSON_UNESCAPED_UNICODE
                    ) ?: '{}',
                    'order' => '0',
                    'leader_user_id' => '',
                    'organization_code' => $organizationCode,
                    'status' => '{"is_deleted":false}',
                    'document_id' => (string) IdGenerator::getSnowId(),
                    'level' => (int) ($department['level'] ?? 0),
                    'path' => $currentPath,
                    'employee_sum' => 0,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
                $changed = true;
            }

            if (isset($department['children']) && is_array($department['children']) && $department['children'] !== []) {
                $childrenChanged = $this->ensureDepartments(
                    departments: $department['children'],
                    organizationCode: $organizationCode,
                    parentDepartmentId: $departmentId,
                    path: $currentPath,
                    organizationNameI18n: $organizationNameI18n
                );
                $changed = $changed || $childrenChanged;
            }
        }

        return $changed;
    }

    /**
     * @param array{zh_CN:string,en_US:string} $organizationNameI18n
     * @return array{zh-CN:string,en-US:string}
     */
    private function buildDepartmentI18nName(string $departmentName, array $organizationNameI18n): array
    {
        $translations = [
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

        if ($departmentName === $organizationNameI18n['zh_CN']) {
            return [
                'zh-CN' => $organizationNameI18n['zh_CN'],
                'en-US' => $organizationNameI18n['en_US'],
            ];
        }

        return [
            'zh-CN' => $departmentName,
            'en-US' => $translations[$departmentName] ?? $departmentName,
        ];
    }

    private function generateUniqueLoginCode(): string
    {
        for ($i = 0; $i < 20; ++$i) {
            $candidate = (string) random_int(100000, 999999);
            $exists = Db::table('magic_organizations_environment')
                ->where('login_code', $candidate)
                ->exists();
            if (! $exists) {
                return $candidate;
            }
        }

        ExceptionBuilder::throw(GenericErrorCode::SystemError, 'failed_to_generate_unique_login_code');
    }
}
