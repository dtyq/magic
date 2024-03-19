<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Executor\Aliyun;

use AlibabaCloud\SDK\FC\V20230330\Models\CreateFunctionInput;
use AlibabaCloud\SDK\FC\V20230330\Models\CreateFunctionRequest;
use AlibabaCloud\SDK\FC\V20230330\Models\CustomRuntimeConfig;
use AlibabaCloud\SDK\FC\V20230330\Models\Function_;
use AlibabaCloud\SDK\FC\V20230330\Models\GetFunctionRequest;
use AlibabaCloud\SDK\FC\V20230330\Models\InputCodeLocation;
use AlibabaCloud\SDK\FC\V20230330\Models\InvokeFunctionRequest;
use AlibabaCloud\SDK\FC\V20230330\Models\UpdateFunctionInput;
use AlibabaCloud\SDK\FC\V20230330\Models\UpdateFunctionRequest;
use AlibabaCloud\Tea\Exception\TeaError;
use Darabonba\OpenApi\Models\Config;
use Dtyq\CodeExecutor\Exception\ExecuteException;
use Dtyq\CodeExecutor\Exception\ExecuteFailedException;
use Dtyq\CodeExecutor\Exception\ExecuteTimeoutException;
use Dtyq\CodeExecutor\Exception\InvalidArgumentException;
use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\ExecutionResult;
use Dtyq\CodeExecutor\Executor\Aliyun\Exception\CreateFunctionException;
use Dtyq\CodeExecutor\Executor\Aliyun\Exception\FunctionNotFoundException;
use Dtyq\CodeExecutor\Executor\Aliyun\Exception\GetFunctionException;
use Dtyq\CodeExecutor\Executor\Aliyun\Exception\UpdateFunctionException;
use Dtyq\CodeExecutor\Language;
use Dtyq\CodeExecutor\Utils\CRC64;
use Dtyq\CodeExecutor\Utils\ZipUtils;
use GuzzleHttp\Psr7\BufferStream;
use Hyperf\Codec\Json;

use function Dtyq\CodeExecutor\Utils\parseExecutionResult;

class AliyunRuntimeClient
{
    private const MANAGED_BY = 'dtyq/code-executor';

    private const DEFAULT_CONFIG = [
        'function' => [
            'cpu' => 0.25,
            'disk_size' => 512,
            'memory_size' => 512,
            'instance_concurrency' => 1,
            'runtime' => 'custom.debian10',
            'timeout' => 60,
            'customer_runtime_config' => [
                'command' => ['bootstrap'],
                'port' => 9000,
            ],
            'layers' => [
                'acs:fc:cn-shenzhen:official:layers/PHP81-Debian10/versions/1',
            ],
            'environment_variables' => [
                'TZ' => 'Asia/Shanghai',
                'PATH' => '/opt/php8.1/bin:/opt/php8.1/sbin:/usr/local/bin/apache-maven/bin:/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/ruby/bin:/opt/bin:/code:/code/bin',
                'LD_LIBRARY_PATH' => '/code:/code/lib:/usr/local/lib:/opt/lib:/opt/php8.1/lib:/opt/php8.0/lib:/opt/php7.2/lib',
            ],
            'handler' => 'index.handler',
            'internet_access' => true,
            'code_package_path' => __DIR__ . '/../../../runner',
        ],
    ];

    /**
     * @var array<Language>
     */
    protected array $supportLanguages = [
        Language::PHP,
        Language::PYTHON,
    ];

    private FC $fcClient;

    private array $requiredConfigKeys = [
        'access_key', 'secret_key', 'region', 'endpoint',
    ];

    private ?InputCodeLocation $codePackageCache = null;

    public function __construct(private readonly array $config)
    {
        $this->initializeClient();
    }

    /**
     * @throws InvalidArgumentException
     * @throws CreateFunctionException
     * @throws UpdateFunctionException
     * @throws GetFunctionException
     */
    public function initialize(): void
    {
        if (empty($functionName = $this->config['function']['name'] ?? null)) {
            throw new InvalidArgumentException('Function name is required');
        }

        try {
            $function = $this->getFunction($functionName);

            if ($this->isFunctionNeedUpdate($function)) {
                $this->updateFunction($functionName);
            }
        } catch (FunctionNotFoundException $e) {
            $this->createFunction($functionName);
        }
    }

    /**
     * @throws ExecuteException
     * @throws ExecuteFailedException
     * @throws InvalidArgumentException
     * @throws ExecuteTimeoutException
     */
    public function invoke(ExecutionRequest $request): ExecutionResult
    {
        if (empty($functionName = $this->config['function']['name'] ?? null)) {
            throw new InvalidArgumentException('Function name is required');
        }

        $stream = new BufferStream();
        $stream->write(Json::encode($request));

        $response = $this->fcClient->invokeFunction($functionName, new InvokeFunctionRequest(['body' => $stream]));

        if (empty($body = (string) $response->body)) {
            throw new ExecuteFailedException('Failed to retrieve the result of the function call');
        }

        return parseExecutionResult($body);
    }

    public function getSupportedLanguages(): array
    {
        return $this->supportLanguages;
    }

    /**
     * @throws CreateFunctionException
     */
    public function createFunction(string $functionName): Function_
    {
        try {
            $input = new CreateFunctionInput();
            $this->prepareFunctionInput($functionName, $input);

            $response = $this->fcClient->createFunction(new CreateFunctionRequest(['body' => $input]));
            return $response->body;
        } catch (\Throwable $e) {
            throw new CreateFunctionException("Failed to create function: {$e->getMessage()}", previous: $e);
        }
    }

    /**
     * @throws UpdateFunctionException
     */
    public function updateFunction(string $functionName): Function_
    {
        try {
            $input = new UpdateFunctionInput();
            $this->prepareFunctionInput($functionName, $input);

            $response = $this->fcClient->updateFunction($functionName, new UpdateFunctionRequest(['body' => $input]));
            return $response->body;
        } catch (\Throwable $e) {
            throw new UpdateFunctionException("Failed to create function: {$e->getMessage()}", previous: $e);
        }
    }

    /**
     * @throws GetFunctionException
     * @throws FunctionNotFoundException
     */
    public function getFunction(string $functionName): Function_
    {
        try {
            $request = new GetFunctionRequest();
            $response = $this->fcClient->getFunction($functionName, $request);
            return $response->body;
        } catch (TeaError $e) {
            if ($e->getCode() == FunctionNotFoundException::CODE) {
                throw new FunctionNotFoundException($e->getMessage(), previous: $e);
            }
            throw new GetFunctionException("Failed to get the function: {$e->getMessage()}", previous: $e);
        }
    }

    /**
     * @throws InvalidArgumentException
     */
    private function prepareFunctionInput(string $functionName, CreateFunctionInput|UpdateFunctionInput $input): void
    {
        $config = $this->getFunctionConfig();

        $input->functionName = $functionName;
        $input->description = $this->encodeFunctionDesc($config);
        $input->code = $this->codePackageCache ?? $this->getCodePackage($config['code_package_path'] ?? '');
        $input->cpu = $config['cpu'] ?? 0.25;
        $input->diskSize = $config['disk_size'] ?? 512;
        $input->memorySize = $config['memory_size'] ?? 512;
        $input->instanceConcurrency = $config['instance_concurrency'] ?? 1;
        $input->runtime = $config['runtime'] ?? '';
        $input->timeout = $config['timeout'] ?? 60;
        $input->customRuntimeConfig = new CustomRuntimeConfig($config['customer_runtime_config'] ?? []);
        $input->layers = $config['layers'] ?? [];
        $input->environmentVariables = $config['environment_variables'] ?? [];
        $input->handler = $config['handler'] ?? 'index.handler';
        $input->internetAccess = $config['internet_access'] ?? false;
    }

    /**
     * 初始化阿里云客户端.
     */
    private function initializeClient(): void
    {
        foreach ($this->requiredConfigKeys as $key) {
            if (empty($this->config[$key])) {
                throw new \InvalidArgumentException(sprintf('"%s" is required.', $key));
            }
        }

        $config = new Config();
        $config->accessKeyId = $this->config['access_key'];
        $config->accessKeySecret = $this->config['secret_key'];
        $config->regionId = $this->config['region'];
        $config->endpoint = $this->config['endpoint'];

        $this->fcClient = new FC($config);
    }

    /**
     * @throws InvalidArgumentException
     */
    private function getCodePackage(string $codePackagePath): InputCodeLocation
    {
        if (! is_dir($codePackagePath)) {
            throw new InvalidArgumentException("The code package path not found: {$codePackagePath}");
        }

        $zipFile = ZipUtils::zipDirectory($codePackagePath);
        $fileContent = file_get_contents($zipFile);
        unlink($zipFile);

        return new InputCodeLocation([
            'zipFile' => base64_encode($fileContent),
            'checksum' => CRC64::calculate($fileContent),
        ]);
    }

    private function getFunctionConfig(): array
    {
        return array_replace_recursive(
            self::DEFAULT_CONFIG['function'],
            $this->config['function'] ?? []
        );
    }

    private function encodeFunctionDesc(array $config): string
    {
        ksort($config);
        return Json::encode([
            'managed-by' => self::MANAGED_BY,
            'md5' => md5(Json::encode($config)),
        ]);
    }

    /**
     * @throws InvalidArgumentException
     */
    private function isFunctionNeedUpdate(Function_ $function): bool
    {
        if (empty($desc = Json::decode((string) $function->description))) {
            return true;
        }

        // 检查是否被管理
        if ($desc['managed-by'] !== self::MANAGED_BY) {
            throw new InvalidArgumentException('The function ' . $function->functionName . ' is exists! but not managed by ' . self::MANAGED_BY);
        }

        $config = $this->getFunctionConfig();
        // 检查配置是否有变更
        ksort($config);
        $configMd5 = md5(Json::encode($config));
        if ($configMd5 !== $desc['md5']) {
            return true;
        }

        // 检查代码包是否有变更
        $this->codePackageCache = $this->getCodePackage($config['code_package_path'] ?? '');
        if ($this->codePackageCache->checksum !== $function->codeChecksum) {
            return true;
        }

        return false;
    }
}
