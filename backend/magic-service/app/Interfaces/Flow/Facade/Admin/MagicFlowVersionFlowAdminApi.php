<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Facade\Admin;

use App\Application\Flow\Service\MagicFlowVersionAppService;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\Interfaces\Flow\Assembler\FlowVersion\MagicFlowVersionAssembler;
use App\Interfaces\Flow\DTO\FlowVersion\MagicFlowVersionDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MagicFlowVersionFlowAdminApi extends AbstractFlowAdminApi
{
    #[Inject]
    protected MagicFlowVersionAppService $magicFlowVersionAppService;

    /**
     * 版本列表.
     */
    public function queries(string $flowId)
    {
        $query = new MagicFLowVersionQuery($this->request->all());
        $query->setFlowCode($flowId);
        $query->setOrder(['id' => 'desc']);
        $page = $this->createPage();

        $result = $this->magicFlowVersionAppService->queries($this->getAuthorization(), $query, $page);

        return MagicFlowVersionAssembler::createPageListDTO($result['total'], $result['list'], $page, $result['users']);
    }

    /**
     * 版本详情.
     */
    public function show(string $flowId, string $versionId)
    {
        $version = $this->magicFlowVersionAppService->show($this->getAuthorization(), $flowId, $versionId);
        $icons = $this->magicFlowVersionAppService->getIcons($version->getOrganizationCode(), [$version->getMagicFlow()->getIcon()]);
        return MagicFlowVersionAssembler::createMagicFlowVersionDTO($version, $icons);
    }

    /**
     * 发布版本.
     */
    public function publish(string $flowId)
    {
        $authorization = $this->getAuthorization();
        $versionDTO = new MagicFlowVersionDTO($this->request->all());
        $versionDTO->setFlowCode($flowId);

        $versionDO = MagicFlowVersionAssembler::createMagicFlowVersionDO($versionDTO);

        $version = $this->magicFlowVersionAppService->publish($authorization, $versionDO);

        $icons = $this->magicFlowVersionAppService->getIcons($version->getOrganizationCode(), [$version->getMagicFlow()->getIcon()]);
        return MagicFlowVersionAssembler::createMagicFlowVersionDTO($version, $icons);
    }

    /**
     * 回滚版本.
     */
    public function rollback(string $flowId, string $versionId)
    {
        $version = $this->magicFlowVersionAppService->rollback($this->getAuthorization(), $flowId, $versionId);
        $icons = $this->magicFlowVersionAppService->getIcons($version->getOrganizationCode(), [$version->getMagicFlow()->getIcon()]);
        return MagicFlowVersionAssembler::createMagicFlowVersionDTO($version, $icons);
    }
}
