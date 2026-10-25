<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;

use function Hyperf\Config\config;

return new class extends Migration {
    // Historical persisted values must remain literal, even if classes move again.
    private const OLD_CLASS = 'Dtyq\SuperMagic\Application\SuperAgent\Service\MessageScheduleAppService';

    private const NEW_CLASS = 'App\Application\SuperMagic\Message\Service\MessageScheduleAppService';

    private const CALLBACK_METHOD = 'messageScheduleCallback';

    public function up(): void
    {
        $connection = Db::connection($this->getConnection() ?: null);
        $tables = [
            config('task_scheduler.table_names.task_scheduler_crontab', 'task_scheduler_crontab'),
            config('task_scheduler.table_names.task_scheduler', 'task_scheduler'),
        ];

        $connection->transaction(function () use ($connection, $tables): void {
            foreach ($tables as $table) {
                $wrappedTable = $connection->table($table)->getGrammar()->wrapTable($table);
                $connection->update(
                    "UPDATE {$wrappedTable}
                     SET callback_method = JSON_REPLACE(
                         callback_method, '$[0]', CAST(? AS CHAR CHARACTER SET utf8mb4)
                     )
                     WHERE JSON_TYPE(callback_method) = 'ARRAY'
                       AND JSON_LENGTH(callback_method) = 2
                       AND CAST(JSON_UNQUOTE(JSON_EXTRACT(callback_method, '$[0]')) AS BINARY)
                           = CAST(? AS BINARY)
                       AND CAST(JSON_UNQUOTE(JSON_EXTRACT(callback_method, '$[1]')) AS BINARY)
                           = CAST(? AS BINARY)",
                    [self::NEW_CLASS, self::OLD_CLASS, self::CALLBACK_METHOD]
                );
            }
        });
    }

    public function down(): void
    {
        // This data repair is irreversible without a pre-migration backup.
        // Replacing every new callback would also change unrelated/new records.
    }
};
