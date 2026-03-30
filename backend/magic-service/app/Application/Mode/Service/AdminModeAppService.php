<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\AdminModeAssembler;
use App\Application\Mode\DTO\Admin\AdminModeAggregateDTO;
use App\Application\Mode\DTO\Admin\AdminModeDTO;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Provider\Entity\ValueObject\AggregateStrategy;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\ErrorCode\ModeErrorCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Mode\DTO\Request\CreateModeRequest;
use App\Interfaces\Mode\DTO\Request\QueryModesRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeRequest;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Exception;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;

class AdminModeAppService extends AbstractModeAppService
{
    #[Inject]
    protected SuperMagicAgentDomainService $superMagicAgentDomainService;

    /**
     * 获取模式列表 (管理后台用，包含完整i18n字段).
     */
    public function getModes(MagicUserAuthorization $authorization, Page $page, QueryModesRequest $request): array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        // 管理后台查询：sort降序，不过滤默认模式
        $query = new ModeQuery('desc', false);

        // 设置查询参数
        $status = $request->getStatus();
        if ($status !== null) {
            $query->setStatus($status === '1');
        }
        $query->setIdentifier($request->getIdentifier());
        $query->setKeyword($request->getKeyword());

        $result = $this->modeDomainService->getModes($dataIsolation, $query, $page);

        $modeDTOs = AdminModeAssembler::entitiesToAdminDTOs($result['list']);
        // 批量处理icon，将file_key转换为完整URL
        $this->processModeIcons($modeDTOs);

        // 使用 agent 信息覆盖名称和 logo
        $this->replaceModeNameI18nFromAgent($authorization, $modeDTOs);

        return [
            'total' => $result['total'],
            'list' => $modeDTOs,
        ];
    }

    /**
     * 根据ID获取模式聚合根（包含模式详情、分组、模型关系）.
     */
    public function getModeById(MagicUserAuthorization $authorization, string $id): AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $modeAggregate = $this->modeDomainService->getModeDetailById($dataIsolation, $id);

        if (! $modeAggregate) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }

        $providerModels = $this->getDetailedModels($modeAggregate);

        // 转换为DTO
        $modeAggregateDTO = AdminModeAssembler::aggregateToAdminDTO($modeAggregate, $providerModels);

        // 处理icon
        $this->processModeAggregateIcons($modeAggregateDTO);

        // 替换 name_i18n
        $this->replaceModeAggregateNameI18nFromAgent($authorization, $modeAggregateDTO);

        return $modeAggregateDTO;
    }

    public function getOriginMode(MagicUserAuthorization $authorization, string $id): AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $modeAggregate = $this->modeDomainService->getOriginMode($dataIsolation, $id);
        if (! $modeAggregate) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }
        $providerModels = $this->getDetailedModels($modeAggregate);
        // 转换为DTO
        $modeAggregateDTO = AdminModeAssembler::aggregateToAdminDTO($modeAggregate, $providerModels);

        // 处理icon
        $this->processModeAggregateIcons($modeAggregateDTO);

        return $modeAggregateDTO;
    }

    /**
     * 创建模式 (管理后台用).
     */
    public function createMode(MagicUserAuthorization $authorization, CreateModeRequest $request): AdminModeDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            $modeEntity = AdminModeAssembler::createModeRequestToEntity(
                $request
            );
            $savedMode = $this->modeDomainService->createMode($dataIsolation, $modeEntity);

            Db::commit();

            $modeEntity = $this->modeDomainService->getModeById($dataIsolation, $savedMode->getId());
            return AdminModeAssembler::modeToAdminDTO($modeEntity);
        } catch (Exception $exception) {
            $this->logger->warning('Create mode failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * 更新模式.
     */
    public function updateMode(MagicUserAuthorization $authorization, string $modeId, UpdateModeRequest $request): AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        // 先获取现有的完整实体
        $existingMode = $this->modeDomainService->getModeById($dataIsolation, $modeId);
        if (! $existingMode) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }

        Db::beginTransaction();
        try {
            // 将更新请求应用到现有实体（只更新允许修改的字段）
            AdminModeAssembler::applyUpdateRequestToEntity($request, $existingMode);

            $updatedMode = $this->modeDomainService->updateMode($dataIsolation, $existingMode);

            Db::commit();

            // 重新获取聚合根信息
            $updatedModeAggregate = $this->modeDomainService->getModeDetailById($dataIsolation, $updatedMode->getId());
            $updatedModeAggregateDTO = AdminModeAssembler::aggregateToAdminDTO($updatedModeAggregate);
            $this->processModeAggregateIcons($updatedModeAggregateDTO);
            $this->replaceModeAggregateNameI18nFromAgent($authorization, $updatedModeAggregateDTO);
            $this->replaceModeAggregateIconUrlFromAgent($authorization, $updatedModeAggregateDTO);

            return $updatedModeAggregateDTO;
        } catch (Exception $exception) {
            $this->logger->warning('Update mode failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * 更新模式状态
     */
    public function updateModeStatus(MagicUserAuthorization $authorization, string $id, bool $status): bool
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        try {
            return $this->modeDomainService->updateModeStatus($dataIsolation, $id, $status);
        } catch (Exception $exception) {
            $this->logger->warning('Update mode status failed: ' . $exception->getMessage());
            throw $exception;
        }
    }

    /**
     * 获取默认模式.
     */
    public function getDefaultMode(MagicUserAuthorization $authorization): ?AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $defaultModeAggregate = $this->modeDomainService->getDefaultMode($dataIsolation);
        $providerModels = $this->getDetailedModels($defaultModeAggregate);

        $adminModeAggregateDTO = AdminModeAssembler::aggregateToAdminDTO($defaultModeAggregate, $providerModels);

        $this->processModeAggregateIcons($adminModeAggregateDTO);

        return $adminModeAggregateDTO;
    }

    /**
     * 保存模式配置.
     */
    public function saveModeConfig(MagicUserAuthorization $authorization, AdminModeAggregateDTO $modeAggregateDTO): AdminModeAggregateDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        Db::beginTransaction();
        try {
            // 处理动态模型：创建/更新动态模型记录
            $this->processDynamicModels($authorization, $modeAggregateDTO);

            // 将DTO转换为领域对象
            $modeAggregateEntity = AdminModeAssembler::aggregateDTOToEntity($modeAggregateDTO);

            $this->modeDomainService->saveModeConfig($dataIsolation, $modeAggregateEntity);

            Db::commit();

            return $this->getModeById($authorization, $modeAggregateDTO->getMode()->getId());
        } catch (Exception $exception) {
            $this->logger->warning('Save mode config failed: ' . $exception->getMessage());
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * 处理动态模型：创建/更新动态模型记录.
     */
    private function processDynamicModels(MagicUserAuthorization $authorization, AdminModeAggregateDTO $modeAggregateDTO): void
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $providerDataIsolation = ProviderDataIsolation::create(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId()
        );

        $modeGroupRelationEntities = $this->modeDomainService->getModeGroupRelationsIndexedById($dataIsolation, $modeAggregateDTO->getMode()->getId());

        foreach ($modeAggregateDTO->getGroups() as $groupAggregateDTO) {
            foreach ($groupAggregateDTO->getModels() as $modelDTO) {
                // 检查是否为动态模型
                if (! $modelDTO->getModelTypeEnum()->isDynamic()) {
                    continue;
                }

                $modelId = $modelDTO->getModelId();
                // 如果设置了model_id，并且不存在关联，说明是新增
                // 需检查是否重复model_id，重复则报错
                if ($modelId && ! isset($modeGroupRelationEntities[$modelDTO->getId()])) {
                    $existingModel = $this->providerModelDomainService->getByModelId($providerDataIsolation, $modelId);
                    $existingModel && ExceptionBuilder::throw(ServiceProviderErrorCode::OriginalModelIdAlreadyExists);
                }

                $aggregateConfig = $modelDTO->getAggregateConfig();

                // 通过 DomainService 创建或更新动态模型
                $strategy = AggregateStrategy::fromString($aggregateConfig['strategy'] ?? null);
                $dynamicModel = $this->providerModelDomainService->syncAggregateModel(
                    $providerDataIsolation,
                    $modelId,
                    $modelDTO->getModelName() ?: $modelDTO->getModelId(),
                    $aggregateConfig['models'] ?? [],
                    $strategy,
                    $aggregateConfig['strategy_config'] ?? ['order' => 'asc'],
                    $modelDTO->getModelIcon() ?? '',
                    $modelDTO->getModelDescription() ?? '',
                    $modelDTO->getModelTranslate() ?? [],
                    $modelDTO->getModelCategory()
                );

                // 更新 modelDTO 的 modelId 和 providerModelId
                $modelDTO->setModelId($dynamicModel->getModelId());
                $modelDTO->setProviderModelId((string) $dynamicModel->getId());
            }
        }
    }

    /**
     * 根据 modeEntity 的 identifier 批量查询 agent，如果查询到则替换 name_i18n 和 logo.
     * 如果没有对应 agent 或 agent 没有 logo，则将 mode logo 置空.
     *
     * @param AdminModeDTO[] $modeDTOs
     */
    private function replaceModeNameI18nFromAgent(MagicUserAuthorization $authorization, array $modeDTOs): void
    {
        if (empty($modeDTOs)) {
            return;
        }

        // 收集所有的 identifier
        $identifiers = [];
        foreach ($modeDTOs as $modeDTO) {
            $identifier = $modeDTO->getIdentifier();
            if (! empty($identifier)) {
                $identifiers[] = $identifier;
            }
        }

        if (empty($identifiers)) {
            return;
        }

        // 去重
        $identifiers = array_unique($identifiers);

        // 创建 SuperMagicAgentDataIsolation
        $agentDataIsolation = SuperMagicAgentDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 批量查询 agent
        $query = new SuperMagicAgentQuery();
        $query->setCodes($identifiers);
        $page = new Page(1, count($identifiers)); // 设置足够大的分页，确保获取所有数据
        $result = $this->superMagicAgentDomainService->queries($agentDataIsolation, $query, $page);
        $agents = $result['list'];
        $agents = $this->updateAgentEntitiesIcon($agents);

        // 建立 code => agent 的映射
        $agentMap = [];
        foreach ($agents as $agent) {
            $agentMap[$agent->getCode()] = $agent;
        }

        // 替换 name_i18n 和 logo
        foreach ($modeDTOs as $modeDTO) {
            $identifier = $modeDTO->getIdentifier();
            $modeDTO->setColor('');
            $modeDTO->setIconUrl('');
            $modeDTO->setIcon('');
            if (empty($identifier) || ! isset($agentMap[$identifier])) {
                continue;
            }

            $agent = $agentMap[$identifier];
            $modeDTO->setNameI18n($agent->getNameI18n());
            $iconUrl = (string) ($agent->getIcon()['url'] ?? $agent->getIcon()['value'] ?? '');

            if ($iconUrl === '') {
                continue;
            }

            $modeDTO->setIconUrl($iconUrl);
            $modeDTO->setIconType($agent->getIconType());
        }
    }

    /**
     * 根据 modeAggregateDTO 中的 mode identifier 查询 agent，如果查询到则替换 name_i18n.
     */
    private function replaceModeAggregateNameI18nFromAgent(MagicUserAuthorization $authorization, AdminModeAggregateDTO $modeAggregateDTO): void
    {
        $modeDTO = $modeAggregateDTO->getMode();
        $identifier = $modeDTO->getIdentifier();
        if (empty($identifier)) {
            return;
        }

        // 创建 SuperMagicAgentDataIsolation
        $agentDataIsolation = SuperMagicAgentDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 根据 identifier 查询 agent
        $agent = $this->superMagicAgentDomainService->getByCode($agentDataIsolation, $identifier);
        if ($agent !== null) {
            // 如果查询到 agent，替换 name_i18n
            $modeDTO->setNameI18n($agent->getNameI18n());
        }
    }

    /**
     * 根据 modeAggregateDTO 中的 mode identifier 查询 agent，如果查询到则替换 icon_url.
     */
    private function replaceModeAggregateIconUrlFromAgent(MagicUserAuthorization $authorization, AdminModeAggregateDTO $modeAggregateDTO): void
    {
        $modeDTO = $modeAggregateDTO->getMode();
        $identifier = $modeDTO->getIdentifier();
        if (empty($identifier)) {
            return;
        }

        $agentDataIsolation = SuperMagicAgentDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        $agent = $this->superMagicAgentDomainService->getByCode($agentDataIsolation, $identifier);
        if ($agent !== null) {
            $this->updateAgentEntitiesIcon([$agent]);
            $agentIconUrl = (string) ($agent->getIcon()['url'] ?? $agent->getIcon()['value'] ?? '');
            if ($agentIconUrl !== '') {
                $modeDTO->setIconUrl($agentIconUrl);
                $modeDTO->setIconType($agent->getIconType());
            }
        }
    }

    /**
     * 批量处理模式列表的icon_url，将file_key转换为完整的URL.
     *
     * @param AdminModeDTO[] $modeDTOs 模式DTO列表
     */
    private function processModeIcons(array $modeDTOs): void
    {
        if (empty($modeDTOs)) {
            return;
        }

        // 收集所有图标路径按组织编码分组
        $iconsByOrg = [];
        $iconToModeMap = [];

        foreach ($modeDTOs as $modeDTO) {
            $iconUrl = $modeDTO->getIconUrl();
            if (empty($iconUrl)) {
                continue;
            }

            $iconUrl = FileAssembler::formatPath($iconUrl);
            $organizationCode = substr($iconUrl, 0, strpos($iconUrl, '/'));

            if (! isset($iconsByOrg[$organizationCode])) {
                $iconsByOrg[$organizationCode] = [];
            }
            $iconsByOrg[$organizationCode][] = $iconUrl;

            if (! isset($iconToModeMap[$iconUrl])) {
                $iconToModeMap[$iconUrl] = [];
            }
            $iconToModeMap[$iconUrl][] = $modeDTO;
        }

        // 批量获取图标URL
        $iconUrlMap = [];
        foreach ($iconsByOrg as $organizationCode => $icons) {
            $links = $this->fileDomainService->getLinks($organizationCode, array_unique($icons));
            $iconUrlMap = array_merge($iconUrlMap, $links);
        }

        // 设置图标URL
        foreach ($iconUrlMap as $icon => $fileLink) {
            if (isset($iconToModeMap[$icon])) {
                $url = $fileLink ? $fileLink->getUrl() : '';
                foreach ($iconToModeMap[$icon] as $modeDTO) {
                    $modeDTO->setIconUrl($url);
                }
            }
        }
    }
}
