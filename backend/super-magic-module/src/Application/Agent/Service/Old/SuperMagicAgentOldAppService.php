<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service\Old;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Interfaces\Flow\DTO\MagicFlowApiChatDTO;
use Dtyq\SuperMagic\Application\Agent\Service\AbstractSuperMagicAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;

class SuperMagicAgentOldAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected MagicUserSettingDomainService $magicUserSettingDomainService;

    #[Inject]
    protected ModeDomainService $modeDomainService;

    #[Inject]
    protected ResourceVisibilityDomainService $resourceVisibilityDomainService;

    #[Inject]
    protected OperationPermissionDomainService $operationPermissionDomainService;

    public function show(Authenticatable $authorization, string $code, bool $withToolSchema = false, bool $checkPermission = true): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $checkPermission && $this->checkPermission($dataIsolation, $code);

        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        // 更新图片真实链接
        $this->updateAgentEntityIcon($agent);

        if ($withToolSchema) {
            $remoteToolCodes = [];
            foreach ($agent->getTools() as $tool) {
                if ($tool->getType()->isRemote()) {
                    $remoteToolCodes[] = $tool->getCode();
                }
            }
            // 获取工具定义
            $remoteTools = ToolsExecutor::getToolFlows($flowDataIsolation, $remoteToolCodes, true);
            foreach ($agent->getTools() as $tool) {
                $remoteTool = $remoteTools[$tool->getCode()] ?? null;
                if ($remoteTool) {
                    $tool->setSchema($remoteTool->getInput()->getForm()?->getForm()->toJsonSchema());
                }
            }
        }

        if ($checkPermission) {
            // 添加可见性配置
            $agent->setVisibilityConfig(
                $this->resourceVisibilityDomainService->getVisibilityConfig(
                    $dataIsolation,
                    ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                    $code
                )?->toArray() ?? null
            );
        }

        return $agent;
    }

    /**
     * @return array{frequent: array<SuperMagicAgentEntity>, all: array<SuperMagicAgentEntity>, total: int}
     */
    public function queries(Authenticatable $authorization, SuperMagicAgentQuery $query, Page $page): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $userId = $authorization->getId();

        // 获取用户可访问的智能体编码列表
        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $userId);
        $accessibleAgentCodes = $accessibleAgentResult['codes'];

        $page->disable();
        $query->setCodes($accessibleAgentCodes);
        $query->setSelect(['id', 'code', 'name', 'description', 'icon', 'icon_type', 'name_i18n', 'description_i18n', 'organization_code']); // Only select necessary fields for list

        $result = $this->superMagicAgentDomainService->queries($dataIsolation, $query, $page);

        foreach ($result['list'] as $agent) {
            // 设置是否为公开的智能体
            if (in_array($agent->getCode(), $accessibleAgentResult['accessible'])) {
                $agent->setType(SuperMagicAgentType::Public);
            }
        }

        // 合并内置模型
        $builtinAgents = $this->getBuiltinAgent($dataIsolation);
        if (! $page->isEnabled()) {
            $result['list'] = array_merge($builtinAgents, $result['list']);
            $result['total'] += count($builtinAgents);
        }

        // 更新图片真实链接
        $this->updateAgentEntitiesIcon($result['list']);

        // 根据用户排列配置对结果进行分类
        $orderConfig = $this->getOrderConfig($authorization);

        return $this->categorizeAgents($result['list'], $result['total'], $orderConfig);
    }

    #[Transactional]
    public function save(Authenticatable $authorization, SuperMagicAgentEntity $entity, bool $checkPrompt = true): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        if (! $entity->shouldCreate() && $entity->getCode()) {
            $this->checkPermission($dataIsolation, $entity->getCode());
        }

        $validationConfig = $entity->getVisibilityConfig() ? new VisibilityConfig($entity->getVisibilityConfig()) : null;

        if ($validationConfig && $validationConfig->getVisibilityType() !== VisibilityType::NONE) {
            // 检测是否组织管理员权限
            $this->checkOrgAdmin($dataIsolation);
        }

        $iconArr = $entity->getIcon();
        if (! empty($iconArr['url'])) {
            $iconArr['icon'] = EasyFileTools::formatPath($iconArr['url']);
            $entity->setIcon($iconArr);
        }

        $entity = $this->superMagicAgentDomainService->save($dataIsolation, $entity, $checkPrompt);

        // 保存可见性配置
        if ($validationConfig) {
            $this->resourceVisibilityDomainService->saveVisibilityConfig(
                $dataIsolation,
                ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                $entity->getCode(),
                $validationConfig
            );
            $entity->setVisibilityConfig($validationConfig?->toArray() ?? null);
        }

        return $entity;
    }

    public function enable(Authenticatable $authorization, string $code): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->enable($dataIsolation, $code);
    }

    public function disable(Authenticatable $authorization, string $code): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->disable($dataIsolation, $code);
    }

    /**
     * 保存智能体排列配置.
     * @param array{frequent: array<string>, all: array<string>} $orderConfig
     */
    public function saveOrderConfig(Authenticatable $authorization, array $orderConfig): MagicUserSettingEntity
    {
        $dataIsolation = $this->createContactDataIsolation($authorization);
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::SuperMagicAgentSort->value);
        $entity->setValue($orderConfig);

        return $this->magicUserSettingDomainService->save($dataIsolation, $entity);
    }

    public function executeTool(Authenticatable $authorization, array $params): array
    {
        $toolCode = $params['code'] ?? '';
        $arguments = $params['arguments'] ?? [];
        if (empty($toolCode)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'code']);
        }

        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $toolFlow = ToolsExecutor::getToolFlows($flowDataIsolation, [$toolCode])[0] ?? null;
        if (! $toolFlow || ! $toolFlow->isEnabled()) {
            $label = $toolFlow ? $toolFlow->getName() : $toolCode;
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.disabled', ['label' => $label]);
        }
        $apiChatDTO = new MagicFlowApiChatDTO();
        $apiChatDTO->setParams($arguments);
        $apiChatDTO->setFlowCode($toolFlow->getCode());
        $apiChatDTO->setFlowVersionCode($toolFlow->getVersionCode());
        $apiChatDTO->setMessage('super_magic_tool_call');
        return di(MagicFlowExecuteAppService::class)->apiParamCallByRemoteTool(
            $flowDataIsolation,
            $apiChatDTO,
            'super_magic_tool_call'
        );
    }

    /**
     * @return array<SuperMagicAgentEntity>
     */
    private function getBuiltinAgent(SuperMagicAgentDataIsolation $superMagicAgentDataIsolation): array
    {
        $modeDataIsolation = $this->createModeDataIsolation($superMagicAgentDataIsolation);
        $modeDataIsolation->setOnlyOfficialOrganization(true);
        $query = new ModeQuery(excludeDefault: true, status: true);
        $modesResult = $this->modeDomainService->getModes($modeDataIsolation, $query, Page::createNoPage());

        // 过滤组织不可见
        /** @var ModeEntity $mode */
        foreach ($modesResult['list'] as $modeIndex => $mode) {
            if (! $mode->isOrganizationVisible($superMagicAgentDataIsolation->getCurrentOrganizationCode())) {
                unset($modesResult['list'][$modeIndex]);
            }
        }
        $modesResult['list'] = array_values($modesResult['list']);

        $list = [];
        foreach ($modesResult['list'] as $mode) {
            $list[] = $this->createBuiltinAgentEntityByMode($superMagicAgentDataIsolation, $mode);
        }
        return $list;
    }
}
