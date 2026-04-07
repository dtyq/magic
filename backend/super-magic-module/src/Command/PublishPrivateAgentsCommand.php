<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Command;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\SuperMagicAgentModel;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class PublishPrivateAgentsCommand extends HyperfCommand
{
    protected ?string $name = 'super-magic:publish-private-agents';

    protected LoggerInterface $logger;

    public function __construct(
        protected SuperMagicAgentAppService $superMagicAgentAppService,
        protected MagicUserDomainService $magicUserDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('publish-private-agents');
        parent::__construct();
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('按 Agent ID 补发到私人范围');
        $this->addOption('id', null, InputOption::VALUE_REQUIRED, '要发布的 Agent ID，多个用逗号分隔');
    }

    public function handle(): void
    {
        $ids = $this->parseIds((string) $this->input->getOption('id'));
        if ($ids === []) {
            $this->error('请通过 --id 传入要发布的 Agent ID，多个用逗号分隔');
            return;
        }

        $agents = $this->getAgentsByIds($ids);

        if ($agents === []) {
            $this->line('没有找到需要发布的 Agent');
            return;
        }

        $this->line(sprintf('共找到 %d 个 Agent，开始发布...', count($agents)));
        $this->logger->info('开始补发 Agent 到私人范围', [
            'ids' => $ids,
            'count' => count($agents),
        ]);

        $successCount = 0;
        $failCount = 0;

        foreach ($agents as $agent) {
            $agentId = (int) $agent->id;
            $agentCode = (string) $agent->code;
            $creator = (string) $agent->creator;

            $this->line(sprintf('发布 Agent: id=%d code=%s creator=%s', $agentId, $agentCode, $creator));

            $userEntity = $this->magicUserDomainService->getByUserId($creator);
            if ($userEntity === null) {
                ++$failCount;
                $message = sprintf('创建者不存在，跳过: id=%d code=%s creator=%s', $agentId, $agentCode, $creator);
                $this->error($message);
                $this->logger->error($message);
                continue;
            }

            try {
                $authorization = MagicUserAuthorization::fromUserEntity($userEntity);
                $authorization->setOrganizationCode((string) $agent->organization_code);

                $versionEntity = $this->superMagicAgentAppService->publishAgentPrivatelyWithoutExport($authorization, $agentCode);

                ++$successCount;
                $this->line(sprintf(
                    '发布成功: id=%d code=%s version_id=%d version=%s',
                    $agentId,
                    $agentCode,
                    $versionEntity->getId(),
                    $versionEntity->getVersion()
                ));
            } catch (Throwable $throwable) {
                ++$failCount;
                $this->error(sprintf('发布失败: id=%d code=%s error=%s', $agentId, $agentCode, $throwable->getMessage()));
                $this->logger->error('发布 Agent 失败', [
                    'agent_id' => $agentId,
                    'code' => $agentCode,
                    'creator' => $creator,
                    'error' => $throwable->getMessage(),
                ]);
            }
        }

        $this->line('');
        $this->line(sprintf('完成，成功 %d 个，失败 %d 个。', $successCount, $failCount));
    }

    /**
     * @param array<int> $ids
     * @return array<int, SuperMagicAgentModel>
     */
    private function getAgentsByIds(array $ids): array
    {
        return SuperMagicAgentModel::query()
            ->whereNull('deleted_at')
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->get()
            ->all();
    }

    /**
     * @return array<int>
     */
    private function parseIds(string $rawIds): array
    {
        if (trim($rawIds) === '') {
            return [];
        }

        $ids = [];
        foreach (explode(',', $rawIds) as $rawId) {
            $id = (int) trim($rawId);
            if ($id > 0) {
                $ids[$id] = $id;
            }
        }

        return array_values($ids);
    }
}
