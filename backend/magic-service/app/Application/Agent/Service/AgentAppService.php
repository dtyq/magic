<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service;

use App\Domain\Agent\Constant\MagicAgentVersionStatus;
use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\ValueObject\AgentDataIsolation;
use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Domain\Agent\Entity\ValueObject\Visibility\VisibilityType;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Qbhy\HyperfAuth\Authenticatable;

class AgentAppService extends AbstractAppService
{
    /**
     * 查询 Agent 列表.
     *
     * @param Authenticatable $authorization 授权用户
     * @param MagicAgentQuery $query 查询条件
     * @param Page $page 分页信息
     * @return array{total: int, list: array<MagicAgentEntity>, icons: array<string,FileLink>}
     */
    public function queriesAvailable(Authenticatable $authorization, MagicAgentQuery $query, Page $page, bool $containOfficialOrganization = false): array
    {
        $agentDataIsolation = $this->createAgentDataIsolation($authorization);
        $agentDataIsolation->setContainOfficialOrganization($containOfficialOrganization);
        // 获取组织内可用的 Agent Ids
        $orgAgentIds = $this->getOrgAvailableAgentIds($agentDataIsolation);

        // 获取自己有权限的 id
        $permissionDataIsolation = new PermissionDataIsolation($agentDataIsolation->getCurrentOrganizationCode(), $agentDataIsolation->getCurrentUserId());
        $agentResources = $this->operationPermissionAppService->getResourceOperationByUserIds(
            $permissionDataIsolation,
            ResourceType::AgentCode,
            [$agentDataIsolation->getCurrentUserId()]
        )[$agentDataIsolation->getCurrentUserId()] ?? [];
        $selfAgentIds = array_keys($agentResources);

        // 合并
        $agentIds = array_unique(array_merge($orgAgentIds, $selfAgentIds));
        if (empty($agentIds)) {
            return ['total' => 0, 'list' => [], 'icons' => []];
        }
        $query->setIds($agentIds);
        $query->setStatus(MagicAgentVersionStatus::ENTERPRISE_ENABLED->value);
        $query->setSelect(['id', 'robot_name', 'robot_avatar', 'robot_description', 'created_at', 'flow_code', 'organization_code']);

        $data = $this->agentDomainService->queries($agentDataIsolation, $query, $page);
        $icons = [];
        foreach ($data['list'] as $agent) {
            if ($agent->getAgentAvatar()) {
                $icons[] = $agent->getAgentAvatar();
            }
        }

        $data['icons'] = $this->getIcons($agentDataIsolation->getCurrentOrganizationCode(), $icons);
        return $data;
    }

    private function getOrgAvailableAgentIds(AgentDataIsolation $agentDataIsolation): array
    {
        $query = new MagicFLowVersionQuery();
        $query->setSelect(['id', 'root_id', 'visibility_config']);
        $page = Page::createNoPage();
        $data = $this->agentDomainService->getOrgAvailableAgentIds($agentDataIsolation, $query, $page);

        $contactDataIsolation = $this->createContactDataIsolationByBase($agentDataIsolation);
        $userDepartmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($contactDataIsolation, $agentDataIsolation->getCurrentUserId(), true);
        $visibleAgents = [];
        foreach ($data['list'] as $agentVersion) {
            $visibilityConfig = $agentVersion->getVisibilityConfig();

            // 全部可见或无可见性配置
            if ($visibilityConfig === null || $visibilityConfig->getVisibilityType() === VisibilityType::All->value) {
                $visibleAgents[] = $agentVersion->getAgentId();
                continue;
            }

            // 是否在个人可见中
            foreach ($visibilityConfig->getUsers() as $visibleUser) {
                if ($visibleUser->getId() === $agentDataIsolation->getCurrentUserId()) {
                    $visibleAgents[] = $agentVersion->getAgentId();
                }
            }

            // 是否在部门可见中
            foreach ($visibilityConfig->getDepartments() as $visibleDepartment) {
                if (in_array($visibleDepartment->getId(), $userDepartmentIds)) {
                    $visibleAgents[] = $agentVersion->getAgentId();
                }
            }
        }
        return $visibleAgents;
    }
}
