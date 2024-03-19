<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade\Sandbox;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\Old\SuperMagicAgentOldAppService;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\SuperMagicAgentAssembler;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdateAgentInfoRequestDTO;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\AuthManager;

#[ApiResponse(version: 'low_code')]
class SuperMagicAgentSandboxApi extends AbstractSuperMagicSandboxApi
{
    #[Inject]
    protected SuperMagicAgentOldAppService $superMagicAgentOldAppService;

    #[Inject]
    protected SuperMagicAgentAppService $superMagicAgentAppService;

    public function __construct(
        AuthManager $authManager,
        RequestInterface $request,
    ) {
        parent::__construct($authManager, $request);
    }

    public function show(string $code)
    {
        $authorization = $this->getAuthorization();
        $withToolSchema = (bool) $this->request->input('with_tool_schema', false);
        return $this->superMagicAgentAppService->show($authorization, $code, $withToolSchema, true)->toArray();
    }

    public function executeTool()
    {
        $authorization = $this->getAuthorization();
        $params = $this->request->all();
        return $this->superMagicAgentOldAppService->executeTool($authorization, $params);
    }

    /**
     * 更新员工基本信息.
     */
    public function update(string $code)
    {
        $authorization = $this->getAuthorization();

        // 从请求创建DTO
        $requestDTO = UpdateAgentInfoRequestDTO::fromRequest($this->request);
        $DO = SuperMagicAgentAssembler::createDOV2($requestDTO);
        $DO->setCode($code);

        $entity = $this->superMagicAgentAppService->save($authorization, $DO, false);
        $withPromptString = (bool) $this->request->input('with_prompt_string', false);
        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);

        return SuperMagicAgentAssembler::createDTO($entity, $users, $withPromptString);
    }

    /**
     * 新增员工绑定的技能（增量添加）.
     */
    public function addAgentSkills(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 从请求中读取 skill_codes 参数
        $skillCodes = $this->request->input('skill_codes', []);

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentAppService->addAgentSkills($authorization, $code, $skillCodes);

        // 返回空数组
        return [];
    }

    /**
     * 删除员工绑定的技能（增量删除）.
     */
    public function removeAgentSkills(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 从请求中读取 skill_codes 参数
        $skillCodes = $this->request->input('skill_codes', []);

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentAppService->removeAgentSkills($authorization, $code, $skillCodes);

        // 返回空数组
        return [];
    }
}
