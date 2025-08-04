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
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Codec\Json;
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

        // 生成缓存 key
        $cacheKey = sprintf('queriesAvailableAgents:user:%s:official:%s', $authorization->getId(), $containOfficialOrganization ? '1' : '0');

        // 尝试从缓存获取 agentIds
        $agentIds = $this->redis->get($cacheKey);
        if ($agentIds !== false) {
            $agentIds = Json::decode($agentIds);
        } else {
            // 获取组织内可用的 Agent Ids
            $orgAgentIds = $this->getOrgAvailableAgentIds($agentDataIsolation, $containOfficialOrganization);

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

            // 缓存结果（仅当不为空时）
            if (! empty($agentIds)) {
                $this->redis->setex($cacheKey, 180, Json::encode($agentIds)); // 缓存 3 分钟
            }
        }

        if (empty($agentIds)) {
            return ['total' => 0, 'list' => [], 'icons' => []];
        }
        $query->setIds($agentIds);
        $query->setStatus(MagicAgentVersionStatus::ENTERPRISE_ENABLED->value);
        $query->setSelect(['id', 'robot_name', 'robot_avatar', 'robot_description', 'created_at', 'flow_code', 'organization_code']);

        $data = $this->agentDomainService->queries($agentDataIsolation, $query, $page);

        // 如果包含官方组织，按照传入的ID顺序重新排序结果，保持官方组织助理在前
        if ($containOfficialOrganization) {
            $data['list'] = $this->sortAgentsByIdOrder($data['list'], $agentIds);
        }

        $icons = [];
        foreach ($data['list'] as $agent) {
            if ($agent->getAgentAvatar()) {
                $icons[] = $agent->getAgentAvatar();
            }
        }

        $data['icons'] = $this->getIcons($agentDataIsolation->getCurrentOrganizationCode(), $icons);
        return $data;
    }

    private function getOrgAvailableAgentIds(AgentDataIsolation $agentDataIsolation, bool $containOfficialOrganization = false): array
    {
        $query = new MagicFLowVersionQuery();
        $query->setSelect(['id', 'root_id', 'visibility_config', 'organization_code']);
        $page = Page::createNoPage();
        $data = $this->agentDomainService->getOrgAvailableAgentIds($agentDataIsolation, $query, $page);

        $contactDataIsolation = $this->createContactDataIsolationByBase($agentDataIsolation);
        $userDepartmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($contactDataIsolation, $agentDataIsolation->getCurrentUserId(), true);

        // 如果需要包含官方组织，则将官方组织的助理排在最前面
        if ($containOfficialOrganization) {
            $officialAgents = [];
            $nonOfficialAgents = [];

            foreach ($data['list'] as $agentVersion) {
                if (OfficialOrganizationUtil::isOfficialOrganization($agentVersion->getOrganizationCode())) {
                    $officialAgents[] = $agentVersion;
                } else {
                    $nonOfficialAgents[] = $agentVersion;
                }
            }

            // 重新排序：官方组织的助理在前
            $data['list'] = array_merge($officialAgents, $nonOfficialAgents);
        }
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

    /**
     * 按照指定的ID顺序对助理列表进行排序.
     *
     * @param array<MagicAgentEntity> $agents 助理实体数组
     * @param array $sortedIds 排序的ID数组
     * @return array 排序后的助理数组
     */
    private function sortAgentsByIdOrder(array $agents, array $sortedIds): array
    {
        if (empty($agents) || empty($sortedIds)) {
            return $agents;
        }

        // 快速创建 ID 到实体的映射
        $agentMap = [];
        foreach ($agents as $agent) {
            $agentMap[$agent->getId()] = $agent;
        }

        // 按照指定顺序重新组织数组
        $sortedAgents = [];
        foreach ($sortedIds as $id) {
            if (isset($agentMap[$id])) {
                $sortedAgents[] = $agentMap[$id];
            }
        }

        return $sortedAgents;
    }
}
