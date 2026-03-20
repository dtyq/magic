package deployer

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/dtyq/magicrew-cli/util"
	corev1 "k8s.io/api/core/v1"
)

// spyLogger captures log messages for assertions.
type spyLogger struct {
	lines []string
}

func (s *spyLogger) Log(level util.LogLevel, tag string, entry util.LogEntry) {
	s.lines = append(s.lines, entry.ToString())
}

func (s *spyLogger) contains(substr string) bool {
	for _, l := range s.lines {
		if strings.Contains(l, substr) {
			return true
		}
	}
	return false
}

func spyLoggerGroup() (*spyLogger, util.LoggerGroup) {
	spy := &spyLogger{}
	return spy, util.LoggerGroup{spy}
}

// ── helpers ──────────────────────────────────────────────────────────────────

func podWithWaiting(reason string) corev1.Pod {
	return corev1.Pod{
		Status: corev1.PodStatus{
			Phase: corev1.PodPending,
			ContainerStatuses: []corev1.ContainerStatus{
				{State: corev1.ContainerState{
					Waiting: &corev1.ContainerStateWaiting{Reason: reason},
				}},
			},
		},
	}
}

func podWithInitWaiting(reason string) corev1.Pod {
	return corev1.Pod{
		Status: corev1.PodStatus{
			Phase: corev1.PodPending,
			InitContainerStatuses: []corev1.ContainerStatus{
				{State: corev1.ContainerState{
					Waiting: &corev1.ContainerStateWaiting{Reason: reason},
				}},
			},
		},
	}
}

func runningPod() corev1.Pod {
	return corev1.Pod{Status: corev1.PodStatus{Phase: corev1.PodRunning}}
}

func succeededPod() corev1.Pod {
	return corev1.Pod{Status: corev1.PodStatus{Phase: corev1.PodSucceeded}}
}

func podWithReadyCondition(status corev1.ConditionStatus) corev1.Pod {
	return corev1.Pod{
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			Conditions: []corev1.PodCondition{
				{Type: corev1.PodReady, Status: status},
			},
		},
	}
}

// ── podStatusSummary ─────────────────────────────────────────────────────────

func TestPodStatusSummary_ContainerWaiting(t *testing.T) {
	p := podWithWaiting("ImagePullBackOff")
	assert.Equal(t, "ImagePullBackOff", podStatusSummary(p))
}

func TestPodStatusSummary_InitContainerWaiting(t *testing.T) {
	p := podWithInitWaiting("ContainerCreating")
	assert.Equal(t, "Init:ContainerCreating", podStatusSummary(p))
}

func TestPodStatusSummary_NoWaitingFallsBackToPhase(t *testing.T) {
	assert.Equal(t, "Running", podStatusSummary(runningPod()))
}

func TestPodStatusSummary_PendingPhase(t *testing.T) {
	p := corev1.Pod{Status: corev1.PodStatus{Phase: corev1.PodPending}}
	assert.Equal(t, "Pending", podStatusSummary(p))
}

// ── isPodReady ────────────────────────────────────────────────────────────────

func TestIsPodReady_RunningAndReadyTrue(t *testing.T) {
	assert.True(t, isPodReady(podWithReadyCondition(corev1.ConditionTrue)))
}

func TestIsPodReady_RunningButReadyFalse(t *testing.T) {
	assert.False(t, isPodReady(podWithReadyCondition(corev1.ConditionFalse)))
}

func TestIsPodReady_PendingPhase(t *testing.T) {
	assert.False(t, isPodReady(corev1.Pod{Status: corev1.PodStatus{Phase: corev1.PodPending}}))
}

func TestIsPodReady_RunningNoReadyCondition(t *testing.T) {
	assert.False(t, isPodReady(runningPod()))
}

func TestIsPodReady_SucceededPod(t *testing.T) {
	assert.True(t, isPodReady(succeededPod()))
}

// ── podReadyStatus ────────────────────────────────────────────────────────────

func TestPodReadyStatus_ConditionTrue(t *testing.T) {
	assert.Equal(t, "True", podReadyStatus(podWithReadyCondition(corev1.ConditionTrue)))
}

func TestPodReadyStatus_ConditionFalse(t *testing.T) {
	assert.Equal(t, "False", podReadyStatus(podWithReadyCondition(corev1.ConditionFalse)))
}

func TestPodReadyStatus_NoCondition(t *testing.T) {
	assert.Equal(t, "Unknown", podReadyStatus(runningPod()))
}

func TestPodReadyStatus_SucceededPod(t *testing.T) {
	assert.Equal(t, "Completed", podReadyStatus(succeededPod()))
}

// ── newPodReporter ────────────────────────────────────────────────────────────

func TestNewPodReporter_EmptyPodsOutputsNoPods(t *testing.T) {
	spy, lg := spyLoggerGroup()
	reporter := newPodReporter(lg, "myapp")
	reporter([]corev1.Pod{})
	assert.True(t, spy.contains("(no pods yet)"), "expected '(no pods yet)' in output, got: %v", spy.lines)
}

func TestNewPodReporter_MixedReadyHeaderCount(t *testing.T) {
	spy, lg := spyLoggerGroup()
	reporter := newPodReporter(lg, "myapp")
	pods := []corev1.Pod{
		podWithReadyCondition(corev1.ConditionTrue),
		podWithReadyCondition(corev1.ConditionFalse),
	}
	reporter(pods)
	assert.True(t, spy.contains("1/2 ready"), "expected '1/2 ready' in output, got: %v", spy.lines)
}

func TestNewPodReporter_WaitingReasonAppears(t *testing.T) {
	spy, lg := spyLoggerGroup()
	reporter := newPodReporter(lg, "myapp")
	reporter([]corev1.Pod{podWithWaiting("CrashLoopBackOff")})
	assert.True(t, spy.contains("CrashLoopBackOff"), "expected 'CrashLoopBackOff' in output, got: %v", spy.lines)
}

func TestNewPodReporter_SucceededPodCountedAsReady(t *testing.T) {
	spy, lg := spyLoggerGroup()
	reporter := newPodReporter(lg, "myapp")
	reporter([]corev1.Pod{succeededPod(), podWithReadyCondition(corev1.ConditionTrue)})
	assert.True(t, spy.contains("2/2 ready"), "expected '2/2 ready' in output, got: %v", spy.lines)
}
