<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\ErrorCode\AuthenticationErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\KnowledgeBase\DTO\Request\SourceBindingNodesRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseApi extends AbstractKnowledgeBaseApi
{
    public function create()
    {
        $authorization = $this->getAuthorization();
        $payload = $this->request->all();
        $payload['type'] = KnowledgeType::UserKnowledgeBase->value;
        $payload['agent_codes'] = $this->getAgentCodesFromBody();

        return $this->knowledgeBaseAppService->saveRaw($authorization, $payload);
    }

    public function update(string $code)
    {
        $authorization = $this->getAuthorization();
        $payload = $this->request->all();
        $payload['type'] = KnowledgeType::UserKnowledgeBase->value;

        return $this->knowledgeBaseAppService->saveRaw($authorization, $payload, $code);
    }

    public function queries()
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $page = $this->createPage();
        $query = $this->request->all();
        $query['agent_codes'] = $this->getAgentCodesFromBody();

        return $this->knowledgeBaseAppService->queriesRaw($authorization, $query, $page);
    }

    public function sourceBindingNodes(): array
    {
        $authorization = $this->getAuthorization();
        $dto = SourceBindingNodesRequestDTO::fromRequest($this->request);

        return $this->knowledgeBaseAppService->nodes($authorization, [
            'source_type' => $dto->getSourceType(),
            'provider' => $dto->getProvider(),
            'parent_type' => $dto->getParentType(),
            'parent_ref' => $dto->getParentRef(),
            'page' => $dto->getPage(),
            'page_size' => $dto->getPageSize(),
        ]);
    }

    public function show(string $code)
    {
        $userAuthorization = $this->getAuthorization();
        return $this->knowledgeBaseAppService->showRaw($userAuthorization, $code);
    }

    public function destroy(string $code)
    {
        $this->knowledgeBaseAppService->destroy($this->getAuthorization(), $code);
    }

    public function rebuild(): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        if (! OfficialOrganizationUtil::isOfficialOrganization($authorization->getOrganizationCode())) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE);
        }

        return $this->knowledgeBaseAppService->rebuild($authorization, $this->request->all());
    }

    public function repairThirdFileMappings(): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        if (! OfficialOrganizationUtil::isOfficialOrganization($authorization->getOrganizationCode())) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE);
        }

        return $this->knowledgeBaseAppService->repairSourceBindings($authorization, $this->request->all());
    }

    public function rebuildCleanup(): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        if (! OfficialOrganizationUtil::isOfficialOrganization($authorization->getOrganizationCode())) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE);
        }

        return $this->knowledgeBaseAppService->rebuildCleanup($authorization, $this->request->all());
    }

    /**
     * 根据 file_key 获取知识库文件链接.
     */
    public function getFileLink(RequestInterface $request): array
    {
        $fileKey = $request->input('key');
        if (empty($fileKey)) {
            return [];
        }
        // 校验file_key格式，必须以组织/应用id/knowledge-base/开头
        if (! preg_match('/^[a-zA-Z0-9]+\/[0-9]+\/knowledge-base\/.*$/', $fileKey)) {
            ExceptionBuilder::throw(AuthenticationErrorCode::ValidateFailed);
        }

        /**
         * @var MagicUserAuthorization $authorization
         */
        $authorization = $this->getAuthorization();
        $fileLink = $this->fileAppService->getLink($authorization->getOrganizationCode(), $fileKey, StorageBucketType::Private);

        return [
            'url' => $fileLink?->getUrl() ?? '',
            'expires' => $fileLink?->getExpires() ?? 0,
            'name' => $fileLink?->getDownloadName() ?? '',
            'uid' => $fileLink->getPath(),
            'key' => $fileKey,
        ];
    }
}
