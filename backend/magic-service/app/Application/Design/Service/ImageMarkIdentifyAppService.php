<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Design\Entity\ValueObject\ImageMarkIdentifyType;
use App\Domain\Design\Factory\PathFactory;
use App\ErrorCode\DesignErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Domain\File\Service\FileDomainService;
use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Message\UserMessage;
use Hyperf\Odin\Message\UserMessageContent;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

/**
 * 图片标记位置识别应用服务
 */
class ImageMarkIdentifyAppService extends DesignAppService
{
    protected readonly LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly MicroAgentFactory $microAgentFactory,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 识别图片标记位置的内容.
     *
     * @param Authenticatable $authenticatable 用户认证信息
     * @param int $projectId 项目ID
     * @param string $filePath 图片文件路径（相对路径）
     * @param ImageMarkIdentifyType $type 标记类型：MARK=点标记，AREA=区域框选
     * @param null|int $number 标记编号（可选）
     * @param null|array $mark 标记坐标，格式为 [x, y]，值为百分比（0-1之间）
     * @param null|array $area 区域坐标，格式为 [x, y, w, h]，值为百分比或像素
     * @return array 识别结果，格式：['suggestion' => '简短描述', 'suggestions' => [...多层级结果]]
     */
    public function identifyImageMark(Authenticatable $authenticatable, int $projectId, string $filePath, ImageMarkIdentifyType $type, ?int $number = null, ?array $mark = null, ?array $area = null): array
    {
        $dataIsolation = $this->createDesignDataIsolation($authenticatable);

        // 1. 检查项目是否存在
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_mark_identify.project_not_exists', ['project_id' => $projectId]);
        }

        // 2. 验证项目权限（至少需要查看权限）
        $this->validateRoleHigherOrEqual($dataIsolation, $project, MemberRole::VIEWER);

        // 3. 检测是否为临时文件（格式：组织/应用/...）
        $filePrefix = $this->fileDomainService->getFullPrefix($dataIsolation->getCurrentOrganizationCode());
        $isTemporaryFile = str_starts_with($filePath, $filePrefix);

        // 4. 根据文件类型获取图片URL
        if ($isTemporaryFile) {
            // 临时文件：直接使用 Private bucket 获取链接
            $imageUrl = $this->fileDomainService->getLink(
                $dataIsolation->getCurrentOrganizationCode(),
                $filePath,
                StorageBucketType::Private,
                options: [
                    'image' => ImageProcessOptions::fromString('quality=90&format=webp'),
                ]
            )?->getUrl();
        } else {
            // 普通文件：构建完整文件路径并验证文件是否存在
            $workspacePrefix = PathFactory::getWorkspacePrefix($filePrefix, $projectId);

            // 处理路径拼接：确保 workspacePrefix 和 filePath 之间有且仅有一个 /
            $needsSlash = ! str_ends_with($workspacePrefix, '/') && ! str_starts_with($filePath, '/');
            $fullFilePath = $workspacePrefix . ($needsSlash ? '/' : '') . $filePath;

            $taskFile = $this->taskFileDomainService->getByFileKey($fullFilePath);
            if (! $taskFile || $taskFile->getIsDirectory()) {
                ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_mark_identify.file_not_exists', ['file_path' => $filePath]);
            }

            $imageUrl = $this->fileDomainService->getLink(
                $dataIsolation->getCurrentOrganizationCode(),
                $fullFilePath,
                StorageBucketType::SandBox,
                options: [
                    'image' => ImageProcessOptions::fromString('quality=90&format=webp'),
                ]
            )?->getUrl();
        }

        if (empty($imageUrl)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_mark_identify.cannot_get_image_url', ['file_path' => $filePath]);
        }

        // 5. 获取视觉识别 MicroAgent
        $agentFilePath = BASE_PATH . '/app/Application/Design/MicroAgent/ImageMarkIdentifier.agent.yaml';
        $identifierAgent = $this->microAgentFactory->getAgent('ImageMarkIdentifier', $agentFilePath);

        if (! $identifierAgent->isEnabled()) {
            $this->logger->warning('Image mark identifier agent is disabled');
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'design.image_mark_identify.agent_disabled');
        }

        // 6. 构建用户提示词（根据 type 和文件类型）
        $userPrompt = $type->buildPrompt($isTemporaryFile, $number, $mark, $area);

        try {
            // 7. 创建 ModelGateway 数据隔离
            $modelGatewayDataIsolation = $this->createModelGatewayDataIsolation($dataIsolation);

            // 8. 调用视觉模型进行识别
            $userMessage = new UserMessage();
            $userMessage->addContent(UserMessageContent::imageUrl($imageUrl));
            $userMessage->addContent(UserMessageContent::text($userPrompt));

            $response = $identifierAgent->easyCall(
                dataIsolation: $modelGatewayDataIsolation,
                userPrompt: $userMessage,
                businessParams: [
                    'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $dataIsolation->getCurrentUserId(),
                    'source_id' => 'design_image_mark_identify',
                ]
            );
        } catch (Throwable $throwable) {
            $this->logger->error('ImageMarkIdentificationFailed', [
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
                'project_id' => $projectId,
                'file_path' => $filePath,
                'type' => $type->value,
                'number' => $number,
                'mark' => $mark,
                'area' => $area,
            ]);
            return [
                'suggestion' => '',
                'suggestions' => [],
            ];
        }

        // 9. 提取识别结果
        return $this->extractIdentificationResult($response);
    }

    /**
     * 提取识别结果.
     *
     * @return array ['suggestion' => string, 'suggestions' => array]
     */
    private function extractIdentificationResult(ChatCompletionResponse $response): array
    {
        $choice = $response->getFirstChoice();
        if (! $choice) {
            $this->logger->warning('No response choice available');
            return [
                'suggestion' => '',
                'suggestions' => [],
            ];
        }

        $content = $choice->getMessage()->getContent();
        if ($content === '') {
            $this->logger->warning('Empty content in response');
            return [
                'suggestion' => '',
                'suggestions' => [],
            ];
        }

        // 尝试从返回内容中提取 JSON
        if (preg_match('/\{[\s\S]*\}/', $content, $matches)) {
            $jsonStr = $matches[0];

            // 处理模型返回的分数表达式（如 406/1000）转换为小数
            $jsonStr = preg_replace_callback('/(\d+)\/(\d+)/', function ($matches) {
                $numerator = (float) $matches[1];
                $denominator = (float) $matches[2];
                return $denominator > 0 ? ($numerator / $denominator) : '0';
            }, $jsonStr);

            $parsed = json_decode($jsonStr, true);

            if ($parsed && isset($parsed['suggestions']) && is_array($parsed['suggestions'])) {
                // 归一化 bbox 坐标：处理未归一化的值（如 57 转换为 0.57）
                foreach ($parsed['suggestions'] as &$item) {
                    if (isset($item['bbox']) && is_array($item['bbox'])) {
                        $bbox = &$item['bbox'];
                        foreach (['x', 'y', 'width', 'height'] as $key) {
                            if (isset($bbox[$key])) {
                                $value = (float) $bbox[$key];
                                // 如果值大于 1，说明是百分比形式（如 57 表示 57%），需要除以 100
                                if ($value > 1.0) {
                                    $bbox[$key] = $value / 100.0;
                                } elseif ($value < 0.0) {
                                    $bbox[$key] = 0.0;
                                } else {
                                    $bbox[$key] = $value;
                                }
                                // 确保最终值在 0-1 范围内
                                if ($bbox[$key] > 1.0) {
                                    $bbox[$key] = 1.0;
                                }
                            }
                        }
                    }
                }
                unset($item); // 解除引用

                // 提取 object 类型的 label 作为 suggestion（向后兼容）
                $objectLabel = '';
                foreach ($parsed['suggestions'] as $item) {
                    if (isset($item['kind']) && $item['kind'] === 'object' && isset($item['label'])) {
                        $objectLabel = $item['label'];
                        break;
                    }
                }

                return [
                    'suggestion' => $objectLabel,
                    'suggestions' => $parsed['suggestions'],
                ];
            }
        }

        // 如果无法解析 JSON，返回空结果
        $this->logger->warning('Cannot parse JSON from response', ['content' => $content]);
        return [
            'suggestion' => '',
            'suggestions' => [],
        ];
    }
}
