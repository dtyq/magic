<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Facade;

use App\Interfaces\Flow\Facade\Open\AbstractOpenApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class KnowledgeBaseOpenApi extends AbstractOpenApi
{
    //    #[Inject]
    //    protected KnowledgeBaseAppService $knowledgeBaseAppService;
    //
    //    #[Inject]
    //    protected KnowledgeBaseFragmentAppService $knowledgeBaseFragmentAppService;
    //
    //    public function save()
    //    {
    //        $authorization = $this->getAuthorization();
    //        $dto = new MagicFlowKnowledgeDTO($this->request->all());
    //
    //        $magicFlowKnowledgeDO = MagicFlowKnowledgeAssembler::creatDO($dto);
    //        $magicFlowKnowledgeEntity = $this->knowledgeBaseAppService->save($authorization, $magicFlowKnowledgeDO);
    //        return MagicFlowKnowledgeAssembler::createDTO($magicFlowKnowledgeEntity);
    //    }
    //
    //    public function saveProcess()
    //    {
    //        $authorization = $this->getAuthorization();
    //        $dto = new MagicFlowKnowledgeDTO($this->request->all());
    //
    //        $magicFlowKnowledgeDO = MagicFlowKnowledgeAssembler::creatDO($dto);
    //        $magicFlowKnowledgeEntity = $this->knowledgeBaseAppService->saveProcess($authorization, $magicFlowKnowledgeDO);
    //        return MagicFlowKnowledgeAssembler::createDTO($magicFlowKnowledgeEntity);
    //    }
    //
    //    public function queries()
    //    {
    //        $authorization = $this->getAuthorization();
    //        $params = $this->request->all();
    //        $query = new KnowledgeBaseQuery($params);
    //        $query->setOrder(['updated_at' => 'desc']);
    //        $query->setTypes(KnowledgeType::openListValue());
    //        $page = $this->createPage();
    //        $result = $this->knowledgeBaseAppService->queries($authorization, $query, $page);
    //        return MagicFlowKnowledgeAssembler::createPageListDTO($result['total'], $result['list'], $page, $result['users']);
    //    }
    //
    //    public function showByBusinessId()
    //    {
    //        $type = $this->request->input('type');
    //        if (! is_null($type)) {
    //            $type = (int) $type;
    //        }
    //        $businessId = (string) $this->request->input('business_id');
    //        $magicFlowKnowledgeEntity = $this->knowledgeBaseAppService->getByBusinessId($this->getAuthorization(), $businessId, $type);
    //        if (! $magicFlowKnowledgeEntity) {
    //            return null;
    //        }
    //        return MagicFlowKnowledgeAssembler::createDTO($magicFlowKnowledgeEntity);
    //    }
    //
    //    public function show(string $id)
    //    {
    //        $magicFlowKnowledgeEntity = $this->knowledgeBaseAppService->show($this->getAuthorization(), $id);
    //        return MagicFlowKnowledgeAssembler::createDTO($magicFlowKnowledgeEntity);
    //    }
    //
    //    public function destroy(string $id)
    //    {
    //        $this->knowledgeBaseAppService->destroy($this->getAuthorization(), $id);
    //    }
    //
    //    public function rebuild(string $id)
    //    {
    //        $this->knowledgeBaseAppService->rebuild($this->getAuthorization(), $id, (bool) $this->request->input('force', false));
    //    }
    //
    //    public function similarity()
    //    {
    //        $authorization = $this->getAuthorization();
    //        $knowledgeSimilarity = new KnowledgeSimilarityFilter($this->request->all());
    //
    //        $result = $this->knowledgeBaseAppService->similarity($authorization, $knowledgeSimilarity);
    //        return MagicFlowKnowledgeFragmentAssembler::createPageListDTO(count($result), $result, new Page(1, count($result)));
    //    }
    //
    //    public function fragmentSave()
    //    {
    //        $authorization = $this->getAuthorization();
    //        $dto = new MagicFlowKnowledgeFragmentDTO($this->request->all());
    //
    //        $DO = MagicFlowKnowledgeFragmentAssembler::createDO($dto);
    //        $entity = $this->knowledgeBaseAppService->fragmentSave($authorization, $DO);
    //        return MagicFlowKnowledgeFragmentAssembler::createDTO($entity);
    //    }
    //
    //    public function fragmentQueries()
    //    {
    //        $authorization = $this->getAuthorization();
    //        $query = new KnowledgeBaseFragmentQuery($this->request->all());
    //
    //        $query->setOrder(['updated_at' => 'desc']);
    //        $page = $this->createPage();
    //        $result = $this->knowledgeBaseFragmentAppService->queries($authorization, $query, $page);
    //        return MagicFlowKnowledgeFragmentAssembler::createPageListDTO($result['total'], $result['list'], $page);
    //    }
    //
    //    public function fragmentShow(string $id)
    //    {
    //        $entity = $this->knowledgeBaseFragmentAppService->fragmentShow($this->getAuthorization(), (int) $id);
    //        return MagicFlowKnowledgeFragmentAssembler::createDTO($entity);
    //    }
    //
    //    public function fragmentDestroyByMetadataFilter()
    //    {
    //        $knowledgeCode = $this->request->input('knowledge_code');
    //        $metadataFilter = $this->request->input('metadata_filter');
    //        $this->knowledgeBaseFragmentAppService->fragmentDestroyByMetadataFilter($this->getAuthorization(), $knowledgeCode, $metadataFilter);
    //    }
    //
    //    public function fragmentDestroy(string $id)
    //    {
    //        $this->knowledgeBaseFragmentAppService->destroy($this->getAuthorization(), (int) $id);
    //    }
}
