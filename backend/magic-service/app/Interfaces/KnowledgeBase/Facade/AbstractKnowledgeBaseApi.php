<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Application\File\Service\FileAppService;
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
    ) {
        parent::__construct($request);
    }
}
