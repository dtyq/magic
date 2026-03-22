<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade\Sandbox;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Skill\Service\SkillAppService;
use Dtyq\SuperMagic\Application\Skill\Service\SkillMarketAppService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;
use Dtyq\SuperMagic\Interfaces\Skill\Assembler\SkillAssembler;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\GetLatestPublishedSkillVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\GetSkillFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\FormRequest\SkillQueryFormRequest;
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
            $result['creatorSkillCodes'],
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

        $result = $this->userSkillAppService->queries($requestContext, $query, $page);

        return SkillAssembler::createListResponseDTO(
            $result['list'],
            $page->getPage(),
            $page->getPageNum(),
            $result['total']
        );
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
}
