<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\SuperMagic\Common\Collaboration\Policy\ResourceAccessPolicyService;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationPermissionResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillSourceType;
use App\Domain\SuperMagic\Skill\Service\SkillDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use App\ErrorCode\SkillErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\File\TemporaryFileManager;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\ZipUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Redis\Redis;
use RuntimeException;

/**
 * Skill 应用服务抽象基类.
 */
abstract class AbstractSkillAppService extends AbstractKernelAppService
{
    protected const IMPORT_LOCK_EXPIRE_SECONDS = 60;

    private const IMPORT_TOKEN_EXPIRE_SECONDS = 4 * 3600;

    /** Skill 包内需要单独存储的说明文件. */
    private const SKILL_FILE_NAME = 'SKILL.md';

    #[Inject]
    protected FileDomainService $fileDomainService;

    #[Inject]
    protected SkillDomainService $skillDomainService;

    #[Inject]
    protected SkillVersionDomainService $skillVersionDomainService;

    #[Inject]
    protected ResourceAccessPolicyService $resourceAccessPolicyService;

    #[Inject]
    protected LockerInterface $locker;

    #[Inject]
    protected Redis $redis;

    #[Inject]
    protected SkillMarketDomainService $skillMarketDomainService;

    /**
     * 下载 Skill 压缩包，仅提取 SKILL.md 并上传为独立文件.
     */
    protected function uploadSkillFileFromPackage(SkillVersionEntity $version): string
    {
        $fileKey = $version->getFileKey();
        if ($fileKey === null || trim($fileKey) === '') {
            throw new RuntimeException('Skill package file_key is empty');
        }

        $archive = TemporaryFileManager::createTempFile('skill-package-');
        $filePath = TemporaryFileManager::createTempFile('skill-file-');
        try {
            $this->fileDomainService->downloadByChunks($version->getOrganizationCode(), $fileKey, $archive, StorageBucketType::Private);
            ZipUtil::extractFile($archive, self::SKILL_FILE_NAME, $filePath);
            $upload = new UploadFile($filePath, 'skills/' . $version->getCode() . '/versions/' . $version->getId(), self::SKILL_FILE_NAME, false);
            $this->fileDomainService->uploadByCredential($version->getOrganizationCode(), $upload, StorageBucketType::Private, false);
            return $upload->getKey();
        } finally {
            foreach ([$archive, $filePath] as $path) {
                if (is_file($path)) {
                    unlink($path);
                }
            }
        }
    }

    /**
     * 创建导入 Token 并保存导入数据.
     *
     * @param array<string, mixed> $data
     */
    protected function createImportToken(string $prefix, array $data): string
    {
        $token = IdGenerator::getUniqueIdSha256();
        $payload = array_merge($data, ['expires_at' => time() + self::IMPORT_TOKEN_EXPIRE_SECONDS]);

        $this->redis->setex(
            $prefix . $token,
            self::IMPORT_TOKEN_EXPIRE_SECONDS,
            json_encode($payload, JSON_THROW_ON_ERROR)
        );

        return $token;
    }

    /**
     * 读取并校验导入 Token.
     *
     * @return array<string, mixed>
     */
    protected function readImportToken(string $prefix, string $token): array
    {
        $payload = $this->redis->get($prefix . $token);
        if (! is_string($payload) || $payload === '') {
            ExceptionBuilder::throw(SkillErrorCode::INVALID_IMPORT_TOKEN, 'skill.invalid_import_token');
        }

        $data = json_decode($payload, true);
        if (! is_array($data) || ($data['expires_at'] ?? 0) < time()) {
            ExceptionBuilder::throw(SkillErrorCode::IMPORT_TOKEN_EXPIRED, 'skill.import_token_expired');
        }

        return $data;
    }

    /**
     * 删除已消费的导入 Token.
     */
    protected function removeImportToken(string $prefix, string $token): void
    {
        if ($token === '') {
            return;
        }

        $this->redis->del($prefix . $token);
    }

    /**
     * 获取导入互斥锁.
     */
    protected function acquireImportLock(string $lockKey): string
    {
        $lockOwner = IdGenerator::getUniqueId32();
        if (! $this->locker->mutexLock($lockKey, $lockOwner, self::IMPORT_LOCK_EXPIRE_SECONDS)) {
            ExceptionBuilder::throw(SkillErrorCode::IMPORT_CONCURRENT_ERROR, 'skill.import_concurrent_error');
        }

        return $lockOwner;
    }

    /**
     * 释放导入互斥锁.
     */
    protected function releaseImportLock(string $lockKey, string $lockOwner): void
    {
        if ($lockKey !== '' && $lockOwner !== '') {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    /**
     * 创建 Skill 数据隔离对象.
     */
    protected function createSkillDataIsolation(BaseDataIsolation|MagicUserAuthorization $authorization): SkillDataIsolation
    {
        $dataIsolation = new SkillDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    /**
     * 批量加载 Skill 版本列表关联的用户与部门信息.
     *
     * 传入组织编码时按该组织查询；不传时按版本所属组织分组查询，适用于管理后台跨组织列表。
     *
     * @param null|string $organizationCode 指定组织编码；为 null 时使用版本实体上的组织编码
     * @param SkillVersionEntity[] $versions
     * @return array{0: array<string, MagicUserEntity>, 1: array<string, MagicDepartmentEntity>}
     */
    protected function batchLoadSkillVersionRelatedEntities(?string $organizationCode, array $versions): array
    {
        $userIdsByOrganization = [];
        $departmentIdsByOrganization = [];

        foreach ($versions as $version) {
            $currentOrganizationCode = $organizationCode ?? $version->getOrganizationCode();
            if ($currentOrganizationCode === '') {
                continue;
            }

            if (! empty($version->getPublisherUserId())) {
                $userIdsByOrganization[$currentOrganizationCode][] = $version->getPublisherUserId();
            }

            $targetValue = $version->getPublishTargetValue();
            if ($targetValue === null || ! $version->getPublishTargetType()->requiresTargetValue()) {
                continue;
            }

            foreach ($targetValue->getUserIds() as $userId) {
                $userIdsByOrganization[$currentOrganizationCode][] = $userId;
            }
            foreach ($targetValue->getDepartmentIds() as $departmentId) {
                $departmentIdsByOrganization[$currentOrganizationCode][] = $departmentId;
            }
        }

        $userMap = [];
        foreach ($userIdsByOrganization as $currentOrganizationCode => $userIds) {
            foreach ($this->getUsers($currentOrganizationCode, array_values(array_unique($userIds))) as $userId => $userEntity) {
                $userMap[$userId] = $userEntity;
            }
        }

        $memberDepartmentMap = [];
        foreach ($departmentIdsByOrganization as $currentOrganizationCode => $departmentIds) {
            $departmentEntities = di(MagicDepartmentDomainService::class)->getDepartmentByIds(
                ContactDataIsolation::simpleMake($currentOrganizationCode),
                array_values(array_unique($departmentIds)),
                true
            );
            foreach ($departmentEntities as $departmentId => $departmentEntity) {
                $memberDepartmentMap[$departmentId] = $departmentEntity;
            }
        }

        return [$userMap, $memberDepartmentMap];
    }

    /**
     * 获取用户可访问的技能代码。
     *
     * @return array<string>
     */
    protected function getAccessibleSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        /** @var array<string> $skillCodes */
        $skillCodes = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::Skill,
            ResourceVisibilityResourceType::SKILL
        )['all_codes'] ?? [];

        return $this->mergeBuiltinSkillCodes($skillCodes);
    }

    /**
     * 获取团队共享可用的技能代码。
     *
     * @return array{codes: array<string>, operations: array<string, Operation>}
     */
    protected function getTeamSharedReadableSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        /** @var array{operations: array<string, Operation>, operation_codes: array<string>, visibility_codes: array<string>, all_codes: array<string>} $accessibleSkillResult */
        $accessibleSkillResult = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::Skill,
            ResourceVisibilityResourceType::SKILL
        );
        /** @var array<string> $accessibleSkillCodes */
        $accessibleSkillCodes = $this->mergeBuiltinSkillCodes($accessibleSkillResult['all_codes'] ?? []);
        /** @var array<string> $currentUserSkillCodes */
        $currentUserSkillCodes = $this->skillDomainService->findCurrentUserSkillCodes($dataIsolation);

        $sharedSkillCodes = array_values(array_diff($accessibleSkillCodes, $currentUserSkillCodes));
        $sharedSkillCodes = array_values(array_diff(
            $sharedSkillCodes,
            $this->skillMarketDomainService->getOfficialBuiltinSkillCodes()
        ));

        return [
            'codes' => $sharedSkillCodes,
            'operations' => $accessibleSkillResult['operations'],
        ];
    }

    /**
     * 获取仅通过发布可见性共享的技能代码。
     *
     * operation_permissions 中明确授权的技能由 collaborated 作用域负责，
     * 不应继续出现在新的 team_shared 作用域中。
     *
     * @return array{codes: array<string>, operations: array<string, Operation>}
     */
    protected function getTeamSharedVisibleSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        /** @var array{operations: array<string, Operation>, operation_codes: array<string>, visibility_codes: array<string>} $accessibleSkillResult */
        $accessibleSkillResult = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::Skill,
            ResourceVisibilityResourceType::SKILL
        );
        $currentUserSkillCodes = $this->skillDomainService->findCurrentUserSkillCodes($dataIsolation);
        $excludedCodes = array_merge(
            $currentUserSkillCodes,
            $accessibleSkillResult['operation_codes'] ?? [],
            $this->skillMarketDomainService->getOfficialBuiltinSkillCodes()
        );

        return [
            'codes' => array_values(array_diff($accessibleSkillResult['visibility_codes'] ?? [], $excludedCodes)),
            'operations' => [],
        ];
    }

    /**
     * 获取当前用户明确参与协作的技能代码。
     *
     * @return array{codes: array<string>, operations: array<string, Operation>}
     */
    protected function getCollaboratedSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        /** @var array{operations: array<string, Operation>, operation_codes: array<string>} $accessibleSkillResult */
        $accessibleSkillResult = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::Skill,
            ResourceVisibilityResourceType::SKILL
        );
        $creatorSkillCodes = $this->skillDomainService->findCurrentUserCreatedSkillCodes($dataIsolation);
        $codes = array_values(array_diff(
            $accessibleSkillResult['operation_codes'] ?? [],
            $creatorSkillCodes,
            $this->skillMarketDomainService->getOfficialBuiltinSkillCodes()
        ));

        return [
            'codes' => $codes,
            'operations' => array_intersect_key(
                $accessibleSkillResult['operations'] ?? [],
                array_fill_keys($codes, true)
            ),
        ];
    }

    /**
     * 获取市场已安装的技能代码。
     *
     * @return array<string>
     */
    protected function getMarketInstalledSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        /** @var array<string> $marketInstalledCodes */
        $marketInstalledCodes = $this->skillDomainService->findCurrentUserSkillCodesBySourceType(
            $dataIsolation,
            SkillSourceType::MARKET
        );

        return $this->mergeBuiltinSkillCodes($marketInstalledCodes);
    }

    /**
     * 合并系统技能代码。
     *
     * @param array<string> $skillCodes
     * @param null|array<string> $resourceCode
     * @return array<string>
     */
    protected function mergeBuiltinSkillCodes(array $skillCodes, ?array $resourceCode = null): array
    {
        $builtinSkillCodes = $this->skillMarketDomainService->getOfficialBuiltinSkillCodes();
        if ($resourceCode !== null) {
            $builtinSkillCodes = array_values(array_intersect($builtinSkillCodes, $resourceCode));
        }

        return array_values(array_unique(array_merge($skillCodes, $builtinSkillCodes)));
    }

    /**
     * 更新用户头像URL（将路径转换为完整URL）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param MagicUserEntity[] $userEntities 用户实体数组
     */
    protected function updateUserAvatarUrl(SkillDataIsolation $dataIsolation, array $userEntities): void
    {
        if (empty($userEntities)) {
            return;
        }

        // 收集需要转换的头像路径
        $avatarPaths = [];
        foreach ($userEntities as $userEntity) {
            if ($userEntity->getAvatarUrl()) {
                $avatarPaths[] = EasyFileTools::formatPath($userEntity->getAvatarUrl());
            }
        }

        if (empty($avatarPaths)) {
            return;
        }

        // 批量获取头像URL
        $avatarLinksMap = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $avatarPaths);

        // 更新用户实体的头像URL
        foreach ($userEntities as $userEntity) {
            if ($userEntity->getAvatarUrl()) {
                $formattedPath = EasyFileTools::formatPath($userEntity->getAvatarUrl());
                $fileLink = $avatarLinksMap[$formattedPath] ?? null;
                $userEntity->setAvatarUrl($fileLink instanceof FileLink ? $fileLink->getUrl() : '');
            }
        }
    }

    /**
     * 更新技能实体Logo URL（将路径转换为完整URL）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillEntity[] $skillEntities 技能实体数组
     */
    protected function updateSkillLogoUrl(SkillDataIsolation $dataIsolation, array $skillEntities): void
    {
        if (empty($skillEntities)) {
            return;
        }

        // 按组织代码分组收集需要转换的logo路径
        $logoPathsByOrg = [];
        foreach ($skillEntities as $skillEntity) {
            if ($skillEntity->getLogo()) {
                $orgCode = $skillEntity->getOrganizationCode();
                if (! isset($logoPathsByOrg[$orgCode])) {
                    $logoPathsByOrg[$orgCode] = [];
                }
                $logoPathsByOrg[$orgCode][] = EasyFileTools::formatPath($skillEntity->getLogo());
            }
        }

        if (empty($logoPathsByOrg)) {
            return;
        }

        // 按组织批量获取logo URL
        $allLogoLinksMap = [];
        foreach ($logoPathsByOrg as $orgCode => $logoPaths) {
            $logoLinksMap = $this->getIcons($orgCode, $logoPaths);
            $allLogoLinksMap[$orgCode] = $logoLinksMap;
        }

        // 更新技能实体的logo URL
        foreach ($skillEntities as $skillEntity) {
            if ($skillEntity->getLogo()) {
                $orgCode = $skillEntity->getOrganizationCode();
                $formattedPath = EasyFileTools::formatPath($skillEntity->getLogo());
                $fileLink = $allLogoLinksMap[$orgCode][$formattedPath] ?? null;
                $skillEntity->setLogo($fileLink instanceof FileLink ? $fileLink->getUrl() : '');
            }
        }
    }

    /**
     * 更新市场技能实体Logo URL（将路径转换为完整URL）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillMarketEntity[] $skillMarketEntities 市场技能实体数组
     */
    protected function updateSkillMarketLogoUrl(SkillDataIsolation $dataIsolation, array $skillMarketEntities): void
    {
        if (empty($skillMarketEntities)) {
            return;
        }

        // 按组织代码分组收集需要转换的logo路径
        $logoPathsByOrg = [];
        foreach ($skillMarketEntities as $skillMarketEntity) {
            if ($skillMarketEntity->getLogo()) {
                $orgCode = $skillMarketEntity->getOrganizationCode();
                if (! isset($logoPathsByOrg[$orgCode])) {
                    $logoPathsByOrg[$orgCode] = [];
                }
                $logoPathsByOrg[$orgCode][] = EasyFileTools::formatPath($skillMarketEntity->getLogo());
            }
        }

        if (empty($logoPathsByOrg)) {
            return;
        }

        // 按组织批量获取logo URL
        $allLogoLinksMap = [];
        foreach ($logoPathsByOrg as $orgCode => $logoPaths) {
            $logoLinksMap = $this->getIcons($orgCode, $logoPaths);
            $allLogoLinksMap[$orgCode] = $logoLinksMap;
        }

        // 更新市场技能实体的logo URL
        foreach ($skillMarketEntities as $skillMarketEntity) {
            if ($skillMarketEntity->getLogo()) {
                $orgCode = $skillMarketEntity->getOrganizationCode();
                $formattedPath = EasyFileTools::formatPath($skillMarketEntity->getLogo());
                $fileLink = $allLogoLinksMap[$orgCode][$formattedPath] ?? null;
                $skillMarketEntity->setLogo($fileLink instanceof FileLink ? $fileLink->getUrl() : '');
            }
        }
    }

    /**
     * 更新 Skill 实体的 FileUrl（根据 fileKey 获取私有链接）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillEntity[] $skillEntities Skill 实体数组
     */
    protected function updateSkillFileUrl(SkillDataIsolation $dataIsolation, array $skillEntities): void
    {
        if (empty($skillEntities)) {
            return;
        }

        // 按组织代码分组收集需要转换的路径
        $pathsByOrg = [];
        foreach ($skillEntities as $skillEntity) {
            $pathsByOrg[$skillEntity->getOrganizationCode()][] = $skillEntity->getFileKey();
        }

        // 按组织批量获取文件 URL
        $allFileLinksMap = [];
        foreach ($pathsByOrg as $orgCode => $paths) {
            $fileLinksMap = $this->getPrivateFileLinks($orgCode, $paths);
            $allFileLinksMap[$orgCode] = $fileLinksMap;
        }

        // 更新 Skill 实体的 logo URL
        foreach ($skillEntities as $skillEntity) {
            $fileLink = $allFileLinksMap[$skillEntity->getOrganizationCode()][$skillEntity->getFileKey()] ?? null;
            $skillEntity->setFileUrl($fileLink instanceof FileLink ? $fileLink->getUrl() : null);
        }
    }

    /**
     * Update asset URLs for skill version entities.
     *
     * @param SkillVersionEntity[] $skillVersionEntities
     */
    protected function updateSkillVersionAssetUrls(SkillDataIsolation $dataIsolation, array $skillVersionEntities): void
    {
        if ($skillVersionEntities === []) {
            return;
        }

        $logoPathsByOrg = [];
        $fileKeysByOrg = [];
        foreach ($skillVersionEntities as $skillVersionEntity) {
            if ($skillVersionEntity->getLogo()) {
                $logoPathsByOrg[$skillVersionEntity->getOrganizationCode()][] = EasyFileTools::formatPath($skillVersionEntity->getLogo());
            }
            if ($skillVersionEntity->getFileKey()) {
                $fileKeysByOrg[$skillVersionEntity->getOrganizationCode()][] = $skillVersionEntity->getFileKey();
            }
        }

        $logoLinksMapByOrg = [];
        foreach ($logoPathsByOrg as $orgCode => $logoPaths) {
            $logoLinksMapByOrg[$orgCode] = $this->getIcons($orgCode, $logoPaths);
        }

        $fileLinksMapByOrg = [];
        foreach ($fileKeysByOrg as $orgCode => $fileKeys) {
            $fileLinksMapByOrg[$orgCode] = $this->getPrivateFileLinks($orgCode, $fileKeys);
        }

        foreach ($skillVersionEntities as $skillVersionEntity) {
            $orgCode = $skillVersionEntity->getOrganizationCode();
            if ($skillVersionEntity->getLogo()) {
                $formattedPath = EasyFileTools::formatPath($skillVersionEntity->getLogo());
                $fileLink = $logoLinksMapByOrg[$orgCode][$formattedPath] ?? null;
                $skillVersionEntity->setLogo($fileLink instanceof FileLink ? $fileLink->getUrl() : '');
            }
            if ($skillVersionEntity->getFileKey()) {
                $fileLink = $fileLinksMapByOrg[$orgCode][$skillVersionEntity->getFileKey()] ?? null;
                $skillVersionEntity->setFileUrl($fileLink instanceof FileLink ? $fileLink->getUrl() : null);
            }
        }
    }
}
