<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Bootstrap\Facade;

use App\Application\Bootstrap\Service\BootstrapInitializationAppService;
use App\Application\Bootstrap\Service\BootstrapStatusService;
use App\Application\Bootstrap\ValueObject\BootstrapStatus;
use App\Application\ModelGateway\Service\LLMTestAppService;
use App\Application\ModelGateway\Service\OfficialVideoProviderInitAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Bootstrap\DTO\Request\BootstrapExecuteRequestDTO;
use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use JsonException;

/**
 * 项目启动后数据初始化 API.
 */
#[ApiResponse(version: 'low_code')]
class BootstrapApi extends AbstractApi
{
    #[Inject]
    protected BootstrapInitializationAppService $bootstrapInitializationAppService;

    #[Inject]
    protected LLMTestAppService $llmTestAppService;

    #[Inject]
    protected OfficialVideoProviderInitAppService $officialVideoProviderInitAppService;

    public function __construct(
        RequestInterface $request,
        protected readonly BootstrapStatusService $bootstrapStatusService,
    ) {
        parent::__construct($request);
    }

    /**
     * 检查是否已初始化.
     */
    public function checkStatus(RequestInterface $request): array
    {
        $status = $this->bootstrapStatusService->getStatus();

        return [
            'status' => $status->value,
            'need_initial' => $status->needInitial(),
            'allow_bootstrap_execute' => $status->allowExecute(),
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

    /**
     * 初始化官方视频 providers.
     *
     * @return array{count: int, skipped: bool, message: string}
     */
    public function initializeVideoProviders(): array
    {
        $this->assertVideoProviderInitAccess();

        return $this->officialVideoProviderInitAppService->initializeWithProviders(
            $this->decodeVideoProviderSeedsFromRequestBody()
        );
    }

    protected function assertBootstrapPending(): void
    {
        $status = $this->bootstrapStatusService->getStatus();
        if ($status->allowExecute()) {
            return;
        }

        $message = $status === BootstrapStatus::Legacy
            ? 'bootstrap is not available for legacy environment'
            : 'bootstrap has already been initialized';

        ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, $message);
    }

    protected function isBootstrapPending(): bool
    {
        return $this->bootstrapStatusService->getStatus()->needInitial();
    }

    /**
     * @return array<string, mixed>|list<array<string, mixed>>
     */
    private function decodeVideoProviderSeedsFromRequestBody(): array
    {
        $providersJson = trim($this->request->getBody()->getContents());
        if ($providersJson === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'providers json is required');
        }

        try {
            $decoded = json_decode($providersJson, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'invalid providers json: ' . $exception->getMessage(),
                throwable: $exception
            );
        }

        if (! is_array($decoded)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'providers json must decode to an array');
        }

        return $decoded;
    }

    private function assertVideoProviderInitAccess(): void
    {
        $authorization = $this->getAuthorization();
        if (! $authorization instanceof MagicUserAuthorization) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'access_denied');
        }

        if (OfficialOrganizationUtil::isOfficialOrganization($authorization->getOrganizationCode())) {
            return;
        }

        ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'access_denied');
    }
}
