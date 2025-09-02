<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\DTO\MagicFlowApiChatDTO;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;

class SuperMagicAgentAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected MagicUserSettingDomainService $magicUserSettingDomainService;

    public function show(Authenticatable $authorization, string $code, bool $withToolSchema = false): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);
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
                    $tool->setSchema($remoteTool->getInput()->getForm()?->getForm()->toJsonSchema() ?? []);
                }
            }
        }
        return $agent;
    }

    public function queries(Authenticatable $authorization, SuperMagicAgentQuery $query, Page $page): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 目前只能查询自己的，全量查询
        $query->setCreatorId($authorization->getId());
        $page->disable();
        $query->setSelect(['id', 'code', 'name', 'description', 'icon']); // Only select necessary fields for list

        $result = $this->superMagicAgentDomainService->queries($dataIsolation, $query, $page);

        // 根据用户排列配置对结果进行分类
        $orderConfig = $this->getOrderConfig($authorization);

        return $this->categorizeAgents($result['list'], $result['total'], $orderConfig);
    }

    public function save(Authenticatable $authorization, SuperMagicAgentEntity $entity): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->save($dataIsolation, $entity);
    }

    public function delete(Authenticatable $authorization, string $code): bool
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        return $this->superMagicAgentDomainService->delete($dataIsolation, $code);
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

    /**
     * 获取智能体排列配置.
     * @return null|array{frequent: array<string>, all: array<string>}
     */
    public function getOrderConfig(Authenticatable $authorization): ?array
    {
        $dataIsolation = $this->createContactDataIsolation($authorization);
        $setting = $this->magicUserSettingDomainService->get($dataIsolation, UserSettingKey::SuperMagicAgentSort->value);

        return $setting?->getValue();
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
     * 将智能体列表按照用户配置分类为frequent和all.
     */
    private function categorizeAgents(array $agents, int $total, ?array $orderConfig): array
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
                    $all[] = $agentMap[$code];
                }
            }

            // 添加不在排序配置中的智能体
            foreach ($agents as $agent) {
                $code = $agent->getCode();
                if (! in_array($code, $allOrder) && ! isset($frequentCodesSet[$code])) {
                    $all[] = $agent;
                }
            }
        } else {
            // 没有排序配置，直接过滤frequent
            foreach ($agents as $agent) {
                if (! isset($frequentCodesSet[$agent->getCode()])) {
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
     * 获取默认排序配置：内置智能体的前6个作为frequent.
     * @param array<SuperMagicAgentEntity> $agents
     */
    private function getDefaultOrderConfig(array $agents): array
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
}
