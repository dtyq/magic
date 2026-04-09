package deployer

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/mattn/go-isatty"
	corev1 "k8s.io/api/core/v1"

	"github.com/dtyq/magicrew-cli/util"
)

// installWatchStableRounds is how many consecutive polls must report the same
// pod count before per-pod lines are shown during install watch (reduces table flicker).
const installWatchStableRounds = 5

const (
	podDetailNameWidth   = 48
	podDetailStatusWidth = 18
)

var waitOutput io.Writer = os.Stderr

var isWaitTTY = func() bool {
	f, ok := waitOutput.(*os.File)
	if !ok {
		return false
	}
	return isatty.IsTerminal(f.Fd())
}

// reporterAnsiEnabled decides whether to use cursor-movement ANSI sequences (spinner UI).
// Priority: MAGICREW_CLI_NO_ANSI=1 disables; MAGICREW_CLI_FORCE_ANSI=1 enables; else NO_COLOR,
// TERM=dumb, or non-TTY disable; otherwise enable.
func reporterAnsiEnabled() bool {
	if envMagicrewFlag("MAGICREW_CLI_NO_ANSI") {
		return false
	}
	if envMagicrewFlag("MAGICREW_CLI_FORCE_ANSI") {
		return true
	}
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("TERM")), "dumb") {
		return false
	}
	return isWaitTTY()
}

func envMagicrewFlag(name string) bool {
	return strings.TrimSpace(os.Getenv(name)) == "1"
}

func formatPodDetailLine(p corev1.Pod) string {
	return fmt.Sprintf("  %-*s  %-*s Ready=%s",
		podDetailNameWidth,
		p.Name,
		podDetailStatusWidth,
		podStatusSummary(p),
		podReadyStatus(p),
	)
}

// installPodReporter renders install-time pod wait output. Before Confirm, per-pod
// lines appear only after the pod count is stable for installWatchStableRounds polls.
// Call Confirm once when Helm has finished applying so full details show immediately.
type installPodReporter struct {
	reportFn  func([]corev1.Pod)
	confirmFn func()
}

// Report renders one poll snapshot (TTY spinner or non-TTY logs).
func (r *installPodReporter) Report(pods []corev1.Pod) {
	if r != nil && r.reportFn != nil {
		r.reportFn(pods)
	}
}

// Confirm switches to the post-Helm phase where per-pod details are always shown.
func (r *installPodReporter) Confirm() {
	if r != nil && r.confirmFn != nil {
		r.confirmFn()
	}
}

// newPodReporter builds a reporter for chart install waits. Use Confirm when Helm completes.
func newPodReporter(log util.LoggerGroup, label string) *installPodReporter {
	frames := []rune{'|', '/', '-', '\\'}
	frameIdx := 0
	lastRenderLines := 0
	lastSummary := ""
	completed := false
	lastPodCount := -1
	stableRounds := 0
	lastNonTTYDetailKey := ""
	confirming := false

	report := func(pods []corev1.Pod) {
		ready := 0
		for _, p := range pods {
			if isPodReady(p) {
				ready++
			}
		}
		total := len(pods)
		reason := firstFailureReason(pods)
		allReady := total > 0 && ready == total
		readyFooter := confirming && allReady && !completed

		if total == lastPodCount {
			stableRounds++
		} else {
			lastPodCount = total
			stableRounds = 0
			lastNonTTYDetailKey = ""
		}
		showDetails := confirming || stableRounds >= installWatchStableRounds

		if reporterAnsiEnabled() {
			frame := frames[frameIdx%len(frames)]
			frameIdx++
			lines := []string{fmt.Sprintf("%c [waiting] %s pods (%d/%d ready)", frame, label, ready, total)}
			if reason != "" {
				lines[0] += fmt.Sprintf(" 失败原因: %s", reason)
			}
			if showDetails {
				if len(pods) == 0 {
					lines = append(lines, "  (no pods yet)")
				} else {
					for _, p := range pods {
						lines = append(lines, formatPodDetailLine(p))
					}
				}
			}
			lastRenderLines = renderSpinnerLines(waitOutput, lines, lastRenderLines)

			if completed {
				// Keep later terminal output on a fresh line when callers re-render
				// after the ready footer has already finalized the spinner block.
				_, _ = fmt.Fprint(waitOutput, "\n")
				return
			}

			if readyFooter {
				_, _ = fmt.Fprint(waitOutput, "\n")
				completed = true
			}
			return
		}

		summary := fmt.Sprintf("[waiting] %s pods (%d/%d ready)", label, ready, total)
		if reason != "" {
			summary += fmt.Sprintf(" 失败原因: %s", reason)
		}
		if summary != lastSummary {
			log.Logd("wait", "%s", summary)
			lastSummary = summary
		}
		if showDetails {
			var detailKey strings.Builder
			detailKey.WriteString(summary)
			detailKey.WriteByte('|')
			for _, p := range pods {
				detailKey.WriteString(p.Name)
				detailKey.WriteByte(':')
				detailKey.WriteString(podStatusSummary(p))
				detailKey.WriteByte(':')
				detailKey.WriteString(podReadyStatus(p))
				detailKey.WriteByte(';')
			}
			if key := detailKey.String(); key != lastNonTTYDetailKey {
				lastNonTTYDetailKey = key
				if len(pods) == 0 {
					log.Logd("wait", "  (no pods yet)")
				} else {
					for _, p := range pods {
						log.Logd("wait", "%s", formatPodDetailLine(p))
					}
				}
			}
		}
		if readyFooter {
			log.Logd("wait", "[ready] %s pods (%d/%d ready)", label, ready, total)
			completed = true
		}
	}

	confirm := func() {
		confirming = true
		lastNonTTYDetailKey = ""
	}

	return &installPodReporter{reportFn: report, confirmFn: confirm}
}

func renderSpinnerLines(w io.Writer, lines []string, prevLines int) int {
	if len(lines) == 0 {
		lines = []string{""}
	}
	// Move cursor to the first line of previous render block.
	_, _ = fmt.Fprint(w, "\r")
	if prevLines > 1 {
		_, _ = fmt.Fprintf(w, "\x1b[%dA", prevLines-1)
	}

	maxLines := prevLines
	if len(lines) > maxLines {
		maxLines = len(lines)
	}

	for i := 0; i < maxLines; i++ {
		_, _ = fmt.Fprint(w, "\x1b[2K\r")
		if i < len(lines) {
			_, _ = fmt.Fprint(w, lines[i])
		}
		if i < maxLines-1 {
			_, _ = fmt.Fprint(w, "\n")
		}
	}

	// If previous frame had more lines, move cursor back to the new last line.
	extra := maxLines - len(lines)
	if extra > 0 {
		_, _ = fmt.Fprintf(w, "\x1b[%dA", extra)
		_, _ = fmt.Fprint(w, "\r")
	}
	return len(lines)
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

func firstFailureReason(pods []corev1.Pod) string {
	for _, p := range pods {
		if reason := podFailureReason(p); reason != "" {
			if p.Name == "" {
				return reason
			}
			return fmt.Sprintf("%s:%s", p.Name, reason)
		}
	}
	return ""
}

func podFailureReason(p corev1.Pod) string {
	for _, cs := range p.Status.InitContainerStatuses {
		if r := failureReasonFromContainerStatus(cs); r != "" {
			return "Init:" + r
		}
	}
	for _, cs := range p.Status.ContainerStatuses {
		if r := failureReasonFromContainerStatus(cs); r != "" {
			return r
		}
	}
	for _, cond := range p.Status.Conditions {
		if cond.Type == corev1.PodScheduled && cond.Status == corev1.ConditionFalse && cond.Reason != "" {
			return cond.Reason
		}
	}
	return ""
}

func failureReasonFromContainerStatus(cs corev1.ContainerStatus) string {
	if cs.State.Waiting != nil {
		reason := strings.TrimSpace(cs.State.Waiting.Reason)
		if isFailureWaitingReason(reason) {
			return reason
		}
	}
	if cs.State.Terminated != nil {
		reason := strings.TrimSpace(cs.State.Terminated.Reason)
		if reason != "" && !isNonFailureTerminatedReason(reason) {
			return reason
		}
		if cs.State.Terminated.ExitCode != 0 {
			return fmt.Sprintf("ExitCode=%d", cs.State.Terminated.ExitCode)
		}
	}
	return ""
}

func isFailureWaitingReason(reason string) bool {
	switch reason {
	case "ErrImagePull", "ImagePullBackOff", "CrashLoopBackOff", "CreateContainerConfigError", "RunContainerError", "InvalidImageName", "CreateContainerError":
		return true
	default:
		return false
	}
}

func isNonFailureTerminatedReason(reason string) bool {
	switch reason {
	case "Completed":
		return true
	default:
		return false
	}
}
