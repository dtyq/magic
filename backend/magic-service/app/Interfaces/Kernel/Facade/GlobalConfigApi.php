<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Facade;

use App\Application\Agent\Service\AgentAppService;
use App\Application\Bootstrap\Service\BootstrapStatusService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Application\File\Service\FileAppService;
use App\Application\Flow\Service\MagicFlowAppService;
use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\Service\MagicSettingAppService;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\LongTermMemory\Service\LongTermMemoryAppService;
use App\Application\MCP\Service\MCPServerAppService;
use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Domain\LongTermMemory\DTO\MemoryQueryDTO;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Infrastructure\Util\Redis\GlobalConfigCacheUtil;
use App\Interfaces\Agent\Assembler\AgentAssembler;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Flow\Assembler\ToolSet\MagicFlowToolSetAssembler;
use App\Interfaces\MCP\Assembler\MCPServerAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Coroutine\Parallel;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\Rule;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

#[ApiResponse('low_code')]
class GlobalConfigApi extends AbstractApi
{
    #[Inject]
    protected FileAppService $fileAppService;

    #[Inject]
    protected AgentAppService $agentAppService;

    #[Inject]
    protected MCPServerAppService $mcpServerAppService;

    #[Inject]
    protected MagicFlowAppService $magicFlowAppService;

    #[Inject]
    protected MagicUserContactAppService $userAppService;

    #[Inject]
    protected LongTermMemoryAppService $longTermMemoryAppService;

    #[Inject]
    protected ValidatorFactoryInterface $validator;

    #[Inject]
    protected RequestInterface $request;

    #[Inject]
    protected LoggerInterface $logger;

    #[Inject]
    protected Redis $redis;

    public function __construct(
        private readonly MagicSettingAppService $magicSettingAppService,
        private readonly BootstrapStatusService $bootstrapStatusService,
    ) {
    }

    public function getGlobalConfig(): array
    {
        $config = $this->magicSettingAppService->get();
        $result = $this->appendBootstrapState($config->toArray());

        // 合并平台设置
        try {
            /** @var PlatformSettingsAppService $platformSettingsAppService */
            $platformSettingsAppService = di(PlatformSettingsAppService::class);
            $platform = $platformSettingsAppService->get();
            $result = array_merge($result, self::platformSettingsToResponse($platform->toArray()));
        } catch (Throwable $e) {
            // 忽略平台设置异常，避免影响全局配置读取
        }

        return $result;
    }

    public function getAllGlobalConfig(): array
    {
        // Try to get from cache
        $cachedData = GlobalConfigCacheUtil::get(GlobalConfigCacheUtil::getGlobalConfigKey());
        if ($cachedData !== false) {
            $this->logger->info('Global config - cache hit');
            return $cachedData;
        }
        $result = [];
        // 合并平台设置
        try {
            /** @var PlatformSettingsAppService $platformSettingsAppService */
            $platformSettingsAppService = di(PlatformSettingsAppService::class);
            $parallel = new Parallel();

            $magicSettingAppService = $this->magicSettingAppService;

            $parallel->add(function () use ($magicSettingAppService) {
                $config = $magicSettingAppService->get();
                return $config->toArray();
            }, 'global_config');

            $parallel->add(function () use ($platformSettingsAppService) {
                $platform = $platformSettingsAppService->get();
                return self::platformSettingsToResponse($platform->toArray());
            }, 'platform_settings');

            $fileAppService = $this->fileAppService;
            $parallel->add(function () use ($fileAppService) {
                return $fileAppService->getDefaultIcons();
            }, 'defaultIcons');

            $parallel->add(function () use ($magicSettingAppService) {
                return $magicSettingAppService->getMenuModules();
            }, 'menu_modules');

            $result = $parallel->wait();
            $result['global_config'] = $this->appendBootstrapState((array) ($result['global_config'] ?? []));

            // Cache the result for 5 minutes (300 seconds) - longer TTL since it's global
            GlobalConfigCacheUtil::setGlobalConfig($result);
            $this->logger->info('Global config - cache miss, cached for 5 minutes');
        } catch (Throwable $e) {
            $this->logger->error($e->getMessage());
            // 忽略平台设置异常，避免影响全局配置读取
        }

        return $result;
    }

    # ## 性能优化版本,合并多个API为一个,减少前端HTTP的请求数量
    public function getGlobalDataQueries(): array
    {
        // Extract request data in parent coroutine before parallel execution
        // to avoid RequestContext access issues in child coroutines
        $authorization = $this->getAuthorization();
        $requestAll = $this->request->all();
        $withBuiltin = $requestAll['available_tool_sets_query']['with_builtin'] ?? false;
        $authorizationHeader = (string) $this->request->header('authorization');
        $queryType = $this->request->input('query_type', ['available_agents', 'available_mcp_servers', 'available_tool_sets', 'login_code', 'memory_list']);

        // Try to get from cache
        $cachedData = GlobalConfigCacheUtil::get(
            GlobalConfigCacheUtil::getGlobalDataQueriesKey($authorization->getId(), $withBuiltin, $queryType)
        );
        if ($cachedData !== false) {
            return $cachedData;
        }

        // Use parallel coroutines to improve performance
        try {
            $parallel = new Parallel();
            $timings = [];
            if (in_array('available_agents', $queryType)) {
                if (isset($requestAll['available_agents_query'])) {
                    $availableAgentsQuery = $requestAll['available_agents_query'];
                } else {
                    $availableAgentsQuery = [];
                }
                $agentAppService = $this->agentAppService;
                $parallel->add(function () use ($authorization, $availableAgentsQuery, &$timings, $agentAppService) {
                    $startTime = microtime(true);
                    $query = new MagicAgentQuery($availableAgentsQuery);
                    $query->setOrder(['id' => 'desc']);
                    $page = Page::createNoPage();
                    $data = $agentAppService->queriesAvailable($authorization, $query, $page);
                    $result = AgentAssembler::createAvailableList($page, $data['total'], $data['list'], $data['icons']);
                    $timings['available_agents'] = round((microtime(true) - $startTime) * 1000, 2);
                    return $result;
                }, 'available_agents');
            }
            if (in_array('available_mcp_servers', $queryType)) {
                if (isset($requestAll['available_mcp_servers_query'])) {
                    $availableMcpServersQuery = $requestAll['available_mcp_servers_query'];
                } else {
                    $availableMcpServersQuery = [];
                }
                $mcpServerAppService = $this->mcpServerAppService;
                $parallel->add(function () use ($authorization, $availableMcpServersQuery, &$timings, $mcpServerAppService) {
                    $startTime = microtime(true);
                    $query = new MCPServerQuery($availableMcpServersQuery);
                    $query->setEnabled(true);
                    $query->setOrder(['id' => 'desc']);
                    $page = Page::createNoPage();
                    $result = $mcpServerAppService->availableQueries($authorization, $query, $page);
                    $response = MCPServerAssembler::createSelectPageListDTO(
                        $result['total'],
                        $result['list'],
                        $page,
                        $result['icons'],
                        $result['validation_results'] ?? []
                    );
                    $timings['available_mcp_servers'] = round((microtime(true) - $startTime) * 1000, 2);
                    return $response;
                }, 'available_mcp_servers');
            }
            if (in_array('available_tool_sets', $queryType)) {
                $magicFlowAppService = $this->magicFlowAppService;
                $parallel->add(function () use ($authorization, $withBuiltin, &$timings, $magicFlowAppService) {
                    $startTime = microtime(true);
                    $result = $magicFlowAppService->queryToolSets($authorization, $withBuiltin);
                    $response = MagicFlowToolSetAssembler::createPageListDTO($result['total'], $result['list'], Page::createNoPage(), $result['users'], $result['icons']);
                    $timings['available_tool_sets'] = round((microtime(true) - $startTime) * 1000, 2);
                    return $response;
                }, 'available_tool_sets');
            }
            if (in_array('login_code', $queryType)) {
                $userAppService = $this->userAppService;
                $parallel->add(function () use ($authorizationHeader, &$timings, $userAppService) {
                    $startTime = microtime(true);
                    $magicEnvironmentEntity = $userAppService->getEnvByAuthorization($authorizationHeader);
                    $result = [
                        'login_code' => $magicEnvironmentEntity?->getEnvironmentCode(),
                    ];
                    $timings['login_code'] = round((microtime(true) - $startTime) * 1000, 2);
                    return $result;
                }, 'login_code');
            }
            if (in_array('memory_list', $queryType)) {
                if (isset($requestAll['memory_list_query'])) {
                    $memoryListQuery = $requestAll['memory_list_query'];
                } else {
                    // Extract memory list related parameters from flat request
                    $memoryListQuery = array_intersect_key($requestAll, array_flip(['status', 'enabled', 'page_token', 'page_size']));
                }
                $validator = $this->validator;
                $longTermMemoryAppService = $this->longTermMemoryAppService;
                $parallel->add(function () use ($authorization, $memoryListQuery, &$timings, $validator, $longTermMemoryAppService) {
                    $startTime = microtime(true);
                    $rules = [
                        'status' => 'array',
                        'status.*' => ['string', Rule::enum(MemoryStatus::class)],
                        'enabled' => 'boolean',
                        'page_token' => 'string',
                        'page_size' => 'integer|min:1|max:100',
                    ];

                    $validatorInstance = $validator->make($memoryListQuery, $rules);
                    if ($validatorInstance->fails()) {
                        throw new RuntimeException('Validation failed: ' . implode(',', $validatorInstance->errors()->keys()));
                    }
                    $validatedParams = $validatorInstance->validated();

                    $pageSize = empty($validatedParams['page_size']) ? 20 : $validatedParams['page_size'];
                    $status = empty($validatedParams['status']) ? null : $validatedParams['status'];
                    $enabled = array_key_exists('enabled', $validatedParams) ? $validatedParams['enabled'] : null;
                    $dto = new MemoryQueryDTO([
                        'orgId' => $authorization->getOrganizationCode(),
                        'appId' => AppCodeEnum::SUPER_MAGIC->value,
                        'userId' => $authorization->getId(),
                        'status' => $status,
                        'enabled' => $enabled,
                        'pageToken' => $validatedParams['page_token'] ?? null,
                        'limit' => (int) $pageSize,
                    ]);
                    $dto->parsePageToken();
                    $result = $longTermMemoryAppService->findMemories($dto);

                    // Sort by updated_at descending
                    if (isset($result['data']) && is_array($result['data'])) {
                        usort($result['data'], static function (array $a, array $b) {
                            $timeB = isset($b['updated_at']) && ! empty($b['updated_at']) ? strtotime($b['updated_at']) : 0;
                            $timeA = isset($a['updated_at']) && ! empty($a['updated_at']) ? strtotime($a['updated_at']) : 0;

                            if ($timeB === $timeA) {
                                return strcmp((string) ($b['id'] ?? ''), (string) ($a['id'] ?? ''));
                            }

                            return $timeB <=> $timeA;
                        });
                    }

                    $timings['memory_list'] = round((microtime(true) - $startTime) * 1000, 2);
                    return $result;
                }, 'memory_list');
            }
            $result = $parallel->wait();

            // Log performance metrics
            arsort($timings);
            $slowest = array_key_first($timings);
            $totalTime = array_sum($timings);
            $this->logger->info('Global data queries performance', [
                'timings_ms' => $timings,
                'total_time_ms' => round($totalTime, 2),
                'slowest' => $slowest,
                'slowest_time_ms' => $timings[$slowest] ?? 0,
                'user_id' => $authorization->getId(),
            ]);

            // Cache the result for 3 minutes (180 seconds)
            GlobalConfigCacheUtil::setGlobalDataQueries($authorization->getId(), $withBuiltin, $queryType, $result);
        } catch (Throwable $e) {
            // 忽略平台设置异常，避免影响全局配置读取
            $this->logger->error($e->getMessage());
            $result = [];
        }

        return $result;
    }

    public function getDefaultIcons()
    {
        return [
            'icons' => $this->fileAppService->getDefaultIcons(),
        ];
    }

    public function queriesAvailable()
    {
        /** @var MagicUserAuthorization $authentication */
        $authentication = $this->getAuthorization();
        $inputs = $this->request->all();
        $query = new MagicAgentQuery($inputs);
        $query->setOrder(['id' => 'desc']);
        $page = Page::createNoPage();
        $data = $this->agentAppService->queriesAvailable($authentication, $query, $page);
        return AgentAssembler::createAvailableList($page, $data['total'], $data['list'], $data['icons']);
    }

    public function availableQueries()
    {
        $authorization = $this->getAuthorization();
        $query = new MCPServerQuery($this->request->all());
        $query->setEnabled(true);
        $query->setOrder(['id' => 'desc']);
        $page = Page::createNoPage();
        $result = $this->mcpServerAppService->availableQueries($authorization, $query, $page);

        return MCPServerAssembler::createSelectPageListDTO(
            $result['total'],
            $result['list'],
            $page,
            $result['icons'],
            $result['validation_results'] ?? []
        );
    }

    /**
     * 查询可用工具集.
     */
    public function queryToolSets()
    {
        $withBuiltin = (bool) $this->request->input('with_builtin', true);
        $result = $this->magicFlowAppService->queryToolSets($this->getAuthorization(), $withBuiltin);
        return MagicFlowToolSetAssembler::createPageListDTO($result['total'], $result['list'], Page::createNoPage(), $result['users'], $result['icons']);
    }

    /**
     * 前端自身业务用，获取 authorization 对应的私有化识别码
     */
    public function authEnvironment(): array
    {
        $authorization = (string) $this->request->header('authorization');
        $magicEnvironmentEntity = $this->userAppService->getEnvByAuthorization($authorization);

        return [
            'login_code' => $magicEnvironmentEntity?->getEnvironmentCode(),
        ];
    }

    /**
     * 获取记忆列表.
     */
    public function getMemoryList(): array
    {
        $params = $this->request->all();
        $rules = [
            'status' => 'array',
            'status.*' => ['string', Rule::enum(MemoryStatus::class)],
            'enabled' => 'boolean',
            'page_token' => 'string',
            'page_size' => 'integer|min:1|max:100',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $pageSize = empty($validatedParams['page_size']) ? 20 : $validatedParams['page_size'];
        $status = empty($validatedParams['status']) ? null : $validatedParams['status'];
        $enabled = array_key_exists('enabled', $validatedParams) ? $validatedParams['enabled'] : null;
        $dto = new MemoryQueryDTO([
            'orgId' => $authorization->getOrganizationCode(),
            'appId' => AppCodeEnum::SUPER_MAGIC->value,
            'userId' => $authorization->getId(),
            'status' => $status,
            'enabled' => $enabled,
            'pageToken' => $validatedParams['page_token'] ?? null,
            'limit' => (int) $pageSize, // 传递原始页面大小，让应用服务层处理分页逻辑
        ]);
        // 解析 pageToken
        $dto->parsePageToken();
        $result = $this->longTermMemoryAppService->findMemories($dto);

        // 按更新时间降序排序（PHP 排序）
        if (isset($result['data']) && is_array($result['data'])) {
            usort($result['data'], static function (array $a, array $b) {
                $timeB = isset($b['updated_at']) && ! empty($b['updated_at']) ? strtotime($b['updated_at']) : 0;
                $timeA = isset($a['updated_at']) && ! empty($a['updated_at']) ? strtotime($a['updated_at']) : 0;

                if ($timeB === $timeA) {
                    return strcmp((string) ($b['id'] ?? ''), (string) ($a['id'] ?? ''));
                }

                return $timeB <=> $timeA;
            });
        }

        return $result;
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_MAINTENANCE, MagicOperationEnum::EDIT)]
    public function updateGlobalConfig(RequestInterface $request): array
    {
        $isMaintenance = (bool) $request->input('is_maintenance', false);
        $description = (string) $request->input('maintenance_description', '');

        $config = $this->magicSettingAppService->get();
        $config->setIsMaintenance($isMaintenance);
        $config->setMaintenanceDescription($description);

        $this->magicSettingAppService->save($config);

        return $this->appendBootstrapState($config->toArray());
    }

    public function getMenuModules(): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $this->request->getHeaderLine('organization-code') ?: $authorization->getOrganizationCode();
        $dataIsolation = new BaseDataIsolation(
            $organizationCode,
            $authorization->getId(),
            $authorization->getMagicId()
        );
        $organizationEntity = di(OrganizationAdminDomainService::class)->getOrganizationInfo($dataIsolation);
        $organizationType = $organizationEntity !== null
            ? OrganizationType::from($organizationEntity->getType())
            : OrganizationType::Team;

        return $this->magicSettingAppService->getAppMenuModules($organizationType);
    }

    /**
     * 校验请求参数.
     */
    protected function checkParams(array $params, array $rules, ?string $method = null): array
    {
        $validator = $this->validator->make($params, $rules);

        if ($validator->fails()) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'long_term_memory.api.validation_failed',
                ['errors' => implode(',', $validator->errors()->keys())]
            );
        }

        return $validator->validated();
    }

    private static function platformSettingsToResponse(array $settings): array
    {
        // 将 logo_urls 转换为前端示例结构
        $logo = [];
        foreach (($settings['logo_urls'] ?? []) as $locale => $url) {
            $logo[$locale] = $url;
        }
        $favicon = null;
        if (! empty($settings['favicon_url'] ?? '')) {
            $favicon = (string) $settings['favicon_url'];
        }
        $minimalLogo = null;
        if (! empty($settings['minimal_logo_url'] ?? '')) {
            $minimalLogo = (string) $settings['minimal_logo_url'];
        }
        $resp = [
            'logo' => $logo,
            'favicon' => $favicon,
            'minimal_logo' => $minimalLogo,
            'default_language' => (string) ($settings['default_language'] ?? 'zh_CN'),
            'footer' => PlatformSettings::fromArray($settings)->getFooter(),
        ];
        foreach (['name_i18n', 'title_i18n', 'keywords_i18n', 'description_i18n'] as $key) {
            if (isset($settings[$key])) {
                $resp[$key] = (array) $settings[$key];
            }
        }
        return $resp;
    }

    private function appendBootstrapState(array $result): array
    {
        $status = $this->bootstrapStatusService->getStatus();
        $result['bootstrap_status'] = $status->value;
        $result['need_initial'] = $status->needInitial();

        return $result;
    }
}
