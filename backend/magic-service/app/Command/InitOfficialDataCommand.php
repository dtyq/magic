<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Application\Mode\Official\ModeInitializer;
use App\Application\ModelGateway\Official\OfficialAccessTokenInitializer;
use App\Application\Provider\Official\ServiceProviderInitializer;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Contract\StdoutLoggerInterface;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * Initialize official data for new system setup.
 *
 * Usage:
 *   php bin/hyperf.php init:official
 *   php bin/hyperf.php init:official --api-key=your-custom-key
 *   php bin/hyperf.php init:official --skip-providers
 *   php bin/hyperf.php init:official --skip-modes
 *   php bin/hyperf.php init:official --skip-token
 */
#[Command]
class InitOfficialDataCommand extends HyperfCommand
{
    public function __construct(
        protected ContainerInterface $container,
        protected StdoutLoggerInterface $logger,
    ) {
        parent::__construct('init:official');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('Initialize official data (service providers, modes, access token) for new system');

        // Add options
        $this->addOption('api-key', 'k', InputOption::VALUE_OPTIONAL, 'Custom API key for access token (optional, will generate if not provided)');
        $this->addOption('skip-providers', null, InputOption::VALUE_NONE, 'Skip service provider initialization');
        $this->addOption('skip-modes', null, InputOption::VALUE_NONE, 'Skip mode initialization');
        $this->addOption('skip-token', null, InputOption::VALUE_NONE, 'Skip access token initialization');
        $this->addOption('force', 'f', InputOption::VALUE_NONE, 'Force re-initialization (will skip existence checks)');
    }

    public function handle()
    {
        $this->printHeader();

        // Check configuration
        if (! $this->checkConfiguration()) {
            return 1;
        }

        $apiKey = $this->input->getOption('api-key');
        $skipProviders = $this->input->getOption('skip-providers');
        $skipModes = $this->input->getOption('skip-modes');
        $skipToken = $this->input->getOption('skip-token');

        $results = [];
        $hasError = false;

        // 1. Initialize Service Providers
        if (! $skipProviders) {
            $this->info('');
            $this->info('📦 [1/3] Initializing Service Providers...');
            $this->info('─────────────────────────────────────────');
            $result = $this->initializeServiceProviders();
            $results['providers'] = $result;

            if ($result['success']) {
                $this->line('✓ ' . $result['message']);
            } else {
                $this->error('✗ ' . $result['message']);
                $hasError = true;
            }
        } else {
            $this->comment('⊘ Service providers initialization skipped');
        }

        // 2. Initialize Modes
        if (! $skipModes) {
            $this->info('');
            $this->info('🎨 [2/3] Initializing Modes...');
            $this->info('─────────────────────────────────────────');
            $result = $this->initializeModes();
            $results['modes'] = $result;

            if ($result['success']) {
                $this->line('✓ ' . $result['message']);
            } else {
                $this->error('✗ ' . $result['message']);
                $hasError = true;
            }
        } else {
            $this->comment('⊘ Modes initialization skipped');
        }

        // 3. Initialize Access Token
        if (! $skipToken) {
            $this->info('');
            $this->info('🔑 [3/3] Initializing Access Token...');
            $this->info('─────────────────────────────────────────');
            $result = $this->initializeAccessToken($apiKey);
            $results['token'] = $result;

            if ($result['success']) {
                $this->line('✓ ' . $result['message']);
                if ($result['access_token']) {
                    $this->info('');
                    $this->comment('  Application Code: ' . $result['application_code']);
                    $this->comment('  Access Token: ' . $result['access_token']);
                    $this->info('');
                    $this->warn('  ⚠ Please save this access token securely!');
                }
            } else {
                $this->error('✗ ' . $result['message']);
                $hasError = true;
            }
        } else {
            $this->comment('⊘ Access token initialization skipped');
        }

        // Print summary
        $this->printSummary($results, $hasError);

        return $hasError ? 1 : 0;
    }

    /**
     * Check if required configuration exists.
     */
    private function checkConfiguration(): bool
    {
        $officialOrgCode = config('service_provider.office_organization');

        if (empty($officialOrgCode)) {
            $this->error('');
            $this->error('❌ Configuration Error');
            $this->error('─────────────────────────────────────────');
            $this->error('Official organization code is not configured.');
            $this->info('');
            $this->info('Please set the following in your config:');
            $this->comment('  config/autoload/service_provider.php');
            $this->comment('  return [');
            $this->comment('      \'office_organization\' => \'YOUR_ORG_CODE\',');
            $this->comment('  ];');
            $this->info('');
            return false;
        }

        $this->comment('Official Organization: ' . $officialOrgCode);
        return true;
    }

    /**
     * Initialize service providers.
     */
    private function initializeServiceProviders(): array
    {
        try {
            return ServiceProviderInitializer::init();
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Exception: ' . $e->getMessage(),
                'count' => 0,
            ];
        }
    }

    /**
     * Initialize modes.
     */
    private function initializeModes(): array
    {
        try {
            return ModeInitializer::init();
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Exception: ' . $e->getMessage(),
                'count' => 0,
            ];
        }
    }

    /**
     * Initialize access token.
     */
    private function initializeAccessToken(?string $apiKey): array
    {
        try {
            return OfficialAccessTokenInitializer::init($apiKey);
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Exception: ' . $e->getMessage(),
                'access_token' => null,
                'application_code' => null,
            ];
        }
    }

    /**
     * Print header.
     */
    private function printHeader(): void
    {
        $this->info('');
        $this->info('═════════════════════════════════════════');
        $this->info('  Magic Official Data Initialization');
        $this->info('═════════════════════════════════════════');
    }

    /**
     * Print summary.
     */
    private function printSummary(array $results, bool $hasError): void
    {
        $this->info('');
        $this->info('═════════════════════════════════════════');
        $this->info('  Summary');
        $this->info('═════════════════════════════════════════');

        if (isset($results['providers'])) {
            $status = $results['providers']['success'] ? '✓' : '✗';
            $count = $results['providers']['count'] ?? 0;
            $this->line("  {$status} Service Providers: {$count} initialized");
        }

        if (isset($results['modes'])) {
            $status = $results['modes']['success'] ? '✓' : '✗';
            $count = $results['modes']['count'] ?? 0;
            $this->line("  {$status} Modes: {$count} initialized");
        }

        if (isset($results['token'])) {
            $status = $results['token']['success'] ? '✓' : '✗';
            $this->line("  {$status} Access Token: " . ($results['token']['success'] ? 'Created' : 'Failed'));
        }

        $this->info('');

        if ($hasError) {
            $this->error('❌ Initialization completed with errors');
        } else {
            $this->info('✅ Initialization completed successfully!');
        }

        $this->info('');
    }
}
