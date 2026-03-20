package deployer

import (
	corev1 "k8s.io/api/core/v1"

	"github.com/dtyq/magicrew-cli/util"
)

// newPodReporter returns a reporter func suitable for passing to WaitForPodsReady.
// Each time it is called it prints the current pod list with phase and ready status.
func newPodReporter(log util.LoggerGroup, label string) func([]corev1.Pod) {
	return func(pods []corev1.Pod) {
		ready := 0
		for _, p := range pods {
			if isPodReady(p) {
				ready++
			}
		}

		log.Logd("wait", "[waiting] %s pods (%d/%d ready):", label, ready, len(pods))

		if len(pods) == 0 {
			log.Logd("wait", "  (no pods yet)")
			return
		}

		for _, p := range pods {
			log.Logd("wait", "  %-44s %-18s Ready=%s",
				p.Name,
				podStatusSummary(p),
				podReadyStatus(p),
			)
		}
	}
}

// podStatusSummary mirrors kubectl's STATUS column: shows container waiting
// reason (e.g. ImagePullBackOff, CrashLoopBackOff) when available, otherwise
// falls back to pod phase.
func podStatusSummary(p corev1.Pod) string {
	for _, cs := range p.Status.ContainerStatuses {
		if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
			return cs.State.Waiting.Reason
		}
	}
	for _, cs := range p.Status.InitContainerStatuses {
		if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
			return "Init:" + cs.State.Waiting.Reason
		}
	}
	return string(p.Status.Phase)
}

func isPodReady(p corev1.Pod) bool {
	if p.Status.Phase == corev1.PodSucceeded {
		return true
	}
	if p.Status.Phase != corev1.PodRunning {
		return false
	}
	for _, cond := range p.Status.Conditions {
		if cond.Type == corev1.PodReady {
			return cond.Status == corev1.ConditionTrue
		}
	}
	return false
}

func podReadyStatus(p corev1.Pod) string {
	if p.Status.Phase == corev1.PodSucceeded {
		return "Completed"
	}
	for _, cond := range p.Status.Conditions {
		if cond.Type == corev1.PodReady {
			if cond.Status == corev1.ConditionTrue {
				return "True"
			}
			return "False"
		}
	}
	return "Unknown"
}
