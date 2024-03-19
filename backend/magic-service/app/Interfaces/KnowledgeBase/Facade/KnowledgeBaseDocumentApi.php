<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Domain\Flow\Entity\ValueObject\Query\KnowledgeBaseDocumentQuery;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\KnowledgeBase\Assembler\KnowledgeBaseDocumentAssembler;
use App\Interfaces\KnowledgeBase\DTO\Request\CreateDocumentRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\DocumentQueryRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\UpdateDocumentRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseDocumentApi extends AbstractKnowledgeBaseApi
{
    /**
     * 创建文档.
     */
    public function create(string $knowledgeBaseCode)
    {
        $dto = CreateDocumentRequestDTO::fromRequest($this->request);
        $dto->setKnowledgeBaseCode($knowledgeBaseCode);
        $userAuthorization = $this->getAuthorization();

        $entity = KnowledgeBaseDocumentAssembler::createDTOToEntity($dto, $userAuthorization);
        $entity = $this->knowledgeBaseDocumentAppService->save($userAuthorization, $entity);
        return KnowledgeBaseDocumentAssembler::entityToDTO($entity)->toArray();
    }

    /**
     * 更新文档.
     */
    public function update(string $knowledgeBaseCode, string $code)
    {
        $dto = UpdateDocumentRequestDTO::fromRequest($this->request);
        $dto->setKnowledgeBaseCode($knowledgeBaseCode);
        $dto->setCode($code);
        $userAuthorization = $this->getAuthorization();

        $entity = KnowledgeBaseDocumentAssembler::updateDTOToEntity($dto, $userAuthorization);
        $entity = $this->knowledgeBaseDocumentAppService->save($userAuthorization, $entity);
        return KnowledgeBaseDocumentAssembler::entityToDTO($entity)->toArray();
    }

    /**
     * 获取文档列表.
     */
    public function queries(string $knowledgeBaseCode)
    {
        $dto = DocumentQueryRequestDTO::fromRequest($this->request);
        $query = new KnowledgeBaseDocumentQuery($this->request->all());

        // 设置查询条件
        $query->setOrder(['updated_at' => 'desc']);
        $query->setKnowledgeBaseCode($knowledgeBaseCode);
        $query->setDocType($dto->getDocType());
        $query->setSyncStatus($dto->getSyncStatus());

        $page = new Page($dto->getPage(), $dto->getPageSize());
        $result = $this->knowledgeBaseDocumentAppService->query($this->getAuthorization(), $query, $page);

        return new PageDTO(
            $page->getPage(),
            $result['total'],
            array_map(fn ($entity) => KnowledgeBaseDocumentAssembler::entityToDTO($entity)->toArray(), $result['list'])
        );
    }

    /**
     * 获取文档详情.
     */
    public function show(string $knowledgeBaseCode, string $code)
    {
        $entity = $this->knowledgeBaseDocumentAppService->show($this->getAuthorization(), $knowledgeBaseCode, $code);
        return KnowledgeBaseDocumentAssembler::entityToDTO($entity)->toArray();
    }

    /**
     * 删除文档.
     */
    public function destroy(string $knowledgeBaseCode, string $code)
    {
        $this->knowledgeBaseDocumentAppService->destroy($this->getAuthorization(), $knowledgeBaseCode, $code);
    }

    /**
     * 重新向量化.
     */
    public function reVectorized(string $knowledgeBaseCode, string $code)
    {
        $this->knowledgeBaseDocumentAppService->reVectorized($this->getAuthorization(), $knowledgeBaseCode, $code);
    }
}
