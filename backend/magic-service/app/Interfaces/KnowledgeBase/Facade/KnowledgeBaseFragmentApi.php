<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\KnowledgeBase\Assembler\KnowledgeBaseDocumentAssembler;
use App\Interfaces\KnowledgeBase\Assembler\KnowledgeBaseFragmentAssembler;
use App\Interfaces\KnowledgeBase\DTO\Request\CreateFragmentRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\FragmentPreviewRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\GetFragmentListRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\UpdateFragmentRequestDTO;
use DateTime;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseFragmentApi extends AbstractKnowledgeBaseApi
{
    public function create(string $knowledgeBaseCode, string $documentCode)
    {
        $dto = CreateFragmentRequestDTO::fromRequest($this->request);
        $dto->setKnowledgeBaseCode($knowledgeBaseCode);
        $dto->setDocumentCode($documentCode);
        $userAuthorization = $this->getAuthorization();

        $entity = (new KnowledgeBaseFragmentEntity($dto->toArray()))
            ->setKnowledgeCode($dto->getKnowledgeBaseCode())
            ->setCreatedAt(new DateTime());
        $entity = $this->knowledgeBaseFragmentAppService->save($userAuthorization, $entity);
        return KnowledgeBaseFragmentAssembler::entityToDTO($entity);
    }

    public function update(string $knowledgeBaseCode, string $documentCode, string $id)
    {
        $dto = UpdateFragmentRequestDTO::fromRequest($this->request);
        $dto->setKnowledgeBaseCode($knowledgeBaseCode);
        $dto->setDocumentCode($documentCode);
        $dto->setId($id);
        $userAuthorization = $this->getAuthorization();

        $entity = (new KnowledgeBaseFragmentEntity($dto->toArray()))
            ->setKnowledgeCode($dto->getKnowledgeBaseCode())
            ->setCreatedAt(new DateTime());
        $entity = $this->knowledgeBaseFragmentAppService->save($userAuthorization, $entity);
        return KnowledgeBaseFragmentAssembler::entityToDTO($entity);
    }

    public function queries(string $knowledgeBaseCode, string $documentCode)
    {
        $dto = GetFragmentListRequestDTO::fromRequest($this->request);
        $query = KnowledgeBaseFragmentAssembler::getFragmentListRequestDTOToQuery($dto);
        $query->setKnowledgeCode($knowledgeBaseCode);
        $query->setDocumentCode($documentCode);
        $page = new Page($dto->getPage(), $dto->getPageSize());
        $result = $this->knowledgeBaseFragmentAppService->queries($this->getAuthorization(), $query, $page);
        $list = array_map(function (KnowledgeBaseFragmentEntity $entity) {
            return KnowledgeBaseFragmentAssembler::entityToDTO($entity);
        }, $result['list']);
        return new PageDTO($page->getPage(), $result['total'], $list);
    }

    public function show(string $knowledgeBaseCode, string $documentCode, int $id)
    {
        $entity = $this->knowledgeBaseFragmentAppService->show($this->getAuthorization(), $knowledgeBaseCode, $documentCode, $id);
        return KnowledgeBaseFragmentAssembler::entityToDTO($entity);
    }

    public function destroy(string $knowledgeBaseCode, string $documentCode, int $id)
    {
        $this->knowledgeBaseFragmentAppService->destroy($this->getAuthorization(), $knowledgeBaseCode, $documentCode, $id);
    }

    public function fragmentPreview()
    {
        $dto = FragmentPreviewRequestDTO::fromRequest($this->request);
        $userAuthorization = $this->getAuthorization();

        $documentFile = KnowledgeBaseDocumentAssembler::documentFileDTOToVO($dto->getDocumentFile());
        $result = $this->knowledgeBaseFragmentAppService->fragmentPreview($userAuthorization, $documentFile, $dto->getFragmentConfig());
        $list = array_map(function (KnowledgeBaseFragmentEntity $entity) {
            return KnowledgeBaseFragmentAssembler::entityToDTO($entity);
        }, $result);
        return new PageDTO(1, count($list), $list);
    }

    public function similarity(string $code)
    {
        $query = $this->request->input('query', '');
        $userAuthorization = $this->getAuthorization();
        $list = $this->knowledgeBaseFragmentAppService->similarity($userAuthorization, $code, $query);
        return new PageDTO(1, count($list), $list);
    }
}
