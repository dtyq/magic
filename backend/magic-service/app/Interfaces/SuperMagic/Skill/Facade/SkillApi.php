<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\Facade;

use App\Application\SuperMagic\Common\Transfer\ResourceTransferAppService;
use App\Application\SuperMagic\Skill\Service\SkillAppService;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillListScope;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillSourceType;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\DTO\Request\TransferResourceRequestDTO;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\Skill\Assembler\SkillAssembler;
use App\Interfaces\SuperMagic\Skill\DTO\Request\AddSkillFromStoreRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\GetLatestPublishedSkillVersionsRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\GetSkillFileUrlsRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ImportSkillRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ParseFileImportRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\PublishSkillRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillVersionsRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillInfoRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillDetailResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillListResponseDTO;
use App\Interfaces\SuperMagic\Skill\FormRequest\SkillQueryFormRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class SkillApi extends AbstractApi
{
    #[Inject]
    protected ResourceTransferAppService $resourceTransferAppService;

    public function __construct(
        protected RequestInterface $request,
        protected SkillAppService $userSkillAppService,
    ) {
        parent::__construct($request);
    }

    public function transfer(string $code): array
    {
        return $this->resourceTransferAppService->transfer(
            $this->getAuthorization(),
            $code,
            false,
            TransferResourceRequestDTO::fromRequest($this->request)
        );
    }

    /**
     * 导入第一阶段：上传文件并解析.
     *
     * @param RequestContext $requestContext 请求上下文
     */
    public function parseFileImport(RequestContext $requestContext)
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = ParseFileImportRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        return $this->userSkillAppService->parseFileImport($requestContext, $requestDTO);
    }

    /**
     * 导入第二阶段：确认信息正式落库.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 导入结果，包含 id 和 skill_code
     */
    public function importSkill(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = ImportSkillRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $skillEntity = $this->userSkillAppService->importSkill($requestContext, $requestDTO);

        // 转换为数组返回
        return [
            'id' => (string) $skillEntity->getId(),
            'skill_code' => $skillEntity->getCode(),
            'name_i18n' => $skillEntity->getNameI18n(),
            'description_i18n' => $skillEntity->getDescriptionI18n(),
            'created_at' => $skillEntity->getCreatedAt(),
            'updated_at' => $skillEntity->getUpdatedAt(),
        ];
    }

    /**
     * 从技能市场添加技能.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 空数组
     */
    public function addSkillFromStore(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = AddSkillFromStoreRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $this->userSkillAppService->addSkillFromStore($requestContext, $requestDTO);

        return [];
    }

    /**
     * 从 Agent 创建空技能.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 创建结果，包含 id 和 skill_code
     */
    public function create(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $skillEntity = $this->userSkillAppService->create($requestContext);

        // 如果项目ID为空，则创建并绑定项目（兼容历史数据）
        if (empty($skillEntity->getProjectId())) {
            $projectInfo = $this->createAndBindProject($requestContext, $skillEntity->getPackageName(), $skillEntity->getCode());
            $skillEntity->setProjectId((int) ($projectInfo['project']['id'] ?? 0));
        }

        return [
            'id' => (string) $skillEntity->getId(),
            'skill_code' => $skillEntity->getCode(),
            'project_id' => (string) $skillEntity->getProjectId(),
        ];
    }

    /**
     * 查询用户技能列表.
     *
     * @param RequestContext $requestContext 请求上下文
     */
    public function queries(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        $scope = SkillListScope::from($requestData['scope'] ?? SkillListScope::ALL->value);
        if ($scope === SkillListScope::MARKET_INSTALLED) {
            return $this->createMarketInstalledListResponse($requestContext, $query, $page);
        }

        $result = $this->userSkillAppService->queriesByScope($requestContext, $query, $page, $scope);

        return SkillAssembler::createListResponseDTO(
            skillEntities: $result['list'],
            page: $page->getPage(),
            pageSize: $page->getPageNum(),
            total: $result['total'],
            creatorUserMap: $result['creator_user_map'] ?? [],
            latestVersionMap: $result['latest_version_map'] ?? [],
            skillOperations: $result['skill_operations'] ?? []
        );
    }

    /**
     * 查询我创建的技能列表.
     *
     * @deprecated 使用 POST /api/v1/skills/queries 并传入 scope=created
     */
    public function queriesCreated(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        $result = $this->userSkillAppService->queriesCreated($requestContext, $query, $page);

        return SkillAssembler::createListResponseDTO(
            skillEntities: $result['list'],
            page: $page->getPage(),
            pageSize: $page->getPageNum(),
            total: $result['total'],
            creatorUserMap: $result['creator_user_map'] ?? [],
            latestVersionMap: $result['latest_version_map'] ?? [],
            skillOperations: $result['skill_operations'] ?? []
        );
    }

    /**
     * 查询团队共享的技能列表.
     *
     * @deprecated 使用 POST /api/v1/skills/queries 并传入 scope=team_shared
     */
    public function queriesTeamShared(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        $result = $this->userSkillAppService->queriesTeamShared($requestContext, $query, $page);

        return SkillAssembler::createListResponseDTO(
            skillEntities: $result['list'],
            page: $page->getPage(),
            pageSize: $page->getPageNum(),
            total: $result['total'],
            creatorUserMap: $result['creator_user_map'] ?? [],
            latestVersionMap: $result['latest_version_map'] ?? [],
            skillOperations: $result['skill_operations'] ?? []
        );
    }

    /**
     * 查询从市场安装的技能列表.
     *
     * @deprecated 使用 POST /api/v1/skills/queries 并传入 scope=market_installed
     */
    public function queriesMarketInstalled(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        return $this->createMarketInstalledListResponse($requestContext, $query, $page);
    }

    /**
     * 删除用户技能（支持所有来源类型）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     * @return array 空数组
     */
    public function deleteSkill(RequestContext $requestContext, string $code): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 调用应用服务层处理业务逻辑
        $this->userSkillAppService->deleteSkill($requestContext, $code);

        // 返回空数组
        return [];
    }

    /**
     * 更新技能基本信息（仅允许更新非商店来源的技能）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     * @return array 空数组
     */
    public function updateSkillInfo(RequestContext $requestContext, string $code): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = UpdateSkillInfoRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $this->userSkillAppService->updateSkillInfo($requestContext, $code, $requestDTO);

        // 返回空数组
        return [];
    }

    /**
     * 获取用户技能详情.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     * @return SkillDetailResponseDTO 技能详情响应 DTO
     */
    public function getSkillDetail(RequestContext $requestContext, string $code)
    {
        $authorization = $this->getAuthorization();

        // 设置用户授权信息
        $requestContext->setUserAuthorization($authorization);

        // 调用应用服务层处理业务逻辑
        $responseDTO = $this->userSkillAppService->getSkillDetail($requestContext, $code);

        // 如果项目ID为空，则创建并绑定项目（兼容历史数据）
        if (empty($responseDTO->getProjectId()) && $requestContext->getUserAuthorization()->getId() === ($responseDTO->getCreatorInfo()?->getId() ?? null)) {
            $projectInfo = $this->createAndBindProject($requestContext, $responseDTO->getPackageName(), $code);
            $responseDTO->setProjectId((int) ($projectInfo['project']['id'] ?? 0));
        }

        return $responseDTO;
    }

    /**
     * 获取发布表单的预填数据（与 POST publish 请求体字段一致，便于一键发布）.
     */
    public function getPublishPrefill(RequestContext $requestContext, string $code): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->userSkillAppService->getPublishPrefill($requestContext, $code)->toArray();
    }

    /**
     * 发布 Skill 版本。
     *
     * 发布规则：
     * - `PRIVATE`：仅创建者自己可见
     * - `MEMBER`：仅创建者 + 指定成员/部门可见，必须传 `publish_target_value`
     * - `ORGANIZATION`：组织内全员可见
     * - `MARKET`：仅新增市场分发能力，不清理当前组织内可见范围
     *
     * 切换规则：
     * - `PRIVATE / MEMBER / ORGANIZATION` 互相覆盖，后一次发布会替换当前组织内范围
     */
    public function publishSkill(RequestContext $requestContext, string $code)
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = PublishSkillRequestDTO::fromRequest($this->request);

        $publishResult = $this->userSkillAppService->publishSkill($requestContext, $code, $requestDTO);

        $response = SkillAssembler::createPublishVersionResponseDTO($publishResult->version)->toArray();
        $response['sandbox_id'] = $publishResult->sandboxId;

        return $response;
    }

    /** 创建异步发布任务。 */
    public function publishSkillAsync(RequestContext $requestContext, string $code): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->userSkillAppService->createAsyncPublishSkill(
            $requestContext,
            $code,
            PublishSkillRequestDTO::fromRequest($this->request)
        );
    }

    /** 查询异步发布任务。 */
    public function checkPublishAsync(RequestContext $requestContext, string $code): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $taskId = (string) $this->request->input('publish_task_id', $this->request->input('task_id', ''));
        return $this->userSkillAppService->checkAsyncPublishSkill($requestContext, $code, $taskId);
    }

    public function getVersionList(RequestContext $requestContext, string $code): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = QuerySkillVersionsRequestDTO::fromRequest($this->request);
        $result = $this->userSkillAppService->queryVersions($requestContext, $code, $requestDTO);

        return SkillAssembler::createQuerySkillVersionsResponseDTO(
            versions: $result['list'],
            userMap: $result['user_map'] ?? [],
            page: $result['page'],
            pageSize: $result['page_size'],
            total: $result['total'],
            memberDepartmentMap: $result['member_department_map'] ?? [],
            categoryMap: $result['category_map'] ?? [],
        )->toArray();
    }

    /**
     * 下架技能版本.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     * @return array 空数组
     */
    public function offlineSkill(RequestContext $requestContext, string $code): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 调用应用服务层处理业务逻辑
        $this->userSkillAppService->offlineSkill($requestContext, $code);

        // 返回空数组
        return [];
    }

    /**
     * Batch get skill file keys and download URLs by skill IDs.
     * Only returns skills owned by the current user.
     *
     * @param RequestContext $requestContext Request context
     * @return array List of skill file URL items
     */
    public function getSkillFileUrls(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = GetSkillFileUrlsRequestDTO::fromRequest($this->request);

        return $this->userSkillAppService->getSkillFileUrlsByIds($requestContext, $requestDTO);
    }

    /**
     * Batch query latest published current skill versions by codes.
     */
    public function queryLatestPublishedVersions(RequestContext $requestContext)
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = GetLatestPublishedSkillVersionsRequestDTO::fromRequest($this->request);
        $result = $this->userSkillAppService->getLatestPublishedSkillVersions($requestContext, $requestDTO);

        return SkillAssembler::createLatestPublishedVersionsResponseDTO(
            $result['list'],
            $result['page'],
            $result['page_size'],
            $result['total'],
        );
    }

    private function createMarketInstalledListResponse(
        RequestContext $requestContext,
        SkillQuery $query,
        Page $page
    ): SkillListResponseDTO {
        $result = $this->userSkillAppService->queriesMarketInstalled($requestContext, $query, $page);

        return SkillAssembler::createListResponseDTOFromVersions(
            skillVersionEntities: $result['list'],
            page: $page->getPage(),
            pageSize: $page->getPageNum(),
            total: $result['total'],
            sourceType: SkillSourceType::MARKET->value,
            creatorUserMap: $result['creator_user_map'] ?? [],
            latestVersionMap: $result['latest_version_map'] ?? [],
            marketEntityMap: $result['market_entity_map'] ?? [],
            publisherUserMap: $result['publisher_user_map'] ?? []
        );
    }

    /**
     * 复用幂等的项目创建与绑定用例.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $projectName 项目名称
     * @param string $skillCode Skill编码
     * @return array 项目信息数组，包含 project 和 topic
     */
    private function createAndBindProject(RequestContext $requestContext, string $projectName, string $skillCode): array
    {
        return $this->userSkillAppService->createAndBindProject($requestContext, $projectName, $skillCode);
    }
}
