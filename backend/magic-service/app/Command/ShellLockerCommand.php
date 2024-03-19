<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class ShellLockerCommand extends HyperfCommand
{
    protected LockerInterface $locker;

    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('shell:locker');
        $this->locker = $this->container->get(LockerInterface::class);
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Execute shell commands with distributed lock protection');
        $this->addArgument('action', InputArgument::REQUIRED, 'Action to execute (migrate)');
        $this->addOption('timeout', 't', InputOption::VALUE_OPTIONAL, 'Lock timeout in seconds', 300);
    }

    public function handle(): void
    {
        $action = $this->input->getArgument('action');
        $timeout = (int) $this->input->getOption('timeout');

        switch ($action) {
            case 'migrate':
                $this->executeMigrate($timeout);
                break;
            default:
                $this->error("Unknown action: {$action}");
                $this->line('Available actions: migrate');
                return;
        }
    }

    private function executeMigrate(int $timeout): void
    {
        $lockKey = 'shell:migrate:lock';
        $lockOwner = 'shell-locker-' . gethostname() . '-' . getmypid();

        $this->info('Attempting to acquire migration lock...');

        if (! $this->locker->mutexLock($lockKey, $lockOwner, $timeout)) {
            $this->error('Failed to acquire migration lock. Another migration process may be running.');
            return;
        }

        try {
            $this->info('Migration lock acquired successfully. Starting migration...');

            // Execute main migrations
            $this->info('Running main migrations...');
            $migrationResult = $this->executeMigrationCommand('migrate --force');
            if ($migrationResult !== 0) {
                $this->error('Main migration failed');
                return;
            }

            // Execute vendor migrations
            $this->info('Running vendor migrations...');
            $vendorResult = $this->executeMigrationCommand('migrate:vendor');
            if ($vendorResult !== 0) {
                $this->error('Vendor migration failed');
                return;
            }

            $this->info('All migrations completed successfully');
        } catch (Throwable $e) {
            $this->error('Migration failed with exception: ' . $e->getMessage());
        } finally {
            // Always release the lock
            $this->locker->release($lockKey, $lockOwner);
            $this->info('Migration lock released');
        }
    }

    private function executeMigrationCommand(string $command): int
    {
        $basePath = BASE_PATH;
        $binPath = $basePath . '/bin/hyperf.php';
        $fullCommand = "php \"{$binPath}\" {$command}";

        $this->line("Executing: {$fullCommand}");

        // Execute the command and capture output
        $output = [];
        $returnCode = 0;
        exec($fullCommand . ' 2>&1', $output, $returnCode);

        // Display output
        foreach ($output as $line) {
            $this->line($line);
        }

        return $returnCode;
    }
}
