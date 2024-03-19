<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Symfony\Component\Console\Input\InputArgument;
use Throwable;

#[Command]
class DebugQueryCommand extends HyperfCommand
{
    protected ?string $name = 'debug:query';

    public function configure()
    {
        parent::configure();
        $this->setDescription('查询数据库记录数量');
        $this->addArgument('table', InputArgument::REQUIRED, '表名');
    }

    public function handle()
    {
        $table = $this->input->getArgument('table');

        try {
            $count = Db::table($table)->count();
            $this->line("表 {$table} 中的记录数量: {$count}");

            // 输出表中的部分记录
            if ($count > 0) {
                $records = Db::table($table)->limit(5)->get();
                $this->table(['字段', '值'], $this->formatRecords($records));
            }
        } catch (Throwable $e) {
            $this->error('查询失败: ' . $e->getMessage());
        }
    }

    private function formatRecords($records)
    {
        $result = [];

        if (! empty($records) && count($records) > 0) {
            $record = $records[0];
            foreach ((array) $record as $field => $value) {
                if (is_array($value) || is_object($value)) {
                    $value = json_encode($value, JSON_UNESCAPED_UNICODE);
                }
                $result[] = [$field, $value];
            }
        }

        return $result;
    }
}
