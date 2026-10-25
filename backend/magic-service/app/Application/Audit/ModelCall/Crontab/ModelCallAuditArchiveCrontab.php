<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Crontab;

use App\Application\Audit\ModelCall\Service\ModelCallAuditArchiveService;
use DateTimeImmutable;
use DateTimeZone;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Config\config;

#[Crontab(
    rule: '30 0 * * *',
    name: 'ModelCallAuditArchiveCrontab',
    singleton: true,
    mutexExpires: 3600,
    onOneServer: true,
    callback: 'execute',
    memo: '模型审计日志小时聚合归档'
)]
final class ModelCallAuditArchiveCrontab
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly ModelCallAuditArchiveService $archiveService,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function execute(): void
    {
        $yesterday = (new DateTimeImmutable('yesterday', new DateTimeZone((string) config('app.default_timezone', 'Asia/Shanghai'))))
            ->format('Y-m-d');
        try {
            $result = $this->archiveService->archiveRange($yesterday, $yesterday);
            if ($result['failed'] > 0) {
                $this->logger->error('Model audit hourly archive finished with failures', $result);
                throw new RuntimeException(sprintf(
                    'Model audit hourly archive failed for dates: %s',
                    implode(', ', $result['failed_dates'])
                ));
            }
            $this->logger->info('Model audit hourly archive finished', $result);
        } catch (Throwable $throwable) {
            $this->logger->error('Model audit hourly archive failed', [
                'stat_date' => $yesterday,
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
            ]);
            throw $throwable;
        }
    }
}
