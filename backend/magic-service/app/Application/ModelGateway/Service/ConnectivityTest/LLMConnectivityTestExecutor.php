<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\ConnectivityTest;

use App\Domain\Provider\Service\ConnectivityTest\ConnectResponse;
use Throwable;

use function Hyperf\Translation\__;

/**
 * 编排 LLM 普通与多模态连通性测试的执行顺序和结果。
 */
final class LLMConnectivityTestExecutor
{
    /**
     * 执行普通文本及可选的多模态连通性测试。
     */
    public static function execute(
        callable $textConnectivityTest,
        bool $supportMultiModal,
        callable $multimodalConnectivityTest
    ): ConnectResponse {
        $connectResponse = new ConnectResponse();

        try {
            $textConnectivityTest();
        } catch (Throwable $throwable) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($throwable->getMessage());
            return $connectResponse;
        }

        if (! $supportMultiModal) {
            $connectResponse->setStatus(true);
            return $connectResponse;
        }

        try {
            $multimodalConnectivityTest();
        } catch (Throwable $throwable) {
            $reason = trim($throwable->getMessage());
            if ($reason === '') {
                $reason = __('service_provider.request_failed');
            }

            $connectResponse->setStatus(false);
            $connectResponse->setMessage(__(
                'service_provider.multimodal_connectivity_test_failed_after_text_success',
                ['reason' => $reason]
            ));
            return $connectResponse;
        }

        $connectResponse->setStatus(true);
        return $connectResponse;
    }
}
