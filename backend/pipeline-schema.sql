-- ===================================================================
-- AIR MEDICAL 24x7 — PIPELINE SCHEMA MIGRATION
-- File: backend/pipeline-schema.sql
-- Run this entire script in Supabase SQL Editor (once)
-- ===================================================================

-- ===================================================================
-- PART 1: EXTEND THE EXISTING leads TABLE
-- Safe ALTER TABLE — each column added only if it doesn't exist
-- ===================================================================

DO $$
BEGIN
  -- Contact & Lead Info extensions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='master_reference_id') THEN
    ALTER TABLE leads ADD COLUMN master_reference_id TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='record_name') THEN
    ALTER TABLE leads ADD COLUMN record_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='contact_person_name') THEN
    ALTER TABLE leads ADD COLUMN contact_person_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='lead_owner') THEN
    ALTER TABLE leads ADD COLUMN lead_owner TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='phone') THEN
    ALTER TABLE leads ADD COLUMN phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='lead_source') THEN
    ALTER TABLE leads ADD COLUMN lead_source TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='required_service') THEN
    ALTER TABLE leads ADD COLUMN required_service TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='lead_quality') THEN
    ALTER TABLE leads ADD COLUMN lead_quality TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='lead_status') THEN
    ALTER TABLE leads ADD COLUMN lead_status TEXT DEFAULT 'New Lead';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='whatsapp_number') THEN
    ALTER TABLE leads ADD COLUMN whatsapp_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='inquiry_date_time') THEN
    ALTER TABLE leads ADD COLUMN inquiry_date_time TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='alternate_contact_number') THEN
    ALTER TABLE leads ADD COLUMN alternate_contact_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='budget_discussed') THEN
    ALTER TABLE leads ADD COLUMN budget_discussed TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='lost_reason') THEN
    ALTER TABLE leads ADD COLUMN lost_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='relationship_with_patient') THEN
    ALTER TABLE leads ADD COLUMN relationship_with_patient TEXT;
  END IF;

  -- Referral FK columns (nullable)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='hospital_referral_id') THEN
    ALTER TABLE leads ADD COLUMN hospital_referral_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='embassy_referral_id') THEN
    ALTER TABLE leads ADD COLUMN embassy_referral_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='insurance_referral_id') THEN
    ALTER TABLE leads ADD COLUMN insurance_referral_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='corporate_referral_id') THEN
    ALTER TABLE leads ADD COLUMN corporate_referral_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='vendor_referral_id') THEN
    ALTER TABLE leads ADD COLUMN vendor_referral_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='doctor_referral_id') THEN
    ALTER TABLE leads ADD COLUMN doctor_referral_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='medical_tourism_id') THEN
    ALTER TABLE leads ADD COLUMN medical_tourism_id UUID;
  END IF;

  -- Patient & Medical extensions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='patient_name') THEN
    ALTER TABLE leads ADD COLUMN patient_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='patient_age') THEN
    ALTER TABLE leads ADD COLUMN patient_age INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='gender') THEN
    ALTER TABLE leads ADD COLUMN gender TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='oxygen_required') THEN
    ALTER TABLE leads ADD COLUMN oxygen_required TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='ventilator_required') THEN
    ALTER TABLE leads ADD COLUMN ventilator_required TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='medical_report_received') THEN
    ALTER TABLE leads ADD COLUMN medical_report_received TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='mobility_status') THEN
    ALTER TABLE leads ADD COLUMN mobility_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='patient_condition_category') THEN
    ALTER TABLE leads ADD COLUMN patient_condition_category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='medical_reports_url') THEN
    ALTER TABLE leads ADD COLUMN medical_reports_url TEXT;
  END IF;

  -- Transfer extensions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='current_country') THEN
    ALTER TABLE leads ADD COLUMN current_country TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='current_city') THEN
    ALTER TABLE leads ADD COLUMN current_city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='current_hospital_location') THEN
    ALTER TABLE leads ADD COLUMN current_hospital_location TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='destination_country') THEN
    ALTER TABLE leads ADD COLUMN destination_country TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='destination_city') THEN
    ALTER TABLE leads ADD COLUMN destination_city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='destination_hospital_home') THEN
    ALTER TABLE leads ADD COLUMN destination_hospital_home TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='urgency_level') THEN
    ALTER TABLE leads ADD COLUMN urgency_level TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='expected_travel_date') THEN
    ALTER TABLE leads ADD COLUMN expected_travel_date DATE;
  END IF;
END $$;

-- ===================================================================
-- PART 2: SEQUENCE COUNTER TABLE (for AM-YYYY-NN generation)
-- ===================================================================

CREATE TABLE IF NOT EXISTS sequence_counters (
  year        INTEGER PRIMARY KEY,
  last_seq    INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Function: atomic increment, returns next sequence number
CREATE OR REPLACE FUNCTION get_next_master_ref_seq(p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  INSERT INTO sequence_counters (year, last_seq)
  VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_seq = sequence_counters.last_seq + 1, updated_at = NOW()
  RETURNING last_seq INTO next_seq;
  RETURN next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS: anyone authenticated can call (used server-side by Supabase RPC)
ALTER TABLE sequence_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage sequence counters" ON sequence_counters;
CREATE POLICY "Admins manage sequence counters" ON sequence_counters
  FOR ALL USING (public.check_user_is_admin());
DROP POLICY IF EXISTS "Users can read sequence counters" ON sequence_counters;
CREATE POLICY "Users can read sequence counters" ON sequence_counters
  FOR SELECT USING (true);

-- ===================================================================
-- PART 3: 7 REFERRAL TABLES (identical shape)
-- ===================================================================

CREATE TABLE IF NOT EXISTS hospital_referral (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  whatsapp_number         TEXT,
  alternate_contact_number TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embassy_referral (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  whatsapp_number         TEXT,
  alternate_contact_number TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_referral (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  whatsapp_number         TEXT,
  alternate_contact_number TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS corporate_referral (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  whatsapp_number         TEXT,
  alternate_contact_number TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_referral (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  whatsapp_number         TEXT,
  alternate_contact_number TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_referral (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  whatsapp_number         TEXT,
  alternate_contact_number TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_tourism_partner (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  whatsapp_number         TEXT,
  alternate_contact_number TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for all 7 referral tables (anyone authenticated can read; admin+ can write)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'hospital_referral','embassy_referral','insurance_referral',
    'corporate_referral','vendor_referral','doctor_referral','medical_tourism_partner'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Anyone authenticated can read %1$I" ON %1$I', tbl);
    EXECUTE format('CREATE POLICY "Anyone authenticated can read %1$I" ON %1$I FOR SELECT USING (auth.uid() IS NOT NULL)', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$I" ON %1$I', tbl);
    EXECUTE format('CREATE POLICY "Admins manage %1$I" ON %1$I FOR ALL USING (public.check_user_is_admin())', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Super admin %1$I" ON %1$I', tbl);
    EXECUTE format('CREATE POLICY "Super admin %1$I" ON %1$I FOR ALL USING (public.check_user_is_super_admin())', tbl);
  END LOOP;
END $$;

-- ===================================================================
-- PART 4: medical_assessments TABLE
-- ===================================================================

CREATE TABLE IF NOT EXISTS medical_assessments (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_reference_id             TEXT NOT NULL,
  record_name                     TEXT,
  linked_lead_id                  UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Assessment administration
  assessment_request_date_time    TIMESTAMPTZ DEFAULT NOW(),
  assessment_requested_by         TEXT,
  assessment_assigned_to          TEXT,
  assessment_completion_date_time TIMESTAMPTZ,
  medical_assessment_status       TEXT NOT NULL DEFAULT 'Assessment Requested',

  -- Assessment decision
  fitness_for_air_transfer        TEXT,
  recommended_transfer_mode       TEXT,

  -- Clinical status
  current_clinical_status         TEXT,
  consciousness_level             TEXT,
  mobility_status                 TEXT,
  primary_diagnosis               TEXT,
  reason_for_transfer             TEXT,

  -- Vitals
  heart_rate                      TEXT,
  blood_pressure                  TEXT,
  respiratory_rate                TEXT,
  temperature                     TEXT,
  spo2_room_air                   TEXT,
  gcs_consciousness_score         TEXT,

  -- Risk assessment
  bleeding_risk                   TEXT,
  seizure_risk                    TEXT,
  dvt_pe_risk                     TEXT,
  infection_risk                  TEXT,
  isolation_required              TEXT,
  recent_surgery                  TEXT,
  recent_cardiac_event            TEXT,

  -- Equipment requirements (19 fields)
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

  -- Patient & transfer (copied from lead)
  patient_name                    TEXT,
  patient_age                     INTEGER,
  gender                          TEXT,
  phone                           TEXT,
  email                           TEXT,
  current_country                 TEXT,
  current_city                    TEXT,
  current_hospital_location       TEXT,
  destination_country             TEXT,
  destination_city                TEXT,
  destination_hospital_home       TEXT,

  -- Soft delete
  is_deleted                      BOOLEAN DEFAULT FALSE,

  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto updated_at trigger
CREATE OR REPLACE FUNCTION handle_ma_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ma_updated_at ON medical_assessments;
CREATE TRIGGER set_ma_updated_at
  BEFORE UPDATE ON medical_assessments
  FOR EACH ROW EXECUTE FUNCTION handle_ma_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ma_master_ref       ON medical_assessments(master_reference_id);
CREATE INDEX IF NOT EXISTS idx_ma_linked_lead       ON medical_assessments(linked_lead_id);
CREATE INDEX IF NOT EXISTS idx_ma_status            ON medical_assessments(medical_assessment_status);
CREATE INDEX IF NOT EXISTS idx_ma_user_deleted      ON medical_assessments(is_deleted);

-- RLS
ALTER TABLE medical_assessments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'medical_assessments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON medical_assessments', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_ma"   ON medical_assessments FOR SELECT USING (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
CREATE POLICY "user_insert_own_ma"   ON medical_assessments FOR INSERT WITH CHECK (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
CREATE POLICY "user_update_own_ma"   ON medical_assessments FOR UPDATE USING (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
CREATE POLICY "admin_select_ma"      ON medical_assessments FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_ma"      ON medical_assessments FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_ma"      ON medical_assessments FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_ma"   ON medical_assessments FOR ALL   USING (public.check_user_is_super_admin());

-- ===================================================================
-- PART 5: quotation_control TABLE
-- ===================================================================

CREATE TABLE IF NOT EXISTS quotation_control (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_reference_id             TEXT NOT NULL,
  record_name                     TEXT,
  linked_lead_id                  UUID REFERENCES leads(id) ON DELETE SET NULL,
  linked_ma_id                    UUID REFERENCES medical_assessments(id) ON DELETE SET NULL,
  linked_deal_id                  UUID,

  -- Patient / client
  patient_client_name             TEXT,

  -- Lead & contact (copied from lead)
  lead_owner                      TEXT,
  contact_person_name             TEXT,
  phone                           TEXT,
  email                           TEXT,
  lead_source                     TEXT,
  required_service                TEXT,
  lead_quality                    TEXT,
  lead_status                     TEXT,
  whatsapp_number                 TEXT,
  inquiry_date_time               TIMESTAMPTZ,
  alternate_contact_number        TEXT,
  budget_discussed                TEXT,
  relationship_with_patient       TEXT,

  -- Ownership
  quotation_prepared_by           TEXT,
  sales_owner                     TEXT,
  operations_owner                TEXT,

  -- Medical & costing status
  medical_assessment_status       TEXT,
  management_approval_status      TEXT,
  costing_approved                TEXT,
  management_approval_required    TEXT,

  -- Cost breakdown (8 inputs)
  internal_cost                   NUMERIC DEFAULT 0,
  vendor_cost                     NUMERIC DEFAULT 0,
  medical_team_cost               NUMERIC DEFAULT 0,
  equipment_cost                  NUMERIC DEFAULT 0,
  airport_handling_cost           NUMERIC DEFAULT 0,
  escort_travel_hotel_expense     NUMERIC DEFAULT 0,
  airline_aircraft_cost           NUMERIC DEFAULT 0,
  ground_ambulance_cost           NUMERIC DEFAULT 0,
  total_cost                      NUMERIC DEFAULT 0,   -- auto-calculated

  -- Pricing
  proposed_selling_price          NUMERIC,
  discount_requested              TEXT,
  discount_amount                 NUMERIC DEFAULT 0,
  expected_margin                 NUMERIC,
  final_quotation_amount          NUMERIC,             -- auto-calculated

  -- Quotation details
  quotation_status                TEXT DEFAULT 'Quotation Requested',
  client_response                 TEXT,
  quotation_validity              TEXT,
  payment_terms                   TEXT,
  quotation_shared_date_time      TIMESTAMPTZ,
  next_follow_up_date_time        TIMESTAMPTZ,
  currency                        TEXT DEFAULT 'INR',
  route                           TEXT,
  service_type                    TEXT,

  -- Patient & medical (copied from lead/MA)
  patient_name                    TEXT,
  patient_age                     INTEGER,
  gender                          TEXT,
  oxygen_required                 TEXT,
  ventilator_required             TEXT,
  medical_report_received         TEXT,
  current_country                 TEXT,
  current_city                    TEXT,
  current_hospital_location       TEXT,
  destination_country             TEXT,
  destination_city                TEXT,
  destination_hospital_home       TEXT,
  urgency_level                   TEXT,

  -- Clinical status (from MA)
  current_clinical_status         TEXT,
  consciousness_level             TEXT,
  mobility_status                 TEXT,
  primary_diagnosis               TEXT,
  reason_for_transfer             TEXT,
  fitness_for_air_transfer        TEXT,
  recommended_transfer_mode       TEXT,

  -- Equipment (19 fields — same names as medical_assessments)
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

  -- Soft delete
  is_deleted                      BOOLEAN DEFAULT FALSE,

  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto updated_at trigger
CREATE OR REPLACE FUNCTION handle_qc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_qc_updated_at ON quotation_control;
CREATE TRIGGER set_qc_updated_at
  BEFORE UPDATE ON quotation_control
  FOR EACH ROW EXECUTE FUNCTION handle_qc_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qc_master_ref        ON quotation_control(master_reference_id);
CREATE INDEX IF NOT EXISTS idx_qc_linked_lead        ON quotation_control(linked_lead_id);
CREATE INDEX IF NOT EXISTS idx_qc_linked_ma          ON quotation_control(linked_ma_id);
CREATE INDEX IF NOT EXISTS idx_qc_status             ON quotation_control(quotation_status);

-- RLS
ALTER TABLE quotation_control ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'quotation_control'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON quotation_control', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_select_own_qc"   ON quotation_control FOR SELECT USING (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
CREATE POLICY "user_insert_own_qc"   ON quotation_control FOR INSERT WITH CHECK (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
CREATE POLICY "user_update_own_qc"   ON quotation_control FOR UPDATE USING (
  linked_lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid())
);
CREATE POLICY "admin_select_qc"      ON quotation_control FOR SELECT USING (public.check_user_is_admin());
CREATE POLICY "admin_insert_qc"      ON quotation_control FOR INSERT WITH CHECK (public.check_user_is_admin());
CREATE POLICY "admin_update_qc"      ON quotation_control FOR UPDATE USING (public.check_user_is_admin());
CREATE POLICY "super_admin_all_qc"   ON quotation_control FOR ALL   USING (public.check_user_is_super_admin());

-- ===================================================================
-- PART 6: Supabase Storage bucket for medical reports
-- (Run manually in Supabase Storage UI or via API)
-- Bucket name: medical-reports
-- Public: false (use signed URLs)
-- ===================================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('medical-reports', 'medical-reports', false)
-- ON CONFLICT DO NOTHING;

-- Storage RLS policies for medical-reports bucket
-- (Uncomment and run separately if using SQL editor)
-- CREATE POLICY "Auth users upload medical reports"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'medical-reports' AND auth.uid() IS NOT NULL);
-- CREATE POLICY "Auth users read own medical reports"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'medical-reports' AND auth.uid() IS NOT NULL);

-- ===================================================================
-- DONE — Run this script, then confirm all tables exist in Supabase
-- ===================================================================
DO $$
BEGIN
  RAISE NOTICE 'Pipeline schema migration complete!';
END $$;

