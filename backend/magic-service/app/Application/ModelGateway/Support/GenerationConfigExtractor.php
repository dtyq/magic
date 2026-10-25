<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Support;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 通用提取器：把「提示词文件 + 用户内容」交给 agent，原样返回模型输出。
 *
 * 本类不感知任何业务域：不认识参数声明、不做结构转换、也不过滤键名，
 * 参数声明与业务提示词都由调用方拼装进用户内容，返回值的合法性由调用方自行校验。
 */
class GenerationConfigExtractor
{
    private const int MAX_ATTEMPTS = 2;

    protected readonly LoggerInterface $logger;

    public function __construct(
        private readonly MicroAgentFactory $microAgentFactory,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('GenerationConfigExtractor');
    }

    /**
     * @param string $agentName 提示词文件名，对应 Prompt/{name}.agent.yaml
     * @param string $userContent 用户内容（参数声明与业务提示词由调用方自行拼装）
     * @param bool $asArray true 时把输出里的 JSON 解析成数组，false 时返回模型原始文本
     * @return array<string, mixed>|string 失败时返回空数组（$asArray）或空字符串
     */
    public function extract(
        ModelGatewayDataIsolation $dataIsolation,
        string $agentName,
        string $userContent,
        bool $asArray = false,
    ): array|string {
        if (trim($userContent) === '') {
            return $asArray ? [] : '';
        }

        // 工厂内部会缓存实例，clone 避免污染缓存
        $agent = clone $this->microAgentFactory->getAgent($agentName);
        if (! $agent->isEnabled()) {
            return $asArray ? [] : '';
        }

        for ($attempt = 1; $attempt <= self::MAX_ATTEMPTS; ++$attempt) {
            try {
                $response = $agent->easyCall(
                    dataIsolation: $dataIsolation,
                    userPrompt: $userContent,
                );
                $content = (string) ($response->getFirstChoice()?->getMessage()?->getContent() ?? '');
                $result = $asArray ? $this->parseJson($content) : $content;
                if ($result !== [] && $result !== '') {
                    $this->logger->info('GenerationConfigExtracted', [
                        'agent' => $agentName,
                        'result' => $result,
                    ]);
                }
                return $result;
            } catch (Throwable $throwable) {
                $this->logger->warning('GenerationConfigExtractFailed', [
                    'agent' => $agentName,
                    'attempt' => $attempt,
                    'error' => $throwable->getMessage(),
                ]);
            }
        }

        return $asArray ? [] : '';
    }

    /**
     * 抠出回复里的第一个 JSON 对象并解码，不做任何键过滤。
     * @return array<string, mixed>
     */
    private function parseJson(string $content): array
    {
        if (preg_match('/\{.*\}/s', $content, $matches) !== 1) {
            return [];
        }

        $decoded = json_decode($matches[0], true);

        return is_array($decoded) ? $decoded : [];
    }
}
