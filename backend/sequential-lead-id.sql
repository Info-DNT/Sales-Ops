-- =========================================================
-- SEQUENTIAL LEAD ID GENERATION (00001, 00002, ...)
-- =========================================================

-- 1. Create a sequence for lead serial numbers
CREATE SEQUENCE IF NOT EXISTS lead_serial_seq START WITH 1;

-- 2. Create a function to generate the formatted serial number
CREATE OR REPLACE FUNCTION generate_lead_serial_no()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if serial_no_2 is null or empty
    -- This allows manual overrides or CRM-provided IDs if necessary
    IF NEW.serial_no_2 IS NULL OR NEW.serial_no_2 = '' THEN
        NEW.serial_no_2 := LPAD(NEXTVAL('lead_serial_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply the trigger to the leads table
DROP TRIGGER IF EXISTS trg_generate_lead_serial ON leads;
CREATE TRIGGER trg_generate_lead_serial
BEFORE INSERT ON leads
FOR EACH ROW
EXECUTE FUNCTION generate_lead_serial_no();

-- COMMENT: This ensures concurrency safety and sequential integrity.
-- To reset or start from a specific number:
-- SELECT setval('lead_serial_seq', 100); -- Starts next from 101
