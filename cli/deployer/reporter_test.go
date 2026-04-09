package deployer

import (
	"bytes"
	"fmt"
	"strings"
	"testing"

	"github.com/dtyq/magicrew-cli/util"
	"github.com/stretchr/testify/assert"
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

func withWaitOutputForTest(t *testing.T, w *bytes.Buffer, tty bool) {
	t.Helper()
	oldOut := waitOutput
	oldTTY := isWaitTTY
	waitOutput = w
	isWaitTTY = func() bool { return tty }
	t.Cleanup(func() {
		waitOutput = oldOut
		isWaitTTY = oldTTY
	})
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

func podNamedWithWaiting(name, reason string) corev1.Pod {
	p := podWithWaiting(reason)
	p.Name = name
	return p
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

func namedReadyPod(name string) corev1.Pod {
	p := podWithReadyCondition(corev1.ConditionTrue)
	p.Name = name
	return p
}

func namedNotReadyPod(name string) corev1.Pod {
	p := podWithReadyCondition(corev1.ConditionFalse)
	p.Name = name
	return p
}

func sixPodsObserving() []corev1.Pod {
	return []corev1.Pod{
		namedReadyPod("infra-a"),
		namedReadyPod("infra-b"),
		namedReadyPod("infra-c"),
		namedReadyPod("infra-d"),
		namedReadyPod("infra-e"),
		namedNotReadyPod("infra-f"),
	}
}

func podWithInitTerminatedReason(reason string, exitCode int32) corev1.Pod {
	return corev1.Pod{
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			InitContainerStatuses: []corev1.ContainerStatus{
				{
					State: corev1.ContainerState{
						Terminated: &corev1.ContainerStateTerminated{
							Reason:   reason,
							ExitCode: exitCode,
						},
					},
				},
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

func TestFirstFailureReason_WaitingReason(t *testing.T) {
	pods := []corev1.Pod{podNamedWithWaiting("pod-a", "ImagePullBackOff")}
	assert.Equal(t, "pod-a:ImagePullBackOff", firstFailureReason(pods))
}

func TestFirstFailureReason_NoFailureReason(t *testing.T) {
	assert.Equal(t, "", firstFailureReason([]corev1.Pod{runningPod()}))
}

func TestFirstFailureReason_InitCompletedNotFailure(t *testing.T) {
	p := podWithInitTerminatedReason("Completed", 0)
	p.Name = "pod-a"
	assert.Equal(t, "", firstFailureReason([]corev1.Pod{p}))
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
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "myapp")
	reporter.Report([]corev1.Pod{})
	assert.True(t, spy.contains("[waiting] myapp pods (0/0 ready)"), "expected compact waiting output, got: %v", spy.lines)
}

func TestNewPodReporter_MixedReadyHeaderCount(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "myapp")
	pods := []corev1.Pod{
		podWithReadyCondition(corev1.ConditionTrue),
		podWithReadyCondition(corev1.ConditionFalse),
	}
	reporter.Report(pods)
	assert.True(t, spy.contains("[waiting] myapp pods (1/2 ready)"), "expected compact waiting output, got: %v", spy.lines)
}

func TestNewPodReporter_WaitingReasonAppears(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "myapp")
	reporter.Report([]corev1.Pod{podNamedWithWaiting("pod-a", "CrashLoopBackOff")})
	assert.True(t, spy.contains("CrashLoopBackOff"), "expected 'CrashLoopBackOff' in output, got: %v", spy.lines)
}

func TestNewPodReporter_ObservingAllReadyDoesNotLogReadyBeforeConfirm(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "myapp")
	reporter.Report([]corev1.Pod{succeededPod(), podWithReadyCondition(corev1.ConditionTrue)})
	assert.False(t, spy.contains("[ready] myapp pods (2/2 ready)"), "ready footer should stay hidden before confirm, got: %v", spy.lines)
}

func TestNewPodReporter_ReadyLoggedOnce(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "myapp")
	pods := []corev1.Pod{succeededPod(), podWithReadyCondition(corev1.ConditionTrue)}

	reporter.Confirm()
	reporter.Report(pods)
	reporter.Report(pods)
	reporter.Report(pods)

	count := 0
	for _, line := range spy.lines {
		if strings.Contains(line, "[ready] myapp pods (2/2 ready)") {
			count++
		}
	}
	assert.Equal(t, 1, count, "expected ready logged once, got: %v", spy.lines)
}

func TestNewPodReporter_ConfirmingAllReadyLogsReady(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "myapp")

	reporter.Confirm()
	reporter.Report([]corev1.Pod{succeededPod(), podWithReadyCondition(corev1.ConditionTrue)})

	assert.True(t, spy.contains("[ready] myapp pods (2/2 ready)"), "expected ready summary after confirm, got: %v", spy.lines)
}

func TestNewPodReporter_NonTTYDetailLineUsesWiderNameGap(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "infra")
	pod := namedReadyPod("infra-ingress-nginx-controller")

	reporter.Confirm()
	reporter.Report([]corev1.Pod{pod})

	expected := fmt.Sprintf("  %-48s  %-18s Ready=%s",
		pod.Name,
		podStatusSummary(pod),
		podReadyStatus(pod),
	)
	assert.Contains(t, spy.lines, expected, "expected wider spacing between pod name and status, got: %v", spy.lines)
}

func TestNewPodReporter_TTYSecondReportAfterReadyKeepsTrailingNewline(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("TERM", "xterm")
	t.Setenv("MAGICREW_CLI_NO_ANSI", "")
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "")

	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "infra")
	pods := []corev1.Pod{namedReadyPod("infra-a"), namedReadyPod("infra-b")}

	reporter.Confirm()
	reporter.Report(pods)
	reporter.Report(pods)
	_, _ = out.WriteString("[next]\n")

	assert.Contains(t, out.String(), "\n[next]\n", "next terminal output should start on a new line")
	assert.NotContains(t, out.String(), "Ready=True[next]")
	assert.Empty(t, spy.lines, "tty ready completion should not emit an extra ready log line")
}

func TestNewPodReporter_TTYConfirmingAllReadyDoesNotLogReadyFooter(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("TERM", "xterm")
	t.Setenv("MAGICREW_CLI_NO_ANSI", "")
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "")

	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "magic")
	pods := []corev1.Pod{
		namedReadyPod("magic-a"),
		namedReadyPod("magic-b"),
	}

	reporter.Confirm()
	reporter.Report(pods)

	assert.Contains(t, out.String(), "[waiting] magic pods (2/2 ready)")
	assert.Empty(t, spy.lines, "tty confirm completion should reuse spinner frame without extra ready footer")
}

func TestNewPodReporter_NonTTYNoDuplicateSummary(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "myapp")
	pods := []corev1.Pod{podWithReadyCondition(corev1.ConditionFalse)}
	reporter.Report(pods)
	reporter.Report(pods)

	count := 0
	for _, line := range spy.lines {
		if strings.Contains(line, "[waiting] myapp pods (0/1 ready)") {
			count++
		}
	}
	assert.Equal(t, 1, count, "expected summary printed once for unchanged status, got: %v", spy.lines)
}

func TestNewPodReporter_TTYSpinnerAndFailureReason(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("TERM", "xterm")
	t.Setenv("MAGICREW_CLI_NO_ANSI", "")
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "")
	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "myapp")
	pods := []corev1.Pod{podNamedWithWaiting("pod-a", "ImagePullBackOff")}
	for range 4 {
		reporter.Report(pods)
	}

	s := out.String()
	assert.Contains(t, s, "\r")
	assert.Contains(t, s, "\x1b[2K")
	assert.Contains(t, s, "[waiting] myapp pods")
	assert.Contains(t, s, "失败原因: pod-a:ImagePullBackOff")
	assert.Contains(t, s, "pod-a")
	assert.Empty(t, spy.lines, "tty spinner should not append debug summary each tick")
}

func TestNewPodReporter_TTYDoesNotShowCompletedAsFailure(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("TERM", "xterm")
	t.Setenv("MAGICREW_CLI_NO_ANSI", "")
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "")
	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "infra")

	p := podWithInitTerminatedReason("Completed", 0)
	p.Name = "infra-minio"
	podList := []corev1.Pod{p}
	for range installWatchStableRounds + 1 {
		reporter.Report(podList)
	}

	s := out.String()
	assert.Contains(t, s, "[waiting] infra pods")
	assert.Contains(t, s, "infra-minio")
	assert.NotContains(t, s, "失败原因")
	assert.Empty(t, spy.lines)
}

// ── reporter ANSI policy (NO_COLOR / TERM / MAGICREW_*) ─────────────────────

func TestNewPodReporter_AnsiNO_ColorDisablesSpinnerDespiteTTY(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "myapp")
	reporter.Report([]corev1.Pod{podNamedWithWaiting("pod-a", "ImagePullBackOff")})

	assert.NotContains(t, out.String(), "\x1b[", "NO_COLOR should disable ANSI escapes")
	assert.True(t, spy.contains("[waiting]"), "expected log fallback when ANSI disabled")
}

func TestNewPodReporter_AnsiTERM_DumbDisablesSpinnerDespiteTTY(t *testing.T) {
	t.Setenv("TERM", "dumb")
	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "myapp")
	reporter.Report([]corev1.Pod{podNamedWithWaiting("pod-a", "ImagePullBackOff")})

	assert.NotContains(t, out.String(), "\x1b[")
	assert.True(t, spy.contains("[waiting]"))
}

func TestNewPodReporter_AnsiMagicrewForceEnablesSpinnerWithoutTTY(t *testing.T) {
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "1")
	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, false)
	reporter := newPodReporter(lg, "myapp")
	reporter.Report([]corev1.Pod{podNamedWithWaiting("pod-a", "ImagePullBackOff")})

	s := out.String()
	assert.Contains(t, s, "\x1b[2K")
	assert.Contains(t, s, "[waiting] myapp pods")
	assert.Empty(t, spy.lines)
}

func TestNewPodReporter_AnsiMagicrewNoAnsiDisablesSpinnerDespiteTTY(t *testing.T) {
	t.Setenv("MAGICREW_CLI_NO_ANSI", "1")
	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "myapp")
	reporter.Report([]corev1.Pod{podNamedWithWaiting("pod-a", "ImagePullBackOff")})

	assert.NotContains(t, out.String(), "\x1b[")
	assert.True(t, spy.contains("[waiting]"))
}

func TestNewPodReporter_AnsiMagicrewNoAnsiWinsOverForce(t *testing.T) {
	t.Setenv("MAGICREW_CLI_NO_ANSI", "1")
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "1")
	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "myapp")
	reporter.Report([]corev1.Pod{podNamedWithWaiting("pod-a", "ImagePullBackOff")})

	assert.NotContains(t, out.String(), "\x1b[")
	assert.True(t, spy.contains("[waiting]"))
}

func TestNewPodReporter_AnsiForceOverridesNO_COLOR(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "1")
	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "myapp")
	pods := []corev1.Pod{podNamedWithWaiting("pod-a", "ImagePullBackOff")}
	for range 4 {
		reporter.Report(pods)
	}

	assert.Contains(t, out.String(), "\x1b[2K")
	assert.Empty(t, spy.lines)
}

func TestNewPodReporter_NonTTY_ObservingShowsSummaryUntilCountStable(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "infra")

	// Single unready pod keeps the reporter in observing (no [ready] side effect).
	onePod := []corev1.Pod{namedNotReadyPod("infra-a")}
	sixPods := sixPodsObserving()

	reporter.Report(onePod)
	reporter.Report(sixPods)
	reporter.Report(sixPods)

	assert.True(t, spy.contains("[waiting] infra pods (5/6 ready)"), "expected waiting summary")
	assert.False(t, spy.contains("infra-f"), "details should stay hidden before count stabilizes")
}

func TestNewPodReporter_NonTTY_ConfirmingShowsDetailsBeforeCountStable(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "infra")
	pods := sixPodsObserving()

	reporter.Report(pods)
	reporter.Report(pods)
	assert.False(t, spy.contains("infra-f"), "precondition: details hidden before stable rounds")

	reporter.Confirm()
	reporter.Report(pods)
	assert.True(t, spy.contains("infra-f"), "Confirm should expand details without waiting for count stability")
}

func TestNewPodReporter_NonTTY_ObservingShowsDetailsAfterStableCount(t *testing.T) {
	spy, lg := spyLoggerGroup()
	withWaitOutputForTest(t, &bytes.Buffer{}, false)
	reporter := newPodReporter(lg, "infra")

	sixPods := sixPodsObserving()

	for i := 0; i < installWatchStableRounds+1; i++ {
		reporter.Report(sixPods)
	}

	assert.True(t, spy.contains("infra-f"), "details should appear after stable count threshold")
}

func TestNewPodReporter_TTY_ObservingShowsSummaryUntilCountStable(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("TERM", "xterm")
	t.Setenv("MAGICREW_CLI_NO_ANSI", "")
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "")

	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "infra")

	onePod := []corev1.Pod{namedNotReadyPod("infra-a")}
	sixPods := sixPodsObserving()

	reporter.Report(onePod)
	reporter.Report(sixPods)
	reporter.Report(sixPods)

	rendered := out.String()
	assert.Contains(t, rendered, "[waiting] infra pods")
	assert.NotContains(t, rendered, "infra-f")
	assert.Empty(t, spy.lines)
}

func TestNewPodReporter_TTY_ConfirmingShowsDetailsBeforeCountStable(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("TERM", "xterm")
	t.Setenv("MAGICREW_CLI_NO_ANSI", "")
	t.Setenv("MAGICREW_CLI_FORCE_ANSI", "")

	spy, lg := spyLoggerGroup()
	var out bytes.Buffer
	withWaitOutputForTest(t, &out, true)
	reporter := newPodReporter(lg, "infra")
	pods := sixPodsObserving()

	reporter.Report(pods)
	reporter.Report(pods)
	assert.NotContains(t, out.String(), "infra-f", "precondition: details hidden before stable rounds")

	reporter.Confirm()
	reporter.Report(pods)
	assert.Contains(t, out.String(), "infra-f", "Confirm should expand tty details without waiting for count stability")
	assert.Empty(t, spy.lines)
}
