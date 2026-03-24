<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;

/**
 * Skill 应用服务抽象基类.
 */
abstract class AbstractSkillAppService extends AbstractKernelAppService
{
    public function __construct(
        protected FileDomainService $fileDomainService
    ) {
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
