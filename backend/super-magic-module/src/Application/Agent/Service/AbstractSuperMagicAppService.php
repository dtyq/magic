<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Kernel\AbstractKernelAppService;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationPermissionResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\File\EasyFileTools;
use DateTime;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;

abstract class AbstractSuperMagicAppService extends AbstractKernelAppService
{
    protected readonly LoggerInterface $logger;

    public function __construct(
        protected OperationPermissionDomainService $operationPermissionDomainService,
        protected SuperMagicAgentDomainService $superMagicAgentDomainService,
        protected ModeDomainService $modeDomainService,
        protected MagicUserSettingDomainService $magicUserSettingDomainService,
        protected ResourceVisibilityDomainService $resourceVisibilityDomainService,
        protected FileDomainService $fileDomainService,
        protected MicroAgentFactory $microAgentFactory,
        protected LoggerFactory $loggerFactory,
        protected AiAbilityDomainService $aiAbilityDomainService,
    ) {
        $this->logger = $this->loggerFactory->get(get_class($this));
    }

    protected function createFlowDataIsolation(Authenticatable|BaseDataIsolation $authorization): FlowDataIsolation
    {
        $dataIsolation = new FlowDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createSuperMagicDataIsolation(Authenticatable|BaseDataIsolation $authorization): SuperMagicAgentDataIsolation
    {
        $dataIsolation = new SuperMagicAgentDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createContactDataIsolation(Authenticatable|BaseDataIsolation $authorization): ContactDataIsolation
    {
        // 先创建SuperMagicDataIsolation，然后转换为ContactDataIsolation
        $superMagicDataIsolation = $this->createSuperMagicDataIsolation($authorization);
        return $this->createContactDataIsolationByBase($superMagicDataIsolation);
    }

    protected function checkPermission(SuperMagicAgentDataIsolation $dataIsolation, string $code): void
    {
        if (! $this->operationPermissionDomainService->isResourceOwner(
            $dataIsolation,
            OperationPermissionResourceType::CustomAgent,
            $code,
            $dataIsolation->getCurrentUserId()
        )) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }
    }

    /**
     * 获取用户可访问的智能体编码列表.
     * @return array{accessible: array<string>, creator: array<string>, codes: array<string>}
     */
    protected function getAccessibleAgentCodes(SuperMagicAgentDataIsolation $dataIsolation, string $userId): array
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        // 调用资源可见性领域服务获取可访问的智能体编码
        $accessibleCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes($permissionDataIsolation, $userId, ResourceVisibilityResourceType::SUPER_MAGIC_AGENT);

        // 查询用户自己创建的智能体编码（用户创建的必然可见）
        $creatorCodes = $this->superMagicAgentDomainService->getCodesByCreator($dataIsolation, $userId);

        // 从 $accessibleCodes 从剔除 $creatorCodes
        $accessibleCodes = array_diff($accessibleCodes, $creatorCodes);

        // 合并并去重
        return [
            'accessible' => $accessibleCodes,
            'creator' => $creatorCodes,
            'codes' => array_values(array_unique(array_merge($creatorCodes, $accessibleCodes))),
        ];
    }

    protected function createBuiltinAgentEntityByMode(SuperMagicAgentDataIsolation $superMagicAgentDataIsolation, ModeEntity $modeEntity): SuperMagicAgentEntity
    {
        $entity = new SuperMagicAgentEntity();

        // 设置基本信息
        $entity->setOrganizationCode($superMagicAgentDataIsolation->getCurrentOrganizationCode());
        $entity->setCode($modeEntity->getIdentifier());
        $entity->setName($modeEntity->getName());
        $entity->setDescription($modeEntity->getPlaceholder());
        $entity->setIcon([
            'url' => $modeEntity->getIconUrl(),
            'type' => $modeEntity->getIcon(),
            'color' => $modeEntity->getColor(),
        ]);
        $entity->setIconType($modeEntity->getIconType());
        $entity->setType(SuperMagicAgentType::Built_In);
        $entity->setEnabled(true);
        $entity->setPrompt([]);
        $entity->setTools([]);

        // 设置系统创建信息
        $entity->setCreator('system');
        $entity->setCreatedAt(new DateTime());
        $entity->setModifier('system');
        $entity->setUpdatedAt(new DateTime());

        return $entity;
    }

    /**
     * 获取智能体排列配置.
     * @return null|array{frequent: array<string>, all: array<string>}
     */
    protected function getOrderConfig(Authenticatable $authorization): ?array
    {
        $dataIsolation = $this->createContactDataIsolation($authorization);
        $setting = $this->magicUserSettingDomainService->get($dataIsolation, UserSettingKey::SuperMagicAgentSort->value);

        return $setting?->getValue();
    }

    /**
     * 获取默认排序配置：内置智能体的前6个作为frequent.
     * @param array<SuperMagicAgentEntity> $agents
     */
    protected function getDefaultOrderConfig(array $agents): array
    {
        $builtinCodes = [];
        $customCodes = [];

        foreach ($agents as $agent) {
            if ($agent->getType()->isBuiltIn()) {
                $builtinCodes[] = $agent->getCode();
            } else {
                $customCodes[] = $agent->getCode();
            }
        }

        // 内置智能体的前6个作为frequent
        $frequent = array_slice($builtinCodes, 0, 6);

        // all包含所有智能体（内置+自定义）
        $all = array_merge($builtinCodes, $customCodes);

        return [
            'frequent' => $frequent,
            'all' => $all,
        ];
    }

    /**
     * 将智能体列表按照用户配置分类为frequent和all.
     */
    protected function categorizeAgents(array $agents, int $total, ?array $orderConfig): array
    {
        // 如果没有用户配置，使用默认配置：内置智能体的前6个作为frequent
        if (empty($orderConfig)) {
            $orderConfig = $this->getDefaultOrderConfig($agents);
        }

        $frequentCodes = $orderConfig['frequent'] ?? [];
        $allOrder = $orderConfig['all'] ?? [];

        // 创建code到entity的映射
        $agentMap = [];
        foreach ($agents as $agent) {
            $agentMap[$agent->getCode()] = $agent;
        }

        // 构建frequent列表
        $frequent = [];
        foreach ($frequentCodes as $code) {
            if (isset($agentMap[$code])) {
                $agentMap[$code]->setCategory('frequent');
                $frequent[] = $agentMap[$code];
            }
        }

        // 构建all列表（排除frequent中的）
        $all = [];
        $frequentCodesSet = array_flip($frequentCodes);

        // 如果有排序配置，按配置排序
        if (! empty($allOrder)) {
            foreach ($allOrder as $code) {
                if (isset($agentMap[$code]) && ! isset($frequentCodesSet[$code])) {
                    $agentMap[$code]->setCategory('all');
                    $all[] = $agentMap[$code];
                }
            }

            // 添加不在排序配置中的智能体
            foreach ($agents as $agent) {
                $code = $agent->getCode();
                if (! in_array($code, $allOrder) && ! isset($frequentCodesSet[$code])) {
                    $agent->setCategory('all');
                    $all[] = $agent;
                }
            }
        } else {
            // 没有排序配置，直接过滤frequent
            foreach ($agents as $agent) {
                if (! isset($frequentCodesSet[$agent->getCode()])) {
                    $agent->setCategory('all');
                    $all[] = $agent;
                }
            }
        }

        return [
            'frequent' => $frequent,
            'all' => $all,
            'total' => $total,
        ];
    }

    /**
     * 更新AgentIcon.
     */
    protected function updateAgentEntityIcon(SuperMagicAgentEntity $agentEntity): SuperMagicAgentEntity
    {
        $this->updateAgentEntitiesIcon([$agentEntity]);
        return $agentEntity;
    }

    /**
     * 更新AgentIcon.
     *
     * @param AgentVersionEntity[]|SuperMagicAgentEntity[] $agentEntities
     * @return SuperMagicAgentEntity[]
     */
    protected function updateAgentEntitiesIcon(array $agentEntities): array
    {
        // 按组织代码分组收集需要转换的路径，并建立路径到 agent code 的映射
        $codeMapUrls = [];
        foreach ($agentEntities as $agent) {
            $formattedPath = EasyFileTools::formatPath($agent->getIcon()['url'] ?? '');
            if (! $formattedPath) {
                $formattedPath = EasyFileTools::formatPath($agent->getIcon()['value'] ?? '');
            }
            if ($formattedPath) {
                $codeMapUrls[$agent->getOrganizationCode()][$agent->getCode()] = $formattedPath;
            }
        }

        foreach ($codeMapUrls as $organizationCode => $codeMapUrl) {
            $fileUrlsMap = $this->getIcons($organizationCode, $codeMapUrl);

            foreach ($agentEntities as $agentEntity) {
                if (! isset($codeMapUrls[$agentEntity->getOrganizationCode()][$agentEntity->getCode()])) {
                    continue;
                }

                $iconUrl = $codeMapUrls[$agentEntity->getOrganizationCode()][$agentEntity->getCode()];
                $fileLink = $fileUrlsMap[$iconUrl] ?? null;
                if (! $fileLink) {
                    continue;
                }
                $icon = $agentEntity->getIcon();
                $icon['url'] = $fileLink->getUrl();
                $icon['value'] = $fileLink->getUrl();
                $agentEntity->setIcon($icon);
            }
        }
        return $agentEntities;
    }

    /**
     * 更新 Skill 实体的 Logo URL（将路径转换为完整URL）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param array<SkillEntity|SkillVersionEntity> $skillEntities Skill 实体数组
     */
    protected function updateSkillLogoUrls(SuperMagicAgentDataIsolation $dataIsolation, array $skillEntities): void
    {
        if (empty($skillEntities)) {
            return;
        }

        // 按组织代码分组收集需要转换的路径
        $pathsByOrg = [];
        foreach ($skillEntities as $skillEntity) {
            $formattedPath = EasyFileTools::formatPath($skillEntity->getLogo() ?? '');
            if ($formattedPath) {
                $orgCode = $skillEntity->getOrganizationCode();
                $pathsByOrg[$orgCode][] = $formattedPath;
            }
        }

        if (empty($pathsByOrg)) {
            return;
        }

        // 按组织批量获取文件 URL
        $allFileLinksMap = [];
        foreach ($pathsByOrg as $orgCode => $paths) {
            $fileLinksMap = $this->getIcons($orgCode, $paths);
            $allFileLinksMap[$orgCode] = $fileLinksMap;
        }

        // 更新 Skill 实体的 logo URL
        foreach ($skillEntities as $skillEntity) {
            $formattedPath = EasyFileTools::formatPath($skillEntity->getLogo() ?? '');
            if ($formattedPath) {
                $fileLink = $allFileLinksMap[$skillEntity->getOrganizationCode()][$formattedPath] ?? null;
                $skillEntity->setLogo($fileLink instanceof FileLink ? $fileLink->getUrl() : null);
            }
        }
    }

    /**
     * 更新 Category Logo URL（将路径转换为完整URL）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param array<int, array<string, mixed>> $categories Category 数组，每个元素包含 'logo' 字段
     */
    protected function updateCategoryLogoUrls(SuperMagicAgentDataIsolation $dataIsolation, array &$categories): void
    {
        if (empty($categories)) {
            return;
        }

        // 按组织代码分组收集需要转换的路径
        $pathsByOrg = [];
        foreach ($categories as $category) {
            $formattedPath = EasyFileTools::formatPath($category['logo'] ?? '');
            if ($formattedPath) {
                $orgCode = $dataIsolation->getCurrentOrganizationCode();
                $pathsByOrg[$orgCode][] = $formattedPath;
            }
        }

        if (empty($pathsByOrg)) {
            return;
        }

        // 按组织批量获取文件 URL
        $allFileLinksMap = [];
        foreach ($pathsByOrg as $orgCode => $paths) {
            $fileLinksMap = $this->getIcons($orgCode, $paths);
            $allFileLinksMap[$orgCode] = $fileLinksMap;
        }

        // 更新 Category 的 logo URL
        foreach ($categories as &$category) {
            $formattedPath = EasyFileTools::formatPath($category['logo'] ?? '');
            if ($formattedPath) {
                $orgCode = $dataIsolation->getCurrentOrganizationCode();
                $fileLink = $allFileLinksMap[$orgCode][$formattedPath] ?? null;
                if ($fileLink instanceof FileLink) {
                    $category['logo'] = $fileLink->getUrl();
                }
            }
        }
    }

    /**
     * 更新 Skill 实体的 FileUrl（根据 fileKey 获取私有链接）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param array<SkillEntity|SkillVersionEntity> $skillEntities Skill 实体数组
     */
    protected function updateSkillFileUrl(SuperMagicAgentDataIsolation $dataIsolation, array $skillEntities): void
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

    protected function updateAgentFileUrl(SuperMagicAgentEntity $agentEntity): void
    {
        $fileKey = $agentEntity->getFileKey();
        if (empty($fileKey)) {
            return;
        }

        $fileLink = $this->getPrivateFileLinks($agentEntity->getOrganizationCode(), [$fileKey])[$fileKey] ?? null;
        $agentEntity->setFileUrl($fileLink instanceof FileLink ? $fileLink->getUrl() : null);
    }

    protected function getOfficialAgentCodes(Authenticatable $authorization): array
    {
        $modeDataIsolation = $this->createModeDataIsolation($authorization);
        $modeDataIsolation->disabled();

        // 获取后台的所有模式，用于封装数据到 Agent 中
        $query = new ModeQuery(status: true);
        $modeEntities = $this->modeDomainService->getModes($modeDataIsolation, $query, Page::createNoPage())['list'];

        return array_map(fn ($modeEntity) => $modeEntity->getIdentifier(), $modeEntities);
    }
}
