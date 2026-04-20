<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseDocumentApi extends AbstractKnowledgeBaseApi
{
    /**
     * 创建文档.
     */
    public function create(string $knowledgeBaseCode)
    {
        $payload = $this->request->all();
        return $this->knowledgeBaseDocumentAppService->saveRaw(
            $this->getAuthorization(),
            $payload,
            $knowledgeBaseCode
        );
    }

    /**
     * 更新文档.
     */
    public function update(string $knowledgeBaseCode, string $code)
    {
        $payload = $this->request->all();
        return $this->knowledgeBaseDocumentAppService->saveRaw(
            $this->getAuthorization(),
            $payload,
            $knowledgeBaseCode,
            $code
        );
    }

    /**
     * 获取文档列表.
     */
    public function queries(string $knowledgeBaseCode)
    {
        $query = $this->request->all();
        return $this->knowledgeBaseDocumentAppService->queryRaw(
            $this->getAuthorization(),
            $query,
            $knowledgeBaseCode,
            $this->createPage()
        );
    }

    /**
     * 获取文档详情.
     */
    public function show(string $knowledgeBaseCode, string $code)
    {
        return $this->knowledgeBaseDocumentAppService->showRaw(
            $this->getAuthorization(),
            $knowledgeBaseCode,
            $code,
        );
    }

    /**
     * 获取文档原始文件访问链接.
     */
    public function originalFileLink(string $knowledgeBaseCode, string $code): array
    {
        return $this->knowledgeBaseDocumentAppService->originalFileLink(
            $this->getAuthorization(),
            $knowledgeBaseCode,
            $code,
        );
    }

    /**
     * 删除文档.
     */
    public function destroy(string $knowledgeBaseCode, string $code)
    {
        $this->knowledgeBaseDocumentAppService->destroy(
            $this->getAuthorization(),
            $knowledgeBaseCode,
            $code,
        );
    }

    /**
     * 重新向量化.
     */
    public function reVectorized(string $knowledgeBaseCode, string $code)
    {
        $payload = $this->request->all();
        $this->knowledgeBaseDocumentAppService->reVectorized(
            $this->getAuthorization(),
            $knowledgeBaseCode,
            $code,
            $payload
        );
    }
}
