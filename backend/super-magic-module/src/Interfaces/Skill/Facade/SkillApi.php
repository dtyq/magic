<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Skill\Service\SkillAppService;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Interfaces\Skill\Assembler\SkillAssembler;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\AddSkillFromStoreRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\GetLatestPublishedSkillVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\GetSkillFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ImportSkillRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ParseFileImportRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\PublishSkillRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\UpdateSkillInfoRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillDetailResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\FormRequest\SkillQueryFormRequest;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;
use RuntimeException;

use function Hyperf\Support\retry;

#[ApiResponse('low_code')]
class SkillApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected SkillAppService $userSkillAppService,
        private readonly ProjectAppService $projectAppService,
    ) {
        parent::__construct($request);
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

        $result = $this->userSkillAppService->queries($requestContext, $query, $page);

        return SkillAssembler::createListResponseDTO(
            $result['list'],
            $page->getPage(),
            $page->getPageNum(),
            $result['total'],
            $result['creatorUserMap'] ?? [],
            $result['latestVersionMap'] ?? []
        );
    }

    /**
     * 查询我创建的技能列表.
     */
    public function queriesCreated(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        $result = $this->userSkillAppService->queriesCreated($requestContext, $query, $page);

        return SkillAssembler::createListResponseDTO(
            $result['list'],
            $page->getPage(),
            $page->getPageNum(),
            $result['total'],
            $result['creatorUserMap'] ?? [],
            $result['latestVersionMap'] ?? []
        );
    }

    /**
     * 查询团队共享的技能列表.
     */
    public function queriesTeamShared(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        $result = $this->userSkillAppService->queriesTeamShared($requestContext, $query, $page);

        return SkillAssembler::createListResponseDTOFromVersions(
            $result['list'],
            $page->getPage(),
            $page->getPageNum(),
            $result['total'],
            null,
            $result['creatorUserMap'] ?? [],
            $result['latestVersionMap'] ?? []
        );
    }

    /**
     * 查询从市场安装的技能列表.
     */
    public function queriesMarketInstalled(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        $result = $this->userSkillAppService->queriesMarketInstalled($requestContext, $query, $page);

        return SkillAssembler::createListResponseDTOFromVersions(
            $result['list'],
            $page->getPage(),
            $page->getPageNum(),
            $result['total'],
            SkillSourceType::MARKET->value,
            $result['creatorUserMap'] ?? [],
            $result['latestVersionMap'] ?? []
        );
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
        if (empty($responseDTO->getProjectId()) && $responseDTO->getSourceType() !== SkillSourceType::MARKET->value) {
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

        $skillVersionEntity = $this->userSkillAppService->publishSkill($requestContext, $code, $requestDTO);

        return SkillAssembler::createPublishVersionResponseDTO($skillVersionEntity)->toArray();
    }

    public function getVersionList(RequestContext $requestContext, string $code): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = QuerySkillVersionsRequestDTO::fromRequest($this->request);
        $result = $this->userSkillAppService->queryVersions($requestContext, $code, $requestDTO);

        return SkillAssembler::createQuerySkillVersionsResponseDTO(
            $result['list'],
            $result['userMap'],
            $result['page'],
            $result['page_size'],
            $result['total'],
            $result['memberDepartmentMap'],
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
        $result = $this->userSkillAppService->getLatestPublishedVersionsByCodes($requestContext, $requestDTO);

        return SkillAssembler::createLatestPublishedVersionsResponseDTO(
            $result['list'],
            $result['page'],
            $result['page_size'],
            $result['total'],
        );
    }

    /**
     * 创建并绑定项目（带重试机制）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $projectName 项目名称
     * @param string $skillCode Skill编码
     * @return array 项目信息数组，包含 project 和 topic
     */
    private function createAndBindProject(RequestContext $requestContext, string $projectName, string $skillCode): array
    {
        return retry(3, function () use ($requestContext, $projectName, $skillCode) {
            // 创建项目请求DTO
            $projectRequestDTO = new CreateAgentProjectRequestDTO();
            $projectRequestDTO->setProjectName($projectName);
            $projectRequestDTO->setInitTemplateFiles(false);

            // 创建项目
            $projectResult = $this->projectAppService->createAgentProject($requestContext, $projectRequestDTO, ProjectMode::CUSTOM_SKILL);

            $projectId = (int) ($projectResult['project']['id'] ?? 0);
            if ($projectId <= 0) {
                throw new RuntimeException('Failed to create project: project ID is invalid');
            }

            // 绑定项目
            $this->userSkillAppService->bindProject($requestContext, $skillCode, $projectId);

            return $projectResult;
        }, 1000); // 重试间隔1秒
    }
}
