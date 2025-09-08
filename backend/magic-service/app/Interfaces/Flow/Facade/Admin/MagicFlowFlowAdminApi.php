<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Facade\Admin;

use App\Application\Flow\Service\MagicFlowAppService;
use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Application\MCP\Service\MCPServerAppService;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowQuery;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\Assembler\Flow\MagicFlowAssembler;
use App\Interfaces\Flow\Assembler\Knowledge\MagicFlowKnowledgeAssembler;
use App\Interfaces\Flow\Assembler\Node\MagicFlowNodeAssembler;
use App\Interfaces\Flow\Assembler\ToolSet\MagicFlowToolSetAssembler;
use App\Interfaces\MCP\Assembler\MCPServerAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MagicFlowFlowAdminApi extends AbstractFlowAdminApi
{
    #[Inject]
    protected MagicFlowAppService $magicFlowAppService;

    #[Inject]
    protected MagicFlowExecuteAppService $magicFlowExecuteAppService;

    #[Inject]
    protected MCPServerAppService $mcpServerAppService;

    /**
     * 获取所有节点的版本.
     */
    public function nodeVersions()
    {
        $this->getAuthorization();
        return [
            'nodes' => $this->magicFlowAppService->nodeVersions(),
        ];
    }

    /**
     * 获取节点配置模板.
     */
    public function nodeTemplate()
    {
        $this->getAuthorization();

        $nodeDTO = MagicFlowNodeAssembler::createNodeDTOByMixed($this->request->all());
        $nodeDO = MagicFlowNodeAssembler::createNodeDO($nodeDTO);

        $node = $this->magicFlowAppService->getNodeTemplate($this->getAuthorization(), $nodeDO);

        return MagicFlowNodeAssembler::createNodeDTO($node);
    }

    /**
     * 节点单点调试.
     */
    public function singleDebugNode()
    {
        $authorization = $this->getAuthorization();
        $nodeDTO = MagicFlowNodeAssembler::createNodeDTOByMixed($this->request->all());
        $nodeDO = MagicFlowNodeAssembler::createNodeDO($nodeDTO);
        return $this->magicFlowAppService->singleDebugNode(
            $authorization,
            $nodeDO,
            (array) $this->request->input('node_contexts', []),
            (array) $this->request->input('trigger_config', [])
        )?->toArray();
    }

    /**
     * 保存基础信息.
     */
    public function saveFlow()
    {
        $authorization = $this->getAuthorization();
        $magicFlowDTO = MagicFlowAssembler::createMagicFlowDTOByMixed($this->request->all());
        $magicFlowDO = MagicFlowAssembler::createMagicFlowDO($magicFlowDTO);

        $magicFlow = $this->magicFlowAppService->save($authorization, $magicFlowDO);
        $icons = $this->magicFlowAppService->getIcons($magicFlow->getOrganizationCode(), [$magicFlow->getIcon()]);

        return MagicFlowAssembler::createMagicFlowDTO($magicFlow, $icons);
    }

    /**
     * 试运行.
     */
    public function flowDebug(string $flowId)
    {
        $authorization = $this->getAuthorization();
        $magicFlowDTO = MagicFlowAssembler::createMagicFlowDTOByMixed($this->request->all());
        $magicFlowDO = MagicFlowAssembler::createMagicFlowDO($magicFlowDTO);
        $magicFlowDO->setCode($flowId);

        // 触发方式、触发数据
        $triggerConfig = $this->request->input('trigger_config', []);

        return $this->magicFlowExecuteAppService->testRun($authorization, $magicFlowDO, $triggerConfig);
    }

    /**
     * 查询.
     */
    public function queries()
    {
        $authorization = $this->getAuthorization();
        $params = $this->request->all();
        $query = new MagicFLowQuery($params);
        $query->setOrder(['updated_at' => 'desc']);
        $page = $this->createPage();
        $result = $this->magicFlowAppService->queries($authorization, $query, $page);
        return MagicFlowAssembler::createPageListDTO($result['total'], $result['list'], $page, $result['users'], $result['icons']);
    }

    /**
     * 查询工具.
     */
    public function queryTools()
    {
        $authorization = $this->getAuthorization();
        $params = $this->request->all();
        $query = new MagicFLowQuery($params);
        $result = $this->magicFlowAppService->queryTools($authorization, $query);
        return MagicFlowAssembler::createPageListDTO($result['total'], $result['list'], Page::createNoPage());
    }

    /**
     * 查询可用工具集.
     */
    public function queryToolSets()
    {
        $withBuiltin = (bool) $this->request->input('with_builtin', true);
        $result = $this->magicFlowAppService->queryToolSets($this->getAuthorization(), $withBuiltin);
        return MagicFlowToolSetAssembler::createPageListDTO($result['total'], $result['list'], Page::createNoPage(), $result['users'], $result['icons']);
    }

    public function queryMCPList()
    {
        $authorization = $this->getAuthorization();
        $page = $this->createPage();

        $office = (bool) $this->request->input('office', false);

        $query = new MCPServerQuery($this->request->all());
        $query->setOrder(['id' => 'desc']);
        $query->setEnabled(true);
        $result = $this->mcpServerAppService->availableQueries($authorization, $query, $page, $office);

        return MCPServerAssembler::createSelectPageListDTO(
            total: $result['total'],
            list: $result['list'],
            page: $page,
            icons: $result['icons'],
        );
    }

    /**
     * 查询可用向量知识库.
     */
    public function queryKnowledge()
    {
        $result = $this->magicFlowAppService->queryKnowledge($this->getAuthorization());
        return MagicFlowKnowledgeAssembler::createPageListDTO($result['total'], $result['list'], Page::createNoPage(), $result['users']);
    }

    /**
     * 详情.
     */
    public function show(string $flowId)
    {
        $magicFlow = $this->magicFlowAppService->getByCode($this->getAuthorization(), $flowId);
        $icons = $this->magicFlowAppService->getIcons($magicFlow->getOrganizationCode(), [$magicFlow->getIcon()]);
        return MagicFlowAssembler::createMagicFlowDTO($magicFlow, $icons);
    }

    public function showParams(string $flowId)
    {
        $magicFlow = $this->magicFlowAppService->getByCode($this->getAuthorization(), $flowId);
        return MagicFlowAssembler::createMagicFlowParamsDTO($magicFlow);
    }

    /**
     * 启用/禁用.
     */
    public function changeEnable(string $flowId)
    {
        // 从请求中获取enable参数，如果没有传递则不影响原有逻辑
        $enable = $this->request->has('enable') ? (bool) $this->request->input('enable') : null;
        $this->magicFlowAppService->changeEnable($this->getAuthorization(), $flowId, $enable);
    }

    /**
     * 删除.
     */
    public function remove(string $flowId)
    {
        $this->magicFlowAppService->remove($this->getAuthorization(), $flowId);
    }

    public function expressionDataSource()
    {
        $this->getAuthorization();
        return $this->magicFlowAppService->expressionDataSource();
    }
}
