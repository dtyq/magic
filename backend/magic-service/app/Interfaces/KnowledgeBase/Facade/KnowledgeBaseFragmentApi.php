<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Application\File\Service\FileAppService;
use App\Application\KnowledgeBase\Port\EmbeddingProviderPort;
use App\Application\KnowledgeBase\Service\KnowledgeBaseAppService;
use App\Application\KnowledgeBase\Service\KnowledgeBaseDocumentAppService;
use App\Application\KnowledgeBase\Service\KnowledgeBaseFragmentAppService;
use App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase\KnowledgeBaseStrategyInterface;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Infrastructure\Util\Http\RpcHttpPassthroughResponseFactory;
use App\Interfaces\KnowledgeBase\DTO\Request\FragmentPreviewRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Psr\Http\Message\ResponseInterface;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseFragmentApi extends AbstractKnowledgeBaseApi
{
    private readonly RpcHttpPassthroughResponseFactory $passthroughResponseFactory;

    public function __construct(
        RequestInterface $request,
        KnowledgeBaseAppService $knowledgeBaseAppService,
        KnowledgeBaseDocumentAppService $knowledgeBaseDocumentAppService,
        KnowledgeBaseFragmentAppService $knowledgeBaseFragmentAppService,
        ModelGatewayMapper $modelGatewayMapper,
        FileAppService $fileAppService,
        KnowledgeBaseStrategyInterface $knowledgeBaseStrategy,
        LLMAppService $llmAppService,
        EmbeddingProviderPort $embeddingProviderPort,
        RpcHttpPassthroughResponseFactory $passthroughResponseFactory,
    ) {
        parent::__construct(
            $request,
            $knowledgeBaseAppService,
            $knowledgeBaseDocumentAppService,
            $knowledgeBaseFragmentAppService,
            $modelGatewayMapper,
            $fileAppService,
            $knowledgeBaseStrategy,
            $llmAppService,
            $embeddingProviderPort,
        );
        $this->passthroughResponseFactory = $passthroughResponseFactory;
    }

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

    public function queries(string $knowledgeBaseCode, string $documentCode): ResponseInterface
    {
        $query = $this->request->all();
        $result = $this->knowledgeBaseFragmentAppService->queriesHttpPassthroughRaw(
            $this->getAuthorization(),
            $query,
            $knowledgeBaseCode,
            $documentCode,
            $this->request->getHeaderLine('Accept-Encoding'),
        );

        return $this->passthroughResponseFactory->fromResult($result);
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

    public function fragmentPreview(): ResponseInterface
    {
        $dto = FragmentPreviewRequestDTO::fromRequest($this->request);
        $userAuthorization = $this->getAuthorization();

        $result = $this->knowledgeBaseFragmentAppService->fragmentPreviewHttpPassthroughRaw(
            $userAuthorization,
            $dto->getDocumentFile(),
            $dto->getStrategyConfig(),
            $dto->getFragmentConfig(),
            $this->request->getHeaderLine('Accept-Encoding'),
            $dto->getDocumentCode(),
        );

        return $this->passthroughResponseFactory->fromResult($result);
    }

    public function similarity(string $code): ResponseInterface
    {
        $query = $this->request->input('query', '');
        $debug = $this->request->input('debug', false);
        $result = $this->knowledgeBaseFragmentAppService->similarityHttpPassthroughRaw(
            $this->getAuthorization(),
            $code,
            $query,
            $this->request->getHeaderLine('Accept-Encoding'),
            $debug,
        );

        return $this->passthroughResponseFactory->fromResult($result);
    }
}
