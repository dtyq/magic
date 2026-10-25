<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Task\Contract\SandboxRebuildPortInterface;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * 用 AgentAppService 既有的重启流程实现重建端口.
 *
 * 约束：
 * 1. 重建照常走温池。镜像发布会先把老 pod 删掉，剩下的交给正常初始化流程：
 *    探测到旧 pod 不存在后，温池守卫放行，直接领一个现成的 pod 挂载，
 *    比从零冷启动快得多。领到的池 pod 与目标镜像一致才可能被领走（领取条件
 *    就是镜像对），因此指定镜像时不会误领到别的版本。
 * 2. 重建结果必须校验。若命令行指定了镜像，重建后要回读话题落库的镜像；
 *    与指定值不一致说明网关没有采纳请求里的镜像（例如网关版本过旧），此时必须报错。
 *    否则命令会"成功"却没有换镜像，运维只能靠下一次 dry-run 才发觉。
 * 3. 删除必须幂等：清单里的 pod 可能已被 GC 或前一轮重启删掉，
 *    网关返回 NOT_FOUND 时视为已完成。
 */
readonly class AgentSandboxRebuildAdapter implements SandboxRebuildPortInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private AgentAppService $agentAppService,
        private AgentDomainService $agentDomainService,
        private TopicDomainService $topicDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    public function deleteSandbox(string $sandboxId): void
    {
        if ($sandboxId === '') {
            return;
        }

        try {
            $this->agentDomainService->stopSandbox($sandboxId);
        } catch (SandboxOperationException $e) {
            if (ResponseCode::isNotFound($e->getCode())) {
                $this->logger->info('[Sandbox][Restart] Sandbox already gone, nothing to delete', [
                    'sandbox_id' => $sandboxId,
                ]);
                return;
            }
            throw $e;
        }
    }

    public function rebuild(int $topicId, string $userId, string $organizationCode, ?SandboxImageTarget $images = null): string
    {
        $dataIsolation = DataIsolation::create($organizationCode, $userId);
        $dataIsolation->setThirdPartyOrganizationCode($organizationCode);

        $sandboxId = $this->agentAppService->restartSandbox($dataIsolation, $topicId, $images);
        $this->assertPinnedImageHonored($topicId, $images);

        return $sandboxId;
    }

    /**
     * 指定镜像时校验重建结果：话题落库的 sandbox_images 必须等于指定目标.
     *
     * 只在"指定了镜像且目标完整"时校验。目标完整是前提，否则无法判断"不一致"是网关
     * 没采纳，还是本来就没有可比的目标。
     *
     * 失败即抛异常：编排层会把该话题记成 FAIL 并以非零退出码收尾，这是有意为之——
     * 一次"看起来成功"的假重启比一次明确失败更难排查。
     */
    private function assertPinnedImageHonored(int $topicId, ?SandboxImageTarget $images): void
    {
        if ($images === null || ! $images->hasSpecifiedImages() || ! $images->isComplete()) {
            return;
        }

        $topic = $this->topicDomainService->getTopicById($topicId);
        $builtImages = $topic?->getSandboxImages();
        if ($images->matches($builtImages)) {
            $this->logger->info('[Sandbox][Restart] Rebuilt sandbox runs the specified images', [
                'topic_id' => $topicId,
                'target' => $images->describe(),
            ]);
            return;
        }

        $this->logger->error('[Sandbox][Restart] Rebuilt sandbox does not run the specified images', [
            'topic_id' => $topicId,
            'target' => $images->describe(),
            'built' => is_array($builtImages) ? $builtImages : null,
        ]);

        throw new SandboxOperationException(
            'Rebuild sandbox',
            sprintf(
                'sandbox rebuilt for topic %d but its images do not match the specified target (%s); '
                . 'check that the sandbox gateway honours images supplied in the create request',
                $topicId,
                $images->describe()
            )
        );
    }
}
