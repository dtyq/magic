<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Bootstrap\Facade;

use App\Application\Bootstrap\Service\BootstrapInitializationAppService;
use App\Application\Kernel\Service\MagicSettingAppService;
use App\Application\ModelGateway\Service\LLMTestAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Bootstrap\DTO\Request\BootstrapExecuteRequestDTO;
use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 项目启动后数据初始化 API.
 */
#[ApiResponse(version: 'low_code')]
class BootstrapApi
{
    #[Inject]
    protected BootstrapInitializationAppService $bootstrapInitializationAppService;

    #[Inject]
    protected LLMTestAppService $llmTestAppService;

    public function __construct(
        protected readonly RequestInterface $request,
        protected readonly MagicSettingAppService $magicSettingAppService,
    ) {
    }

    /**
     * 检查是否已初始化.
     */
    public function checkStatus(RequestInterface $request): array
    {
        return [
            'need_initial' => $this->magicSettingAppService->getWithoutCache()->isNeedInitial(),
        ];
    }

    /**
     * 执行初始化.
     */
    public function execute(RequestInterface $request): array
    {
        $this->assertBootstrapPending();

        $requestDTO = BootstrapExecuteRequestDTO::fromRequest($this->request);

        return $this->bootstrapInitializationAppService->initialize($requestDTO);
    }

    /**
     * 模型连通性测试（按配置，无需已保存的 model_id）.
     */
    public function llmConnectivityTest()
    {
        $this->assertBootstrapPending();

        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        $authorization = new MagicUserAuthorization();
        $authorization->setId('system');
        $authorization->setOrganizationCode($officialOrganizationCode);

        $connectivityTestByConfigRequest = ConnectivityTestByConfigRequest::fromRequest($this->request);

        return $this->llmTestAppService->connectivityTestByConfig($connectivityTestByConfigRequest, $authorization);
    }

    protected function assertBootstrapPending(): void
    {
        if (! ($this->checkStatus($this->request)['need_initial'] ?? false)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'bootstrap has already been initialized');
        }
    }
}
