package entity_test

import (
	"testing"

	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

func TestSyncStatusValuesMatchPHPContract(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		status sharedentity.SyncStatus
		value  int
		label  string
	}{
		{name: "pending", status: sharedentity.SyncStatusPending, value: 0, label: "pending"},
		{name: "synced", status: sharedentity.SyncStatusSynced, value: 1, label: "synced"},
		{name: "failed", status: sharedentity.SyncStatusSyncFailed, value: 2, label: "sync_failed"},
		{name: "syncing", status: sharedentity.SyncStatusSyncing, value: 3, label: "syncing"},
		{name: "deleted", status: sharedentity.SyncStatusDeleted, value: 4, label: "deleted"},
		{name: "delete_failed", status: sharedentity.SyncStatusDeleteFailed, value: 5, label: "delete_failed"},
		{name: "rebuilding", status: sharedentity.SyncStatusRebuilding, value: 6, label: "rebuilding"},
	}

	for _, tc := range cases {
		if int(tc.status) != tc.value {
			t.Fatalf("%s: expected value=%d, got=%d", tc.name, tc.value, tc.status)
		}
		if tc.status.String() != tc.label {
			t.Fatalf("%s: expected string=%q, got=%q", tc.name, tc.label, tc.status.String())
		}
	}
}
