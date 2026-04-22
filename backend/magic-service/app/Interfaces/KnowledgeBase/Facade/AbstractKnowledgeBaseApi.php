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
use App\Infrastructure\Core\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

abstract class AbstractKnowledgeBaseApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        protected KnowledgeBaseAppService $knowledgeBaseAppService,
        protected KnowledgeBaseDocumentAppService $knowledgeBaseDocumentAppService,
        protected KnowledgeBaseFragmentAppService $knowledgeBaseFragmentAppService,
        protected ModelGatewayMapper $modelGatewayMapper,
        protected FileAppService $fileAppService,
        protected KnowledgeBaseStrategyInterface $knowledgeBaseStrategy,
        protected LLMAppService $llmAppService,
        protected EmbeddingProviderPort $embeddingProviderPort,
    ) {
        parent::__construct($request);
    }

    /**
     * @return array<string>
     */
    protected function getAgentCodesFromQuery(): array
    {
        return $this->normalizeAgentCodes($this->request->query('agent_codes', []));
    }

    /**
     * @return array<string>
     */
    protected function getAgentCodesFromBody(): array
    {
        return $this->normalizeAgentCodes($this->request->input('agent_codes', []));
    }

    /**
     * @return array<string>
     */
    private function normalizeAgentCodes(mixed $value): array
    {
        $items = is_array($value) ? $value : [$value];
        $result = [];
        $seen = [];
        array_walk_recursive($items, function (mixed $item) use (&$result, &$seen): void {
            $trimmed = trim((string) $item);
            if ($trimmed === '' || isset($seen[$trimmed])) {
                return;
            }
            $seen[$trimmed] = true;
            $result[] = $trimmed;
        });
        return $result;
    }
}
