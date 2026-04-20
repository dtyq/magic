<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Interfaces\KnowledgeBase\DTO\Request\FragmentPreviewRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseFragmentApi extends AbstractKnowledgeBaseApi
{
    public function create(string $knowledgeBaseCode, string $documentCode)
    {
        $payload = $this->request->all();
        return $this->knowledgeBaseFragmentAppService->saveRaw(
            $this->getAuthorization(),
            $payload,
            $knowledgeBaseCode,
            $documentCode,
        );
    }

    public function update(string $knowledgeBaseCode, string $documentCode, string $id)
    {
        $payload = $this->request->all();
        return $this->knowledgeBaseFragmentAppService->saveRaw(
            $this->getAuthorization(),
            $payload,
            $knowledgeBaseCode,
            $documentCode,
            (int) $id,
        );
    }

    public function queries(string $knowledgeBaseCode, string $documentCode)
    {
        $query = $this->request->all();
        return $this->knowledgeBaseFragmentAppService->queriesRaw(
            $this->getAuthorization(),
            $query,
            $knowledgeBaseCode,
            $documentCode,
            $this->createPage(),
        );
    }

    public function show(string $knowledgeBaseCode, string $documentCode, int $id)
    {
        return $this->knowledgeBaseFragmentAppService->showRaw(
            $this->getAuthorization(),
            $knowledgeBaseCode,
            $documentCode,
            $id,
        );
    }

    public function destroy(string $knowledgeBaseCode, string $documentCode, int $id)
    {
        $this->knowledgeBaseFragmentAppService->destroy(
            $this->getAuthorization(),
            $knowledgeBaseCode,
            $documentCode,
            $id,
        );
    }

    public function fragmentPreview()
    {
        $dto = FragmentPreviewRequestDTO::fromRequest($this->request);
        $userAuthorization = $this->getAuthorization();

        return $this->knowledgeBaseFragmentAppService->fragmentPreviewRaw(
            $userAuthorization,
            $dto->getDocumentFile(),
            $dto->getStrategyConfig(),
            $dto->getFragmentConfig()
        );
    }

    public function similarity(string $code)
    {
        $query = $this->request->input('query', '');
        $debug = (bool) $this->request->input('debug', false);
        return $this->knowledgeBaseFragmentAppService->similarityRaw(
            $this->getAuthorization(),
            $code,
            $query,
            $debug,
        );
    }
}
