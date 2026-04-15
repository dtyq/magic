package shared_test

import (
	"database/sql"
	"math"
	"testing"

	knowledgeShared "magic/internal/infrastructure/persistence/mysql/knowledge/shared"
)

func TestBulkInsertHelpers(t *testing.T) {
	t.Parallel()

	if got := knowledgeShared.MaxBulkInsertRows(0); got != 1 {
		t.Fatalf("MaxBulkInsertRows(0) = %d, want 1", got)
	}
	if got := knowledgeShared.MaxBulkInsertRows(1000); got != 1 {
		t.Fatalf("MaxBulkInsertRows(1000) = %d, want 1", got)
	}
	if got := knowledgeShared.MaxBulkInsertRows(10); got != 90 {
		t.Fatalf("MaxBulkInsertRows(10) = %d, want 90", got)
	}

	if got := knowledgeShared.BuildBulkInsertSQL("INSERT INTO demo VALUES ", " ON DUPLICATE KEY UPDATE id=id", 2, 0); got != "INSERT INTO demo VALUES  ON DUPLICATE KEY UPDATE id=id" {
		t.Fatalf("unexpected SQL for empty rows: %s", got)
	}
	if got := knowledgeShared.BuildBulkInsertSQL("INSERT INTO demo VALUES ", "", 3, 2); got != "INSERT INTO demo VALUES (?,?,?),(?,?,?)" {
		t.Fatalf("unexpected SQL: %s", got)
	}

	if got := knowledgeShared.BuildInClausePlaceholders(0); got != "" {
		t.Fatalf("BuildInClausePlaceholders(0) = %q, want empty", got)
	}
	if got := knowledgeShared.BuildInClausePlaceholders(3); got != "?,?,?" {
		t.Fatalf("BuildInClausePlaceholders(3) = %q, want %q", got, "?,?,?")
	}
}

func TestStatusConversionHelpers(t *testing.T) {
	t.Parallel()

	if got := knowledgeShared.OptionalString(""); got != (sql.NullString{}) {
		t.Fatalf("OptionalString(empty) = %+v", got)
	}
	if got := knowledgeShared.OptionalString("ok"); got != (sql.NullString{String: "ok", Valid: true}) {
		t.Fatalf("OptionalString(ok) = %+v", got)
	}

	status, err := knowledgeShared.SyncStatusToInt32(7, "sync_status")
	if err != nil || status != 7 {
		t.Fatalf("SyncStatusToInt32() = (%d, %v), want (7, nil)", status, err)
	}

	nullable, err := knowledgeShared.NullableSyncStatusToInt32[int](nil, "sync_status")
	if err != nil || nullable.Valid {
		t.Fatalf("NullableSyncStatusToInt32(nil) = (%+v, %v)", nullable, err)
	}

	value := 9
	nullable, err = knowledgeShared.NullableSyncStatusToInt32(&value, "sync_status")
	if err != nil || !nullable.Valid || nullable.Int32 != 9 {
		t.Fatalf("NullableSyncStatusToInt32(value) = (%+v, %v)", nullable, err)
	}

	if _, err := knowledgeShared.SyncStatusToInt32(int(math.MaxInt32)+1, "sync_status"); err == nil {
		t.Fatal("expected overflow error from SyncStatusToInt32")
	}

	if got, err := knowledgeShared.SafeUint64ToInt(42, "points"); err != nil || got != 42 {
		t.Fatalf("SafeUint64ToInt() = (%d, %v), want (42, nil)", got, err)
	}

	if _, err := knowledgeShared.SafeUint64ToInt(uint64(^uint(0)>>1)+1, "points"); err == nil {
		t.Fatal("expected overflow error from SafeUint64ToInt")
	}
}

func TestOrderWhitelist(t *testing.T) {
	t.Parallel()

	whitelist := knowledgeShared.NewOrderWhitelist("id", map[string]string{
		"id":         "id",
		"created_at": "created_at",
	})

	if got := whitelist.Resolve("created_at"); got != "created_at" {
		t.Fatalf("Resolve(created_at) = %q, want created_at", got)
	}
	if got := whitelist.Resolve("drop table"); got != "id" {
		t.Fatalf("Resolve(invalid) = %q, want id", got)
	}
	if got := whitelist.Clause("created_at", true); got != "created_at ASC" {
		t.Fatalf("Clause(created_at, true) = %q, want created_at ASC", got)
	}
	if got := whitelist.Clause("drop table", false); got != "id DESC" {
		t.Fatalf("Clause(invalid, false) = %q, want id DESC", got)
	}
}
