<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class CompactMagicFSFileTreeChangeJournalCommand extends HyperfCommand
{
    protected ?string $name = 'magicfs:compact-file-tree-change-journal';

    public function __construct(
        private readonly TaskFileRepositoryInterface $taskFileRepository,
    ) {
        parent::__construct();
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Compact the durable MagicFS file-tree change journal');
        $this->addOption(
            'keep-revisions',
            null,
            InputOption::VALUE_REQUIRED,
            'Minimum newest revisions retained in every file tree',
            '100000'
        );
        $this->addOption(
            'batch-size',
            null,
            InputOption::VALUE_REQUIRED,
            'Rows deleted per short file-tree transaction (1-10000)',
            '1000'
        );
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, 'Count eligible rows without deleting them');
        $this->addOption('yes', 'y', InputOption::VALUE_NONE, 'Run without interactive confirmation');
    }

    public function handle(): int
    {
        $keepRevisions = filter_var(
            $this->input->getOption('keep-revisions'),
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );
        $batchSize = filter_var(
            $this->input->getOption('batch-size'),
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1, 'max_range' => 10000]]
        );
        if ($keepRevisions === false || $batchSize === false) {
            $this->error('--keep-revisions must be > 0 and --batch-size must be between 1 and 10000.');
            return self::FAILURE;
        }

        $dryRun = (bool) $this->input->getOption('dry-run');
        if (! $dryRun
            && ! (bool) $this->input->getOption('yes')
            && ! $this->confirm(
                sprintf('Keep the newest %d revisions per file tree and delete older journal rows?', $keepRevisions),
                false
            )) {
            $this->info('Canceled.');
            return self::SUCCESS;
        }

        try {
            $result = $this->taskFileRepository->compactFileTreeChangeJournal(
                $keepRevisions,
                $batchSize,
                $dryRun
            );
        } catch (Throwable $throwable) {
            $this->error(sprintf('MagicFS file-tree change journal compaction failed: %s', $throwable->getMessage()));
            return self::FAILURE;
        }

        $prefix = $dryRun ? '[dry-run] ' : '';
        $this->info(sprintf(
            '%sprocessed %d file trees; %d rows %s; %d file trees crossed the cursor-expiry boundary.',
            $prefix,
            $result['file_trees'],
            $result['deleted_rows'],
            $dryRun ? 'eligible' : 'deleted',
            $result['expired_file_trees']
        ));

        return self::SUCCESS;
    }
}
