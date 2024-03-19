<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Command;

use App\Domain\Agent\Constant\SystemInstructType;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Repository\Persistence\MagicAgentRepository;
use App\Domain\Agent\Repository\Persistence\MagicAgentVersionRepository;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;

#[Command]
class EnsureSystemInstructsCommand extends HyperfCommand
{
    public function __construct(protected ContainerInterface $container, public MagicAgentRepository $agentRepository, public MagicAgentVersionRepository $agentVersionRepository)
    {
        parent::__construct('agent:ensure-system-instructs');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('确保所有助理都有完整的系统交互指令');
    }

    public function handle()
    {
        $batchSize = 20;
        $offset = 0;
        $total = 0;
        $updated = 0;

        $this->output->writeln('开始处理助理系统交互指令...');

        while (true) {
            // 分批获取助理
            $agents = $this->agentRepository->getAgentsByBatch($offset, $batchSize);
            if (empty($agents)) {
                break;
            }

            foreach ($agents as $agent) {
                ++$total;

                // 获取当前指令
                $instructs = $agent['instructs'] ?? [];

                // 检查并补充系统指令
                $newInstructs = SystemInstructType::ensureSystemInstructs($instructs);

                // 如果指令有变化，保存更新
                if ($newInstructs !== $instructs) {
                    $this->agentRepository->updateInstruct(
                        $agent['organization_code'],
                        $agent['id'],
                        $newInstructs
                    );
                    ++$updated;
                    $this->output->writeln(sprintf('已更新助理 [%s] 的系统交互指令', $agent['id']));
                }
            }

            $offset += $batchSize;
            $this->output->writeln(sprintf('已处理 %d 个助理...', $total));
        }

        $this->output->writeln(sprintf(
            '处理完成！共处理 %d 个助理，更新了 %d 个助理的系统交互指令',
            $total,
            $updated
        ));

        // 处理助理版本
        $offset = 0;
        $versionTotal = 0;
        $versionUpdated = 0;

        $this->output->writeln('\n开始处理助理版本系统交互指令...');

        while (true) {
            // 分批获取助理版本
            $versions = $this->agentVersionRepository->getAgentVersionsByBatch($offset, $batchSize);
            if (empty($versions)) {
                break;
            }

            foreach ($versions as $version) {
                ++$versionTotal;

                // 获取当前指令
                $instructs = $version['instructs'] ?? [];

                // 检查并补充系统指令
                $newInstructs = SystemInstructType::ensureSystemInstructs($instructs);

                // 如果指令有变化，保存更新
                if ($newInstructs !== $instructs) {
                    $this->agentVersionRepository->updateById(
                        new MagicAgentVersionEntity(array_merge($version, ['instructs' => $newInstructs]))
                    );
                    ++$versionUpdated;
                    $this->output->writeln(sprintf('已更新助理版本 [%s] 的系统交互指令', $version['id']));
                }
            }

            $offset += $batchSize;
            $this->output->writeln(sprintf('已处理 %d 个助理版本...', $versionTotal));
        }

        $this->output->writeln(sprintf(
            '处理完成！共处理 %d 个助理版本，更新了 %d 个助理版本的系统交互指令',
            $versionTotal,
            $versionUpdated
        ));
    }
}
