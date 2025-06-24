<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use Dtyq\SuperMagic\Infrastructure\Database\Migration\ProjectArchitectureIntegrityValidator;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * Data integrity application service
 */
class DataIntegrityAppService
{
    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Validate project architecture migration integrity
     */
    public function validateProjectArchitectureMigration(): array
    {
        $this->logger->info('Starting project architecture migration validation');
        
        $validator = new ProjectArchitectureIntegrityValidator($this->logger);
        $results = $validator->validateMigration();
        $summary = $validator->getValidationSummary();
        
        if ($summary['all_passed']) {
            $this->logger->info('All data integrity checks passed', $summary);
        } else {
            $this->logger->error('Some data integrity checks failed', [
                'summary' => $summary,
                'failed_checks' => $validator->getFailedChecks()
            ]);
        }
        
        return [
            'summary' => $summary,
            'results' => $results,
            'failed_checks' => $validator->getFailedChecks()
        ];
    }

    /**
     * Get validation report as formatted text
     */
    public function getValidationReport(): string
    {
        $validation = $this->validateProjectArchitectureMigration();
        $summary = $validation['summary'];
        
        $report = "# Project Architecture Migration Validation Report\n\n";
        $report .= "## Summary\n";
        $report .= "- Total Checks: {$summary['total_checks']}\n";
        $report .= "- Passed: {$summary['passed']}\n";
        $report .= "- Failed: {$summary['failed']}\n";
        $report .= "- Success Rate: {$summary['success_rate']}%\n";
        $report .= "- Overall Status: " . ($summary['all_passed'] ? "✅ PASSED" : "❌ FAILED") . "\n\n";
        
        if (!empty($validation['failed_checks'])) {
            $report .= "## Failed Checks\n";
            foreach ($validation['failed_checks'] as $check) {
                $report .= "- **{$check['check']}**: {$check['message']}\n";
            }
            $report .= "\n";
        }
        
        $report .= "## Detailed Results\n";
        foreach ($validation['results'] as $result) {
            $status = $result['passed'] ? "✅" : "❌";
            $report .= "- {$status} **{$result['check']}**: {$result['message']}\n";
        }
        
        return $report;
    }
}