<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\Facade;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Skill\Service\SkillAppService;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;
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
            $result['total']
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
     * Publish a skill version.
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

        $publisherUserIds = [];
        foreach ($result['list'] as $versionEntity) {
            $publisherUserId = $versionEntity->getPublisherUserId();
            if (! empty($publisherUserId)) {
                $publisherUserIds[] = $publisherUserId;
            }
        }

        return SkillAssembler::createQuerySkillVersionsResponseDTO(
            $result['list'],
            $this->userSkillAppService->getUsers($this->getAuthorization()->getOrganizationCode(), $publisherUserIds),
            $result['page'],
            $result['page_size'],
            $result['total']
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
     * Agent 第三方导入技能（一步完成：上传、校验、解压、上传到私有桶、创建或更新）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 导入结果，包含 id 和 skill_code
     */
    public function importSkillFromAgent(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $uploadedFile = $this->request->file('file');
        $source = (string) $this->request->input('source', '');
        if (! $uploadedFile) {
            ExceptionBuilder::throw(SkillErrorCode::FILE_UPLOAD_FAILED, 'skill.file_upload_failed');
        }
        // 保存到临时文件
        $tempFile = sys_get_temp_dir() . '/' . uniqid('skill_import_', true) . '.' . $uploadedFile->getExtension();
        $uploadedFile->moveTo($tempFile);

        $skillSource = SkillSourceType::tryFrom($source);
        if (! $skillSource) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_SOURCE_TYPE_ERROR);
        }

        // 调用应用服务层处理业务逻辑
        return $this->userSkillAppService->importSkillFromAgent($requestContext, $tempFile, $skillSource);
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
