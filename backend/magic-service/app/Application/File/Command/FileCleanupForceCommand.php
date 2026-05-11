<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Command;

use App\Application\File\Service\FileCleanupAppService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputOption;

#[Command]
class FileCleanupForceCommand extends HyperfCommand
{
    public function __construct(
        private readonly FileCleanupAppService $fileCleanupAppService,
    ) {
        parent::__construct('file:cleanup-force');
    }

    public function configure(): void
    {
        parent::configure();

        $this->setDescription('按清理记录主键强制执行文件清理');
        $this->addArgument('record_id', InputArgument::REQUIRED, 'magic_file_cleanup_records 表主键 ID');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '仅预览记录详情，不执行实际清理');
    }

    public function handle(): int
    {
        $recordId = (int) $this->input->getArgument('record_id');
        if ($recordId <= 0) {
            $this->error('record_id 必须是大于 0 的整数');
            return self::FAILURE;
        }

        $record = $this->fileCleanupAppService->getCleanupRecord($recordId);
        if ($record === null) {
            $this->error('记录不存在或已被清理');
            return self::FAILURE;
        }

        $this->line('清理记录详情:');
        $this->renderRecord($record);

        if ((bool) $this->input->getOption('dry-run')) {
            $this->info('Dry run 模式，未执行实际清理');
            return self::SUCCESS;
        }

        if ($this->fileCleanupAppService->forceCleanup($recordId)) {
            $this->info('清理成功');
            return self::SUCCESS;
        }

        $this->error('清理失败');
        return self::FAILURE;
    }

    private function renderRecord(array $record): void
    {
        $fields = [
            'id',
            'organization_code',
            'file_key',
            'file_name',
            'bucket_type',
            'source_type',
            'source_id',
            'expire_at',
            'status',
            'retry_count',
            'error_message',
        ];

        foreach ($fields as $field) {
            $this->line(sprintf('%s: %s', $field, $this->formatValue($record[$field] ?? null)));
        }
    }

    private function formatValue(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
    }
}
