<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade;

use App\Application\Mode\Service\ModeAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\SuperMagicAgentAssembler;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreateAgentRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdateAgentInfoRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\Authenticatable;
use RuntimeException;

use function Hyperf\Support\retry;

#[ApiResponse('low_code')]
class SuperMagicAgentApi extends AbstractApi
{
    #[Inject]
    protected SuperMagicAgentAppService $superMagicAgentAppService;

    #[Inject]
    protected ModeAppService $modeAppService;

    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectAppService $projectAppService,
    ) {
        parent::__construct($request);
    }

    public function getFeatured(): array
    {
        return $this->modeAppService->getFeaturedAgent($this->getAuthorization());
    }

    /**
     * 创建新员工（Agent）.
     */
    public function create(RequestContext $requestContext)
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        // 从请求创建DTO
        $requestDTO = CreateAgentRequestDTO::fromRequest($this->request);

        $DO = SuperMagicAgentAssembler::createDOV2($requestDTO);

        $entity = $this->superMagicAgentAppService->save($authorization, $DO, false);

        // 创建并绑定项目
        $projectInfo = $this->createAndBindProject($authorization, $requestContext, $entity->getName(), $entity->getCode());
        $entity->setProjectId((int) ($projectInfo['project']['id'] ?? 0));

        return SuperMagicAgentAssembler::createDTO($entity);
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

        return SuperMagicAgentAssembler::createDTO($entity);
    }

    /**
     * 获取 Agent 详情.
     */
    public function show(string $code): array
    {
        $authorization = $this->getAuthorization();
        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($authorization);

        $withToolSchema = (bool) $this->request->input('with_tool_schema', false);

        // 调用应用服务层处理业务逻辑
        $result = $this->superMagicAgentAppService->show($authorization, $code, $withToolSchema);
        $agent = $result['agent'];

        // 如果项目ID为空，则创建并绑定项目
        // 历史数据是没有项目的，需要在这里创建
        if (empty($agent->getProjectId())) {
            $projectInfo = $this->createAndBindProject($authorization, $requestContext, $agent->getName(), $code);
            $agent->setProjectId((int) ($projectInfo['project']['id'] ?? 0));
        }

        $responseDTO = SuperMagicAgentAssembler::createDetailResponseDTO(
            $agent,
            $result['skills'],
            $result['is_store_offline']
        );

        // 返回数组格式
        return $responseDTO->toArray();
    }

    /**
     * 查询员工列表.
     */
    public function queries(): array
    {
        $authorization = $this->getAuthorization();

        // 从请求创建DTO
        $requestDTO = QueryAgentsRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $responseDTO = $this->superMagicAgentAppService->queries($authorization, $requestDTO);

        // 返回数组格式
        return $responseDTO->toArray();
    }

    /**
     * 更新员工绑定的技能列表（全量更新）.
     */
    public function updateAgentSkills(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 从请求中读取 skill_codes 参数
        $skillCodes = $this->request->input('skill_codes', []);

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentAppService->updateAgentSkills($authorization, $code, $skillCodes);

        // 返回空数组
        return [];
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

    /**
     * 发布员工到商店（创建待审核版本）.
     */
    public function publishAgent(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 调用应用服务层处理业务逻辑
        $versionEntity = $this->superMagicAgentAppService->publishAgent($authorization, $code);

        // 返回版本ID
        return ['version_id' => (string) $versionEntity->getId()];
    }

    /**
     * 绑定项目.
     */
    public function bindProject(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 从请求中读取 project_id 参数
        $projectId = $this->request->input('project_id');
        if (empty($projectId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'common.parameter_required', ['label' => 'project_id']);
        }

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentAppService->bindProject($authorization, $code, (int) $projectId);

        // 返回空数组
        return [];
    }

    /**
     * 创建并绑定项目（带重试机制）.
     *
     * @param Authenticatable $authorization 授权对象
     * @param RequestContext $requestContext 请求上下文
     * @param string $projectName 项目名称
     * @param string $agentCode Agent编码
     * @return array 项目信息数组，包含 project 和 topic
     */
    private function createAndBindProject(Authenticatable $authorization, RequestContext $requestContext, string $projectName, string $agentCode): array
    {
        return retry(3, function () use ($authorization, $requestContext, $projectName, $agentCode) {
            // 创建项目请求DTO
            $projectRequestDTO = new CreateAgentProjectRequestDTO();
            $projectRequestDTO->setProjectName($projectName);

            // 创建项目
            $projectResult = $this->projectAppService->createAgentProject($requestContext, $projectRequestDTO);

            $projectId = (int) ($projectResult['project']['id'] ?? 0);
            if ($projectId <= 0) {
                throw new RuntimeException('Failed to create project: project ID is invalid');
            }

            // 绑定项目
            $this->superMagicAgentAppService->bindProject($authorization, $agentCode, $projectId);

            return $projectResult;
        }, 1000); // 重试间隔1秒
    }
}
