<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Service\SkillDomainService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class CleanupSkillImportedI18nCommand extends HyperfCommand
{
    private const int DEFAULT_BATCH_SIZE = 200;

    public function __construct(
        private readonly ContainerInterface $container
    ) {
        parent::__construct('skill:cleanup-imported-i18n');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('清理 ZIP 导入 Skill 中与 default 重复的历史多语言字段');
        $this->addOption('skill-code', null, InputOption::VALUE_REQUIRED, '仅处理指定 Skill code');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '预览模式，不实际写入数据库');
        $this->addOption('batch-size', null, InputOption::VALUE_OPTIONAL, '批处理大小', self::DEFAULT_BATCH_SIZE);
    }

    public function handle(): int
    {
        $skillCode = trim((string) ($this->input->getOption('skill-code') ?? ''));
        $skillCode = $skillCode === '' ? null : $skillCode;
        $dryRun = (bool) $this->input->getOption('dry-run');
        $batchSize = max(1, (int) $this->input->getOption('batch-size'));

        $this->line('清理范围: ' . ($skillCode ?? '全部 LOCAL_UPLOAD Skill'));
        $this->line('模式: ' . ($dryRun ? '预览模式（不会实际更新数据）' : '执行模式'));

        if (! $dryRun && ! $this->confirm('确认要执行多语言字段清理吗？', false)) {
            $this->warn('已取消');
            return 0;
        }

        try {
            $skillDomainService = $this->container->get(SkillDomainService::class);
            $dataIsolation = SkillDataIsolation::create()->disabled();
            $page = 1;
            $stats = [
                'scanned' => 0,
                'candidates' => 0,
                'updated' => 0,
                'name_removed' => 0,
                'description_removed' => 0,
            ];

            do {
                $result = $skillDomainService->findLocalUploadSkillsForI18nCleanup(
                    $dataIsolation,
                    $skillCode,
                    $page,
                    $skillCode === null ? $batchSize : 1
                );
                $skills = $result['list'];

                foreach ($skills as $skill) {
                    ++$stats['scanned'];
                    [$nameI18n, $nameRemoved] = $this->removeDuplicatedLocales($skill->getNameI18n());
                    [$descriptionI18n, $descriptionRemoved] = $this->removeDuplicatedLocales(
                        $skill->getDescriptionI18n()
                    );

                    $stats['name_removed'] += $nameRemoved;
                    $stats['description_removed'] += $descriptionRemoved;
                    if ($nameRemoved > 0 || $descriptionRemoved > 0) {
                        ++$stats['candidates'];
                        if (! $dryRun && $skillDomainService->updateNameAndDescriptionI18n(
                            $dataIsolation,
                            $skill->getCode(),
                            $nameI18n,
                            $descriptionI18n
                        )) {
                            ++$stats['updated'];
                        }
                    }
                }

                ++$page;
            } while ($skillCode === null && count($skills) === $batchSize);

            $this->info(sprintf(
                '清理完成: scanned=%d, %s=%d, name_removed=%d, description_removed=%d',
                $stats['scanned'],
                $dryRun ? 'would_update' : 'updated',
                $dryRun ? $stats['candidates'] : $stats['updated'],
                $stats['name_removed'],
                $stats['description_removed']
            ));

            return 0;
        } catch (Throwable $e) {
            $this->error('清理失败: ' . $e->getMessage());
            return 1;
        }
    }

    /**
     * @param null|array<string, mixed> $i18n
     * @return array{0: null|array<string, mixed>, 1: int}
     */
    private function removeDuplicatedLocales(?array $i18n): array
    {
        if ($i18n === null || ! array_key_exists('default', $i18n) || $i18n['default'] === null) {
            return [$i18n, 0];
        }

        $removed = 0;
        foreach (['zh_CN', 'en_US'] as $locale) {
            if (array_key_exists($locale, $i18n) && $i18n[$locale] === $i18n['default']) {
                unset($i18n[$locale]);
                ++$removed;
            }
        }

        return [$i18n, $removed];
    }
}
