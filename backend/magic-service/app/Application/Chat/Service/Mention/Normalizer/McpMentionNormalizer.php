<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention\Normalizer;

use App\Application\Chat\Service\Mention\AbstractMentionNormalizer;
use App\Application\MCP\Service\MCPServerAppService;
use App\Application\MCP\Utils\MCPServerConfigUtil;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\TempAuth\TempAuthInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Logger\LoggerFactory;

/**
 * @mcp mention 规范化：补全完整运行时配置。
 *
 * 输出字段：
 *  - name / description（顶层）
 *  - config（嵌套子字段，与原 SupperMagicAgentMCP::createMcpServers 中
 *    mcpConfig.mcpServers[name] 字段口径一致：type=http/stdio、url、command、
 *    args、env、headers、token、allowedTools 等）
 *
 * 嵌套到 config 子字段是为了避免与 mention.type=mcp 冲突（McpServerConfig::toArray
 * 中的 type=http/stdio 若平铺会覆盖 mention.type，导致 super-magic 端 builder
 * 路由到 mcp_handler 失败）。
 *
 * 失败时仅保留原 mention 字段，super-magic 端 mcp_handler 会跳过注册仅推送提示。
 */
class McpMentionNormalizer extends AbstractMentionNormalizer
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly MCPServerAppService $MCPServerAppService,
        private readonly TempAuthInterface $tempAuth,
    ) {
        parent::__construct($loggerFactory);
    }

    protected function enrich(array $item, BaseDataIsolation $dataIsolation): array
    {
        $mcpId = (string) ($item['id'] ?? '');
        if ($mcpId === '') {
            return [];
        }

        $mcpDataIsolation = MCPDataIsolation::createByBaseDataIsolation($dataIsolation);

        $query = new MCPServerQuery();
        $query->setEnabled(true);
        $query->setCodes([$mcpId]);
        $data = $this->MCPServerAppService->availableQueries($mcpDataIsolation, $query, Page::createNoPage());
        /** @var array<MCPServerEntity> $list */
        $list = array_values($data['list'] ?? []);
        $mcpServer = $list[0] ?? null;
        if ($mcpServer === null) {
            return [];
        }

        $localHttpUrl = config('super-magic.sandbox.callback_host', '');
        $serverConfig = MCPServerConfigUtil::create($mcpDataIsolation, $mcpServer, $localHttpUrl);
        if (! $serverConfig) {
            return [];
        }

        $localHttpUrlNoSlash = rtrim($localHttpUrl, '/');
        if (str_starts_with($serverConfig->getUrl(), $localHttpUrlNoSlash . '/api/v1/mcp/sse')) {
            $token = $this->tempAuth->create([
                'user_id' => $mcpDataIsolation->getCurrentUserId(),
                'organization_code' => $mcpDataIsolation->getCurrentOrganizationCode(),
                'server_code' => $mcpServer->getCode(),
            ], 3600);
            $serverConfig->setToken($token);
        }

        $config = $serverConfig->toArray();
        $config['name'] = $mcpServer->getName();
        $config['description'] = $mcpServer->getDescription();

        return [
            'name' => $mcpServer->getName(),
            'description' => $mcpServer->getDescription(),
            'config' => $config,
        ];
    }
}
