# CRM Sync Diagnostic Checklist

## Critical Issue Identified

The code looks for `payload.id` or `payload.Lead_Id` from Zoho, but you created a **custom "unique id" field**.

Custom fields in Zoho have different names (like `Unique_ID` or similar).

---

## Steps to Debug

### 1. Check What Zoho Sends
When Zoho webhook sends a lead, we need to see the EXACT field names.

**Go to Netlify** → **Functions** → **crm-receiver** → **Logs**

Look for the log message: `"Received payload from Zoho:"`

This will show the actual field names Zoho is sending.

---

### 2. Check Database Lead Data

Run this in Supabase SQL Editor:

```sql
SELECT 
    name,
    email,
    lead_source,
    zoho_lead_id,
    created_at
FROM leads 
WHERE name LIKE '%Test Sync%'
ORDER BY created_at DESC;
```

**If `zoho_lead_id` is NULL** → The webhook isn't capturing the ID

---

### 3. Update crm-receiver to Use Your Custom Field

If your custom field in Zoho is named `Unique_ID`, we need to update line 88:

```javascript
zoho_lead_id: payload.Unique_ID || payload.id || payload.Lead_Id || null,
```

---

## What's Your Custom Field Name in Zoho?

Tell me the EXACT name of the "unique id" field you created in Zoho CRM, and I'll update the code immediately.

Also, check Netlify function logs to see what Zoho is actually sending!
