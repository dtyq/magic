<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ApplicationEntity;
use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Repository\Facade\AccessTokenRepositoryInterface;
use App\Domain\ModelGateway\Repository\Facade\ApplicationRepositoryInterface;
use App\Domain\ModelGateway\Repository\Facade\ModelConfigRepositoryInterface;
use DateTime;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\DbConnection\Db;
use Psr\Container\ContainerInterface;
use Ramsey\Uuid\Uuid;
use RuntimeException;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class InitMagicDataCommand extends HyperfCommand
{
    public function __construct(
        protected ContainerInterface $container,
        protected StdoutLoggerInterface $logger,
        protected AccessTokenRepositoryInterface $accessTokenRepository,
        protected ApplicationRepositoryInterface $applicationRepository,
        protected ModelConfigRepositoryInterface $modelConfigRepository,
    ) {
        // 正常模式（不初始化模型网关数据）
        // php bin/hyperf.php init-magic:data
        // 单元测试模式（会初始化模型网关数据）
        // php bin/hyperf.php init-magic:data --type=all --unit-test
        parent::__construct('init-magic:data');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('初始化系统必要数据');

        // 添加选项，控制遇到错误时是否继续执行
        $this->addOption('continue-on-error', 'c', InputOption::VALUE_NONE, '遇到错误时是否继续执行，默认遇到错误终止执行');
        // 添加选项，控制在type=all时是否执行model-gateway初始化
        $this->addOption('unit-test', 'u', InputOption::VALUE_NONE, '单元测试模式，用于控制type=all时是否执行model-gateway初始化');
    }

    public function handle()
    {
        try {
            $this->initAllData();
        } catch (Throwable $e) {
            $this->logger->error(sprintf('初始化数据失败: %s', $e->getMessage()));
            return 1; // 返回非零状态码表示执行失败
        }

        return 0; // 返回 0 表示执行成功
    }

    /**
     * 初始化所有类型的数据.
     */
    protected function initAllData(): void
    {
        $this->logger->info('初始化所有数据');
        $continueOnError = $this->input->getOption('continue-on-error');
        $isUnitTest = $this->input->getOption('unit-test');

        // 检查magic_contact_users表是否有用户数据
        try {
            $userCount = Db::table('magic_contact_users')->count();
            if ($userCount > 0) {
                $this->logger->info("magic_contact_users表已有{$userCount}条用户数据，初始化成功");
                return;
            }
        } catch (Throwable $e) {
            $this->logger->error('检查magic_contact_users表用户数据失败: ' . $e->getMessage());
            // 如果检查失败，继续执行初始化过程
        }

        try {
            // 调用各个初始化方法
            $this->initUserData();
        } catch (Throwable $e) {
            $this->logger->error('初始化用户数据失败: ' . $e->getMessage());
            if (! $continueOnError) {
                throw $e;
            }
        }

        // 只有在单元测试模式下才初始化模型网关数据
        if ($isUnitTest) {
            try {
                $this->initModelGatewayData();
            } catch (Throwable $e) {
                $this->logger->error('初始化模型网关数据失败: ' . $e->getMessage());
                if (! $continueOnError) {
                    throw $e;
                }
            }
        } else {
            $this->logger->info('跳过初始化模型网关数据（非单元测试模式）');
        }

        try {
            $this->runAllDbSeeders();
        } catch (Throwable $e) {
            $this->logger->error('执行数据库种子失败: ' . $e->getMessage());
            if (! $continueOnError) {
                throw $e;
            }
        }

        $this->logger->info('所有数据初始化完成');
    }

    /**
     * 初始化用户数据.
     */
    protected function initUserData(): void
    {
        $this->logger->info('初始化用户数据');
        $continueOnError = $this->input->getOption('continue-on-error');

        try {
            // 这里添加用户初始化逻辑
            // ...

            $this->logger->info('用户数据初始化完成');
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '初始化用户数据失败: %s, file:%s line:%s trace:%s',
                $e->getMessage(),
                $e->getFile(),
                $e->getLine(),
                $e->getTraceAsString()
            ));

            if (! $continueOnError) {
                throw $e;
            }
        }
    }

    /**
     * 初始化API访问令牌.
     */
    protected function initModelGatewayData(): void
    {
        $this->logger->info('初始化 ModelGateway 数据');
        $continueOnError = $this->input->getOption('continue-on-error');

        $dataIsolation = new LLMDataIsolation('system', 'default');

        try {
            // 初始化Token
            $this->initAccessTokens($dataIsolation);
        } catch (Throwable $e) {
            $this->logger->error('初始化访问令牌失败: ' . $e->getMessage());
            if (! $continueOnError) {
                throw $e;
            }
        }

        try {
            // 初始化模型配置数据
            $this->initModelConfigs();
        } catch (Throwable $e) {
            $this->logger->error('初始化模型配置失败: ' . $e->getMessage());
            if (! $continueOnError) {
                throw $e;
            }
        }

        $this->logger->info('ModelGateway 数据初始化完成');
    }

    /**
     * 初始化访问令牌配置.
     */
    protected function initAccessTokens(LLMDataIsolation $dataIsolation): void
    {
        $this->logger->info('开始初始化访问令牌');
        $continueOnError = $this->input->getOption('continue-on-error');

        // Token配置定义
        $tokenConfigs = [
            // 用户通用Token
            [
                'type' => AccessTokenType::User->value,
                'name' => '用户通用Token',
                'description' => '用于用户访问所有模型的API Token',
                'models' => 'all',
                'tokenValue' => env('UNIT_TEST_USER_TOKEN', ''),
                'user_id' => 'default_user',
                'total_amount' => 9999999,
            ],
            // 应用通用Token
            [
                'type' => AccessTokenType::Application->value,
                'name' => '应用通用Token',
                'description' => '用于应用程序访问所有模型的API Token',
                'models' => 'all',
                'tokenValue' => env('MAGIC_ACCESS_TOKEN', ''),
                'app_code' => 'default_app',
                'app_name' => '默认应用',
                'app_description' => '系统默认创建的应用',
                'total_amount' => 9999999,
                'user_id' => 'default_user',
            ],
        ];

        foreach ($tokenConfigs as $config) {
            try {
                $this->createOrUpdateToken($dataIsolation, $config);
            } catch (Throwable $e) {
                $this->logger->error(sprintf(
                    '初始化访问令牌失败: %s, name: %s file:%s line:%s trace:%s',
                    $e->getMessage(),
                    $config['name'],
                    $e->getFile(),
                    $e->getLine(),
                    $e->getTraceAsString()
                ));

                // 如果不是继续执行模式，则抛出异常终止执行
                if (! $continueOnError) {
                    $this->logger->error('遇到错误终止执行，如需忽略错误继续执行请使用 --continue-on-error 选项');
                    throw $e;
                }
            }
        }

        $this->logger->info('访问令牌初始化完成');
    }

    /**
     * 创建或更新访问令牌.
     */
    protected function createOrUpdateToken(LLMDataIsolation $dataIsolation, array $config): void
    {
        // 检查是否已存在同名token
        $existingToken = $this->accessTokenRepository->getByName($dataIsolation, $config['name']);

        if ($existingToken !== null) {
            $this->logger->info(sprintf(
                'ModelGateway Token 名称：%s 已存在，跳过初始化',
                $config['name']
            ));
            return;
        }

        // 获取token值
        $tokenValue = $config['tokenValue'] ?? '10086';
        if (empty($tokenValue) && $config['type'] === AccessTokenType::Application->value) {
            $tokenValue = Uuid::uuid4()->toString();
        }

        // 创建访问令牌
        $accessToken = new AccessTokenEntity();
        $accessToken->setAccessToken($tokenValue);
        $accessToken->setType(AccessTokenType::from($config['type']));
        $accessToken->setName($config['name']);
        $accessToken->setDescription($config['description']);
        $accessToken->setModels([$config['models']]);
        $accessToken->setIpLimit([]);
        $accessToken->setTotalAmount($config['total_amount']);
        $accessToken->setUseAmount(0);
        $accessToken->setRpm(0);
        $accessToken->setOrganizationCode('default');
        $accessToken->setCreator('system');
        $accessToken->setModifier('system');
        $accessToken->setCreatedAt(new DateTime());
        $accessToken->setUpdatedAt(new DateTime());

        // 处理关联ID
        if ($config['type'] === AccessTokenType::Application->value) {
            $applicationEntity = $this->getOrCreateApplication($dataIsolation, $config);
            $accessToken->setRelationId($applicationEntity->getCode());
        } else {
            $accessToken->setRelationId('system');
        }

        // 保存到数据库
        $savedToken = $this->accessTokenRepository->save($dataIsolation, $accessToken);

        $this->logger->info(sprintf(
            '初始化 ModelGateway Token，类型：%s，名称：%s，Token: %s',
            $config['type'],
            $config['name'],
            $savedToken->getAccessToken()
        ));
    }

    /**
     * 获取或创建应用.
     */
    protected function getOrCreateApplication(LLMDataIsolation $dataIsolation, array $config): ApplicationEntity
    {
        $continueOnError = $this->input->getOption('continue-on-error');

        try {
            // 检查应用是否已存在
            $existingApp = $this->applicationRepository->getByCode($dataIsolation, $config['app_code']);

            if ($existingApp !== null) {
                $this->logger->info(sprintf(
                    '应用 代码：%s 已存在，跳过初始化',
                    $config['app_code']
                ));
                return $existingApp;
            }

            // 创建新应用
            $application = new ApplicationEntity();
            $application->setCode($config['app_code']);
            $application->setName($config['app_name']);
            $application->setDescription($config['app_description']);
            $application->setOrganizationCode('default');
            $application->setCreator('system');
            $application->setModifier('system');
            $application->setCreatedAt(new DateTime());
            $application->setUpdatedAt(new DateTime());

            // 保存应用
            $savedApp = $this->applicationRepository->save($dataIsolation, $application);

            $this->logger->info(sprintf(
                '初始化应用，代码：%s，名称：%s',
                $savedApp->getCode(),
                $savedApp->getName()
            ));

            return $savedApp;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '初始化应用失败: %s, app_code: %s file:%s line:%s trace:%s',
                $e->getMessage(),
                $config['app_code'],
                $e->getFile(),
                $e->getLine(),
                $e->getTraceAsString()
            ));

            // 如果不是继续执行模式，则抛出异常终止执行
            if (! $continueOnError) {
                $this->logger->error('遇到错误终止执行，如需忽略错误继续执行请使用 --continue-on-error 选项');
                throw $e;
            }

            throw $e; // 即使是继续执行模式，这里也需要向上抛异常，因为调用方需要应用实体对象
        }
    }

    /**
     * 初始化模型配置数据.
     */
    protected function initModelConfigs(): void
    {
        $this->logger->info('开始初始化模型配置数据');

        $dataIsolation = new LLMDataIsolation('system', 'default');
        $continueOnError = $this->input->getOption('continue-on-error');

        // 模型基础配置
        $modelBaseConfigs = [
            'deepseek-v3' => [
                'model' => 'ep-20250222192351-h5g65',
                'type' => 'deepseek-v3',
                'name' => '火山的deepseek-v3',
                'implementation' => '\Hyperf\Odin\Model\DoubaoModel',
                'implementation_config' => [
                    'base_url' => 'ModelGateWayHost|http://127.0.0.1:9503',
                    'api_key' => 'SKYLARK_PRO_API_KEY|unit_test',
                    'model' => 'deepseek-v3',
                ],
            ],
            'local-gemma2-2b' => [
                'model' => 'local-gemma2-2b',
                'type' => 'local-gemma2-2b',
                'name' => 'local-gemma2-2b',
                'id' => 47,
                'rpm' => 1000,
                'implementation' => '\Hyperf\Odin\Model\DoubaoModel',
                'implementation_config' => [
                    'base_url' => 'ModelGateWayHost|http://127.0.0.1:9503',
                    'api_key' => 'SKYLARK_PRO_API_KEY|unit_test',
                    'model' => 'local-gemma2-2b',
                ],
            ],
            'gpt-4o' => [
                'model' => 'gpt-4o-global',
                'type' => 'gpt-4o',
                'name' => 'gpt-4o',
                'id' => 728192245266141184,
                'implementation' => '\Hyperf\Odin\Model\AzureOpenAIModel',
                'implementation_config' => [
                    'api_key' => 'AZURE_OPENAI_4O_API_KEY|unit_test',
                    'api_base' => 'ModelGateWayHost|http://127.0.0.1:9503',
                    'api_version' => 'AZURE_OPENAI_4O_API_VERSION|2024-10-21',
                    'deployment_name' => 'AZURE_OPENAI_4O_DEPLOYMENT_NAME|unit_test',
                ],
            ],
            'gpt-4o-mini' => [
                'model' => 'gpt-4o-mini-global',
                'type' => 'gpt-4o-mini',
                'name' => 'gpt-4o-mini',
                'id' => 728301272608460800,
                'implementation' => '\Hyperf\Odin\Model\AzureOpenAIModel',
                'implementation_config' => [
                    'api_key' => 'AZURE_OPENAI_4O_API_KEY|unit_test',
                    'api_base' => 'ModelGateWayHost|http://127.0.0.1:9503',
                    'api_version' => 'AZURE_OPENAI_4O_API_VERSION|2024-10-21',
                    'deployment_name' => 'AZURE_OPENAI_4O_MINI_DEPLOYMENT_NAME|unit_test',
                ],
            ],
            'deepseek-r1' => [
                'model' => 'ep-20250205161348-4nxnn',
                'type' => 'deepseek-r1',
                'name' => '火山的deepseek-r1',
                'id' => 745679428835708928,
                'implementation' => '\Hyperf\Odin\Model\DoubaoModel',
                'implementation_config' => [
                    'base_url' => 'ModelGateWayHost|http://127.0.0.1:9503',
                    'api_key' => 'SKYLARK_PRO_API_KEY|unit_test',
                    'model' => 'deepseek-r1',
                ],
            ],
            'text-embedding-3-small' => [
                'model' => 'text-embedding-3-small',
                'type' => 'text-embedding-3-small',
                'name' => '微软的text-embedding-3-small',
                'id' => 756574747410190336,
                'rpm' => 1000,
                'implementation' => '\Hyperf\Odin\Model\AzureOpenAIModel',
                'implementation_config' => [
                    'api_key' => 'AZURE_OPENAI_4O_API_KEY|unit_test',
                    'api_base' => 'ModelGateWayHost|http://127.0.0.1:9503',
                    'api_version' => 'AZURE_OPENAI_4O_API_VERSION|2024-10-21',
                    'deployment_name' => 'AZURE_OPENAI_TEXT_EMBEDDING_DEPLOYMENT_NAME|unit_test',
                ],
            ],
        ];

        // 通用默认配置
        $defaultConfig = [
            'enabled' => true,
            'total_amount' => 5000000.000000,
            'use_amount' => 0.0,
            'rpm' => 0,
            'exchange_rate' => 7.40,
            'input_cost_per_1000' => 0.001500,
            'output_cost_per_1000' => 0.002000,
            'created_at' => new DateTime(),
            'updated_at' => new DateTime(),
        ];

        // 创建模型
        $count = 0;
        foreach ($modelBaseConfigs as $baseConfig) {
            try {
                // 检查模型是否已存在
                $exists = Db::table('magic_api_model_configs')
                    ->where('model', $baseConfig['model'])
                    ->exists();

                if ($exists) {
                    $this->logger->info(sprintf('模型已存在，跳过初始化: %s', $baseConfig['name']));
                    continue;
                }

                // 合并基础配置和默认配置
                $configData = array_merge($defaultConfig, $baseConfig);

                // 创建 ModelConfigEntity 实体
                $modelConfigEntity = new ModelConfigEntity();

                if (isset($configData['id'])) {
                    $modelConfigEntity->setId((int) $configData['id']);
                }

                $modelConfigEntity->setModel($configData['model']);
                $modelConfigEntity->setType($configData['type']);
                $modelConfigEntity->setName($configData['name']);
                $modelConfigEntity->setEnabled((bool) $configData['enabled']);
                $modelConfigEntity->setTotalAmount((float) $configData['total_amount']);
                $modelConfigEntity->setUseAmount((float) $configData['use_amount']);
                $modelConfigEntity->setRpm((int) $configData['rpm']);
                $modelConfigEntity->setExchangeRate((float) $configData['exchange_rate']);
                $modelConfigEntity->setInputCostPer1000((float) $configData['input_cost_per_1000']);
                $modelConfigEntity->setOutputCostPer1000((float) $configData['output_cost_per_1000']);
                $modelConfigEntity->setImplementation($configData['implementation']);
                $modelConfigEntity->setImplementationConfig($configData['implementation_config']);

                if ($configData['created_at'] instanceof DateTime) {
                    $modelConfigEntity->setCreatedAt($configData['created_at']);
                }
                if ($configData['updated_at'] instanceof DateTime) {
                    $modelConfigEntity->setUpdatedAt($configData['updated_at']);
                }

                // 使用仓储保存模型配置
                $this->modelConfigRepository->save($dataIsolation, $modelConfigEntity);

                ++$count;

                $this->logger->info(sprintf('成功初始化模型: %s', $configData['name']));
            } catch (Throwable $e) {
                $this->logger->error(sprintf(
                    '初始化模型配置失败: %s, model: %s  file:%s line:%s  trace:%s',
                    $e->getMessage(),
                    $baseConfig['model'],
                    $e->getFile(),
                    $e->getLine(),
                    $e->getTraceAsString()
                ));

                // 如果不是继续执行模式，则抛出异常终止执行
                if (! $continueOnError) {
                    $this->logger->error('遇到错误终止执行，如需忽略错误继续执行请使用 --continue-on-error 选项');
                    throw $e;
                }
            }
        }

        $this->logger->info(sprintf('成功初始化 %d 条模型配置数据', $count));
    }

    /**
     * 执行所有数据库种子.
     */
    protected function runAllDbSeeders(): void
    {
        $this->logger->info('开始执行所有数据库种子');
        $continueOnError = $this->input->getOption('continue-on-error');

        try {
            // 使用命令执行器执行db:seed命令
            $command = 'php bin/hyperf.php db:seed --force';
            $process = proc_open($command, [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ], $pipes);

            if (is_resource($process)) {
                $output = stream_get_contents($pipes[1]);
                $error = stream_get_contents($pipes[2]);
                fclose($pipes[0]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $exitCode = proc_close($process);

                if ($exitCode === 0) {
                    $this->logger->info('所有数据库种子执行完成');
                    if (! empty($output)) {
                        $this->logger->info('输出: ' . $output);
                    }
                } else {
                    $errorMessage = '数据库种子执行失败';
                    if (! empty($error)) {
                        $errorMessage .= "\n错误信息: " . $error;
                        $this->logger->error($error);
                    }
                    if (! empty($output)) {
                        $errorMessage .= "\n输出信息: " . $output;
                        $this->logger->error($output);
                    }

                    // 如果不是继续执行模式，则抛出异常终止执行
                    if (! $continueOnError) {
                        throw new RuntimeException($errorMessage);
                    }
                }
            } else {
                $errorMessage = '无法启动执行数据库种子的进程';
                $this->logger->error($errorMessage);

                // 如果不是继续执行模式，则抛出异常终止执行
                if (! $continueOnError) {
                    throw new RuntimeException($errorMessage);
                }
            }
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '执行数据库种子失败: %s, file:%s line:%s trace:%s',
                $e->getMessage(),
                $e->getFile(),
                $e->getLine(),
                $e->getTraceAsString()
            ));
            throw $e;
        }
    }
}
