<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\Facade\Sandbox;

use App\Application\SuperMagic\Skill\Service\SkillAppService;
use App\Application\SuperMagic\Skill\Service\SkillMarketAppService;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillListScope;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillSourceType;
use App\ErrorCode\SkillErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Skill\Assembler\SkillAssembler;
use App\Interfaces\SuperMagic\Skill\DTO\Request\CreateSkillDraftRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\GetLatestPublishedSkillVersionsRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\GetSkillFileUrlsRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\PrepareSkillPublishRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillVersionsRequestDTO;
use App\Interfaces\SuperMagic\Skill\FormRequest\SkillQueryFormRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class SkillSandboxApi extends AbstractSuperMagicSandboxApi
{
    #[Inject]
    protected SkillAppService $userSkillAppService;

    #[Inject]
    protected SkillMarketAppService $skillMarketAppService;

    /**
     * 获取市场技能库列表.
     *
     * @param RequestContext $requestContext 请求上下文
     */
    public function queriesMarket(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        $result = $this->skillMarketAppService->queries($requestContext, $query, $page);

        return SkillAssembler::createMarketListResponseDTO(
            $result['list'],
            $result['userSkills'],
            $result['publisherUserMap'],
            $this->getAuthorization()->getId(),
            $page->getPage(),
            $page->getPageNum(),
            $result['total'],
            $result['skillVersionMap'] ?? []
        );
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

        $result = $this->userSkillAppService->queriesByScope($requestContext, $query, $page, SkillListScope::from($requestData['scope'] ?? 'all'));

        return SkillAssembler::createListResponseDTO(
            skillEntities: $result['list'],
            page: $page->getPage(),
            pageSize: $page->getPageNum(),
            total: $result['total'],
            includeI18n: true,
            creatorUserMap: $result['creator_user_map'] ?? [],
            latestVersionMap: $result['latest_version_map'] ?? [],
            skillOperations: $result['skill_operations'] ?? [],
        );
    }

    public function create(RequestContext $context): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        return $this->userSkillAppService->createDraft($context, CreateSkillDraftRequestDTO::fromRequest($this->request));
    }

    public function detail(RequestContext $context, string $code): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        return $this->userSkillAppService->getSkillDetail($context, $code)->jsonSerialize();
    }

    public function byProject(RequestContext $context, string $projectId): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        if (! ctype_digit($projectId) || (string) (int) $projectId !== $projectId || (int) $projectId <= 0) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND);
        }
        return $this->userSkillAppService->getSkillByProject($context, (int) $projectId)->jsonSerialize();
    }

    public function prefill(RequestContext $context, string $code): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        return $this->userSkillAppService->getPublishPrefill($context, $code)->toArray();
    }

    public function prepare(RequestContext $context, string $code): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        return $this->preparationResponse($this->userSkillAppService->prepareSkillPublish($context, $code, PrepareSkillPublishRequestDTO::fromRequest($this->request)));
    }

    public function checkPreparation(RequestContext $context, string $code): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        return $this->preparationResponse($this->userSkillAppService->checkSkillPreparation($context, $code, $this->preparationToken()));
    }

    public function publish(RequestContext $context, string $code): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        return $this->userSkillAppService->publishSkillPreparation($context, $code, $this->preparationToken());
    }

    public function checkPublish(RequestContext $context, string $code): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        return $this->userSkillAppService->getPreparedSkillPublishResult($context, $code, $this->preparationToken());
    }

    public function versions(RequestContext $context, string $code): array
    {
        $context->setUserAuthorization($this->getAuthorization());
        $result = $this->userSkillAppService->queryVersions($context, $code, QuerySkillVersionsRequestDTO::fromRequest($this->request));
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
            true
        );
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

        // Parse optional i18n overrides from request (JSON strings)
        $nameI18n = null;
        $descriptionI18n = null;
        $nameI18nRaw = $this->request->input('name_i18n');
        $descriptionI18nRaw = $this->request->input('description_i18n');
        if (is_string($nameI18nRaw) && $nameI18nRaw !== '') {
            $decoded = json_decode($nameI18nRaw, true);
            if (is_array($decoded)) {
                $nameI18n = $decoded;
            }
        }
        if (is_string($descriptionI18nRaw) && $descriptionI18nRaw !== '') {
            $decoded = json_decode($descriptionI18nRaw, true);
            if (is_array($decoded)) {
                $descriptionI18n = $decoded;
            }
        }

        // 调用应用服务层处理业务逻辑
        return $this->userSkillAppService->importSkillFromAgent($requestContext, $tempFile, $skillSource, $nameI18n, $descriptionI18n);
    }

    private function preparationToken(): string
    {
        $token = $this->request->input('prepare_token');
        if (! is_string($token) || preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) {
            ExceptionBuilder::throw(SkillErrorCode::PUBLISH_PREPARATION_STALE);
        }
        return $token;
    }

    private function preparationResponse(array $record): array
    {
        return array_intersect_key($record, array_flip([
            'prepare_token', 'publish_task_id', 'status', 'skill_code', 'project_id', 'name', 'description',
            'version', 'publish_target_type', 'current_publish_target_type', 'skill_dir', 'manifest',
            'package_sha256', 'expires_at',
        ]));
    }
}
