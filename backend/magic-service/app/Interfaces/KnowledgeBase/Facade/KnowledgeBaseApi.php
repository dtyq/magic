<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\ErrorCode\AuthenticationErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\KnowledgeBase\Assembler\KnowledgeBaseAssembler;
use App\Interfaces\KnowledgeBase\Assembler\KnowledgeBaseDocumentAssembler;
use App\Interfaces\KnowledgeBase\DTO\Request\CreateKnowledgeBaseRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\UpdateKnowledgeBaseRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseApi extends AbstractKnowledgeBaseApi
{
    public function create()
    {
        $authorization = $this->getAuthorization();
        $dto = CreateKnowledgeBaseRequestDTO::fromRequest($this->request);
        $entity = (new KnowledgeBaseEntity($dto->toArray()))->setType(KnowledgeType::UserKnowledgeBase->value);
        $documentFiles = array_map(fn ($dto) => KnowledgeBaseDocumentAssembler::documentFileDTOToVO($dto), $dto->getDocumentFiles());
        $entity = $this->knowledgeBaseAppService->save($authorization, $entity, $documentFiles);
        return KnowledgeBaseAssembler::entityToDTO($entity);
    }

    public function update(string $code)
    {
        $authorization = $this->getAuthorization();
        $dto = UpdateKnowledgeBaseRequestDTO::fromRequest($this->request);
        $dto->setCode($code);

        $entity = (new KnowledgeBaseEntity($dto->toArray()))->setType(KnowledgeType::UserKnowledgeBase->value);
        $entity = $this->knowledgeBaseAppService->save($authorization, $entity);
        return KnowledgeBaseAssembler::entityToDTO($entity);
    }

    public function queries()
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $query = new KnowledgeBaseQuery($this->request->all());
        $query->setOrder(['updated_at' => 'desc']);
        $queryKnowledgeTypes = $this->knowledgeBaseStrategy->getQueryKnowledgeTypes();
        $query->setTypes($queryKnowledgeTypes);
        $page = $this->createPage();

        $result = $this->knowledgeBaseAppService->queries($authorization, $query, $page);
        $codes = array_column($result['list'], 'code');
        // 补充文档数量
        $knowledgeBaseDocumentCountMap = $this->knowledgeBaseDocumentAppService->getDocumentCountByKnowledgeBaseCodes($authorization, $codes);
        $list = KnowledgeBaseAssembler::entitiesToListDTO($result['list'], $result['users'], $knowledgeBaseDocumentCountMap);
        return new PageDTO($page->getPage(), $result['total'], $list);
    }

    public function show(string $code)
    {
        $userAuthorization = $this->getAuthorization();
        $magicFlowKnowledgeEntity = $this->knowledgeBaseAppService->show($userAuthorization, $code);
        // 补充文档数量
        $knowledgeBaseDocumentCountMap = $this->knowledgeBaseDocumentAppService->getDocumentCountByKnowledgeBaseCodes($userAuthorization, [$code]);
        return KnowledgeBaseAssembler::entityToDTO($magicFlowKnowledgeEntity)->setDocumentCount($knowledgeBaseDocumentCountMap[$code] ?? 0);
    }

    public function destroy(string $code)
    {
        $this->knowledgeBaseAppService->destroy($this->getAuthorization(), $code);
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
