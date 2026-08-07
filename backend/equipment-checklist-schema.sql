-- ===================================================================
-- AIR MEDICAL 24x7 — EQUIPMENT CHECKLIST MODULE
-- File: backend/equipment-checklist-schema.sql
--
-- Adds the 4th pipeline stage:
--   Leads -> Medical Assessment -> Quotation Control -> Equipment Checklist
--
-- Run this entire script in the Supabase SQL Editor (once).
-- It is re-runnable: every statement is guarded.
--
-- PREREQUISITES (created by backend/pipeline-schema.sql):
--   - quotation_control table
--   - public.check_user_is_admin()
--   - public.check_user_is_super_admin()
-- ===================================================================


-- ===================================================================
-- PART 1: TABLE
-- Column names for the 19 equipment fields are IDENTICAL to
-- quotation_control and medical_assessments, so the copy in
-- sendQCToEquipmentChecklist() is a straight field-for-field map.
-- ===================================================================

CREATE TABLE IF NOT EXISTS equipment_checklist (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_reference_id             TEXT NOT NULL,
  record_name                     TEXT,

  -- Dual linking: immediate parent (QC) + original lead for traceability
  linked_qc_id                    UUID REFERENCES quotation_control(id) ON DELETE SET NULL,
  linked_lead_id                  UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Patient context (copied for readability on the checklist itself)
  patient_name                    TEXT,
  route                           TEXT,

  -- ── EQUIPMENT REQUIREMENTS (19 fields, copied from Quotation Control) ──
  -- Displayed read-only in the UI; this is the reference list the
  -- operations desk packs against.
  oxygen_requirement              TEXT,
  oxygen_flow_rate                TEXT,
  oxygen_concentrator_requirement TEXT,
  oxygen_meter_requirement        TEXT,
  ventilator_requirement          TEXT,
  ventilator_mode                 TEXT,
  cardiac_monitor_required        TEXT,
  infusion_pump_required          TEXT,
  aed_machine_requirement         TEXT,
  thermometer_requirement         TEXT,
  glucometer_requirement          TEXT,
  automatic_external_defibrillator TEXT,
  electronic_bp_monitor           TEXT,
  syringe_pump_requirement        TEXT,
  fetal_doppler_requirement       TEXT,
  mesh_nebulizer_requirement      TEXT,
  laryngoscope_set                TEXT,
  special_medication_required     TEXT,
  suction_required                TEXT,

  -- ── TRACKING FIELDS (editable) ──
  -- equipment_status picklist (enforced in the UI, consistent with every
  -- other status column in this schema — no CHECK constraint):
  --   Pending | Issued | In Transit | Returned
  --   Partially Returned | Damaged | Lost
  equipment_status                TEXT DEFAULT 'Pending',
  equipment_issue_date            DATE,
  expected_return_date            DATE,
  issued_by                       TEXT,
  received_by                     TEXT,
  notes                           TEXT,

  -- Soft delete — every list query in this app filters on this
  is_deleted                      BOOLEAN DEFAULT FALSE,

  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);


-- ===================================================================
-- PART 2: AUTO updated_at TRIGGER
-- Mirrors handle_qc_updated_at() / handle_ma_updated_at()
-- ===================================================================

CREATE OR REPLACE FUNCTION handle_ec_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ec_updated_at ON equipment_checklist;
CREATE TRIGGER set_ec_updated_at
  BEFORE UPDATE ON equipment_checklist
  FOR EACH ROW EXECUTE FUNCTION handle_ec_updated_at();


-- ===================================================================
-- PART 3: INDEXES
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_ec_master_ref   ON equipment_checklist(master_reference_id);
CREATE INDEX IF NOT EXISTS idx_ec_linked_qc    ON equipment_checklist(linked_qc_id);
CREATE INDEX IF NOT EXISTS idx_ec_linked_lead  ON equipment_checklist(linked_lead_id);
CREATE INDEX IF NOT EXISTS idx_ec_status       ON equipment_checklist(equipment_status);
CREATE INDEX IF NOT EXISTS idx_ec_deleted      ON equipment_checklist(is_deleted);


-- ===================================================================
-- PART 4: ROW LEVEL SECURITY
-- Mirrors quotation_control exactly (pipeline-schema.sql:542-565).
--
-- Users reach their own records through the lead they own; admins get
-- select/insert/update but NOT delete; super_admin gets everything.
-- ===================================================================

ALTER TABLE equipment_checklist ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies so this script is re-runnable
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'equipment_checklist'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON equipment_checklist', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_ec" ON equipment_checklist FOR SELECT USING (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
CREATE POLICY "user_insert_own_ec" ON equipment_checklist FOR INSERT WITH CHECK (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
CREATE POLICY "user_update_own_ec" ON equipment_checklist FOR UPDATE USING (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);

CREATE POLICY "admin_select_ec" ON equipment_checklist FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_ec" ON equipment_checklist FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_ec" ON equipment_checklist FOR UPDATE USING (public.check_user_is_admin());

CREATE POLICY "super_admin_all_ec" ON equipment_checklist FOR ALL USING (public.check_user_is_super_admin());


-- ===================================================================
-- PART 5: VERIFY
-- Any row returned by the second query means the table would deny all
-- access. Expect exactly 7 policies and zero problem rows.
-- ===================================================================

SELECT
  'equipment_checklist' AS table_name,
  COUNT(*)              AS policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'equipment_checklist';

DO $$
DECLARE n_pol INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_pol
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'equipment_checklist';

  IF n_pol <> 7 THEN
    RAISE EXCEPTION 'Expected 7 RLS policies on equipment_checklist, found %', n_pol;
  END IF;

  RAISE NOTICE 'Equipment Checklist schema installed successfully (7 policies).';
END $$;
