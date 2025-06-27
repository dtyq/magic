<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition\VolcengineStandardClient;
use DateTime;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class SpeechToTextStandardAppService
{
    protected LoggerInterface $logger;

    protected VolcengineStandardClient $volcengineClient;

    public function __construct(protected readonly AccessTokenDomainService $accessTokenDomainService)
    {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(self::class);
        $this->volcengineClient = new VolcengineStandardClient();
    }

    /**
     * 提交语音识别任务
     */
    public function submitTask(SpeechSubmitDTO $submitDTO): array
    {
        // 验证访问令牌
        $this->validateAccessToken($submitDTO->getAccessToken(), $submitDTO->getIps());

        $this->logger->info('提交语音识别任务', [
            'audio_url' => $submitDTO->getAudio()->getUrl(),
            'user_uid' => $submitDTO->getUser()->getUid(),
        ]);

        // 调用基础设施层
        return $this->volcengineClient->submitTask($submitDTO);
    }

    /**
     * 查询语音识别结果.
     */
    public function queryResult(SpeechQueryDTO $queryDTO): array
    {
        // 验证访问令牌
        $this->validateAccessToken($queryDTO->getAccessToken(), $queryDTO->getIps());

        $this->logger->info('查询语音识别结果', [
            'task_id' => $queryDTO->getTaskId(),
        ]);

        // 调用基础设施层
        return $this->volcengineClient->queryResult($queryDTO);
    }

    /**
     * 验证访问令牌.
     */
    private function validateAccessToken(string $accessToken, array $clientIps): AccessTokenEntity
    {
        $accessTokenEntity = $this->accessTokenDomainService->getByAccessToken($accessToken);
        if (! $accessTokenEntity) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_NOT_EXIST);
        }

        // 检查IP和过期时间
        $accessTokenEntity->checkIps($clientIps);
        $accessTokenEntity->checkExpiredTime(new DateTime());

        return $accessTokenEntity;
    }
}
