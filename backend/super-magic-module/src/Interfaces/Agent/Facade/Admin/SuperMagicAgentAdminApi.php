<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin;

use App\Infrastructure\Util\ShadowCode\ShadowCode;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAiOptimizeAppService;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentOptimizationType;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\BuiltinToolAssembler;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\SuperMagicAgentAssembler;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentDTO;
use Dtyq\SuperMagic\Interfaces\Agent\FormRequest\SuperMagicAgentAiOptimizeFormRequest;
use Dtyq\SuperMagic\Interfaces\Agent\FormRequest\SuperMagicAgentOrderFormRequest;
use Dtyq\SuperMagic\Interfaces\Agent\FormRequest\SuperMagicAgentQueryFormRequest;
use Dtyq\SuperMagic\Interfaces\Agent\FormRequest\SuperMagicAgentSaveFormRequest;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class SuperMagicAgentAdminApi extends AbstractSuperMagicAdminApi
{
    #[Inject]
    protected SuperMagicAgentAppService $superMagicAgentAppService;

    #[Inject]
    protected SuperMagicAgentAiOptimizeAppService $superMagicAgentAiOptimizeAppService;

    public function save(SuperMagicAgentSaveFormRequest $request)
    {
        $authorization = $this->getAuthorization();

        $requestData = $request->validated();
        $DTO = new SuperMagicAgentDTO($requestData);
        $promptShadow = $request->input('prompt_shadow');
        if ($promptShadow) {
            $promptShadow = json_decode(ShadowCode::unShadow($promptShadow), true);
            $DTO->setPrompt($promptShadow);
        }

        $DO = SuperMagicAgentAssembler::createDO($DTO);

        $entity = $this->superMagicAgentAppService->save($authorization, $DO);
        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);

        return SuperMagicAgentAssembler::createDTO($entity, $users);
    }

    public function queries(SuperMagicAgentQueryFormRequest $request)
    {
        $authorization = $this->getAuthorization();

        $requestData = $request->validated();
        $query = new SuperMagicAgentQuery($requestData);
        $page = $this->createPage();

        $result = $this->superMagicAgentAppService->queries($authorization, $query, $page);

        return SuperMagicAgentAssembler::createCategorizedListDTO(
            frequent: $result['frequent'],
            all: $result['all'],
            total: $result['total']
        );
    }

    public function show(string $code)
    {
        $authorization = $this->getAuthorization();
        $withToolSchema = (bool) $this->request->input('with_tool_schema', false);

        $entity = $this->superMagicAgentAppService->show($authorization, $code, $withToolSchema);

        $withPromptString = (bool) $this->request->input('with_prompt_string', false);

        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);

        return SuperMagicAgentAssembler::createDTO($entity, $users, $withPromptString);
    }

    public function destroy(string $code)
    {
        $authorization = $this->getAuthorization();
        $result = $this->superMagicAgentAppService->delete($authorization, $code);

        return ['success' => $result];
    }

    public function enable(string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->superMagicAgentAppService->enable($authorization, $code);

        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);

        return SuperMagicAgentAssembler::createDTO($entity, $users);
    }

    public function disable(string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->superMagicAgentAppService->disable($authorization, $code);

        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);

        return SuperMagicAgentAssembler::createDTO($entity, $users);
    }

    /**
     * 保存智能体排列顺序.
     */
    public function saveOrder(SuperMagicAgentOrderFormRequest $request)
    {
        $authorization = $this->getAuthorization();

        $requestData = $request->validated();
        $orderConfig = [
            'frequent' => $requestData['frequent'] ?? [],
            'all' => $requestData['all'],
        ];

        $this->superMagicAgentAppService->saveOrderConfig($authorization, $orderConfig);

        return ['message' => 'Agent order saved successfully'];
    }

    /**
     * 获取内置工具列表.
     */
    public function tools()
    {
        return BuiltinToolAssembler::createToolCategoryListDTO();
    }

    /**
     * AI优化智能体.
     */
    public function aiOptimize(SuperMagicAgentAiOptimizeFormRequest $request)
    {
        $authorization = $this->getAuthorization();
        $requestData = $request->validated();

        // 创建优化类型枚举实例（FormRequest 验证确保有效性）
        $optimizationType = SuperMagicAgentOptimizationType::fromString($requestData['optimization_type']);

        // 使用 SuperMagicAgentAssembler 创建实体
        $DTO = new SuperMagicAgentDTO($requestData['agent']);
        $promptShadow = $request->input('agent.prompt_shadow');
        if ($promptShadow) {
            $promptShadow = json_decode(ShadowCode::unShadow($promptShadow), true);
            $DTO->setPrompt($promptShadow);
        }
        $agentEntity = SuperMagicAgentAssembler::createDO($DTO);

        // 调用优化服务
        $optimizedEntity = $this->superMagicAgentAiOptimizeAppService->optimizeAgent(
            $authorization,
            $optimizationType,
            $agentEntity
        );

        return [
            'optimization_type' => $optimizationType->value,
            'agent' => SuperMagicAgentAssembler::createDTO($optimizedEntity),
        ];
    }
}
