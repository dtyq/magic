<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Facade\Admin;

use App\Application\Flow\Service\MagicFlowDraftAppService;
use App\Domain\Flow\Entity\MagicFlowDraftEntity;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowDraftQuery;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\Assembler\FlowDraft\MagicFlowDraftAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MagicFlowDraftFlowAdminApi extends AbstractFlowAdminApi
{
    #[Inject]
    protected MagicFlowDraftAppService $magicFlowDraftAppService;

    /**
     * 保存草稿.
     */
    public function save(string $flowId)
    {
        $authorization = $this->getAuthorization();
        $magicFlowDraftDTO = MagicFlowDraftAssembler::createFlowDraftDTOByMixed($this->request->all());
        $magicFlowDraftDTO->setFlowCode($flowId);

        $magicFlowDraftDO = MagicFlowDraftAssembler::createMagicFlowDraftDO($magicFlowDraftDTO);

        $magicFlowDraft = $this->magicFlowDraftAppService->save($authorization, $magicFlowDraftDO);
        $icons = $this->magicFlowDraftAppService->getIcons($magicFlowDraft->getOrganizationCode(), [$magicFlowDraft->getMagicFlow()['icon'] ?? '']);
        return MagicFlowDraftAssembler::createMagicFlowDraftDTO($magicFlowDraft, [], $icons);
    }

    /**
     * 查询草稿列表.
     */
    public function queries(string $flowId)
    {
        $authorization = $this->getAuthorization();
        $query = new MagicFLowDraftQuery($this->request->all());

        // 仅查询最新的记录
        $page = new Page(1, MagicFlowDraftEntity::MAX_RECORD);
        $query->setOrder(['id' => 'desc']);
        $query->flowCode = $flowId;

        $result = $this->magicFlowDraftAppService->queries($authorization, $query, $page);

        return MagicFlowDraftAssembler::createPageListDTO($result['total'], $result['list'], $page, $result['users']);
    }

    /**
     * 查询草稿详情.
     */
    public function show(string $flowId, string $draftId)
    {
        $magicFlowDraft = $this->magicFlowDraftAppService->show($this->getAuthorization(), $flowId, $draftId);
        $icons = $this->magicFlowDraftAppService->getIcons($magicFlowDraft->getOrganizationCode(), [$magicFlowDraft->getMagicFlow()['icon'] ?? '']);
        return MagicFlowDraftAssembler::createMagicFlowDraftDTO($magicFlowDraft, [], $icons);
    }

    /**
     * 删除草稿.
     */
    public function remove(string $flowId, string $draftId)
    {
        $this->magicFlowDraftAppService->remove($this->getAuthorization(), $flowId, $draftId);
    }
}
