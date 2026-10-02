-- Add updated_at to deployment_target for live-sync tracking.
-- Also widen deployment_status to include DOWN (cluster-level unreachable),
-- and add UNREACHABLE to the cluster status check (already in V1 but
-- adding DOWN here for deployment_target alignment).

ALTER TABLE deployment_target
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Widen the deployment_status check to also accept DOWN
ALTER TABLE deployment_target
    DROP CONSTRAINT IF EXISTS deployment_target_deployment_status_check;

ALTER TABLE deployment_target
    ADD CONSTRAINT deployment_target_deployment_status_check
    CHECK (deployment_status IN ('PENDING','DEPLOYING','HEALTHY','DEGRADED','FAILED','DOWN'));

-- Backfill updated_at from created_at for existing rows
UPDATE deployment_target SET updated_at = created_at WHERE updated_at = now() AND created_at < now() - interval '1 second';

-- Index for the live-sync query (cluster_id + updated_at)
CREATE INDEX IF NOT EXISTS idx_target_cluster_updated
    ON deployment_target (cluster_id, updated_at DESC);
