/**
 * Zoho CRM Setup Guide
 * Step-by-step instructions for configuring Zoho Flow workflows
 */

# Zoho CRM Integration Setup Guide

## Prerequisites

Before you begin, ensure you have:
- ✅ Zoho CRM account with admin access
- ✅ Zoho Flow access (comes with most Zoho CRM plans)
- ✅ Added these custom fields to Zoho CRM Leads module:
  - `Follow_Up_Date` (Date field)
  - `Next_Action` (Multi-line text)
  - `Expected_Close` (Date field)
  - `App_Assigned_To` (Single Line text) - **IMPORTANT**

---

## Step 1: Create Custom Field in Zoho CRM

1. Go to **Zoho CRM** → **Settings** → **Customization** → **Modules and Fields**
2. Select **Leads** module
3. Click **Add Custom Field**
4. Create the following fields:

| Field Label | API Name | Field Type | Description |
|-------------|----------|------------|-------------|
| Follow-up Date | `Follow_Up_Date` | Date | For tracking follow-up dates |
| Next Action | `Next_Action` | Multi Line | Describe next action |
| Expected Close | `Expected_Close` | Date | Expected closing date |
| **App Assigned To** | `App_Assigned_To` | Single Line | **Email of assigned app user** |

---

## Step 2: Create Zoho Flow - Fetch Leads

### 2.1 Create New Flow

1. Go to https://flow.zoho.in
2. Click **Create Flow**
3. Name: **"Fetch CRM Leads for App"**

### 2.2 Setup Trigger

**Option A: Custom Webhook (Recommended)**
- Trigger: **Webhook**
- This creates a URL like: `https://flow.zoho.in/xxx/webhook/abc123`
- **COPY THIS URL** - you'll use it in the app

**Option B: Schedule**
- Trigger: **Schedule**
- Frequency: Every 30 minutes

### 2.3 Add Action: Search Leads

1. Click **+** to add action
2. Select **Zoho CRM**
3. Action: **Search Records**
4. Configure:
   - Module: **Leads**
   - Criteria: **All** (or add filters if needed)
   - Max Records: **200**
   - Fields to fetch: **All**

### 2.4 Add Action: Custom Function (Return Response)

1. Click **+** after Search Records
2. Select **Custom Function** (the function icon)
3. In the Custom Function editor:
   - **Function Name:** `returnLeads`
   - **Return Type:** `map` (or `void`)
   
4. **IMPORTANT: pass the Search Records output into the function**

Zoho Flow custom functions do **not** automatically get a global variable named `Leads`. If you paste code that references `Leads` (capital L) you’ll get:
`Variable 'Leads' is not defined...`

To fix this, add an **Input/Argument** to the custom function and map it to the previous step output:
- In the custom function configuration, add an **argument** named **`Leads`** (type should match the Search Records output, typically a **list** / **map list**).
- Set the argument value using the variable picker from the **Zoho CRM → Search Records** step output (the list of lead records).

5. **Copy this code into the editor:**

```javascript
response = Map();
response.put("success", true);
response.put("leads", Leads);  // This is the FUNCTION ARGUMENT mapped from Search Records output
return response;
```

5. Click **Save**

**Explanation:** This custom function formats the Zoho CRM leads data and returns it as JSON to your app.

### 2.5 Save and Test

1. Click **Save**
2. Click **Test** to verify
3. **COPY THE WEBHOOK URL** from trigger

---

## Step 3: Create Zoho Flow - Update Lead

### 3.1 Create New Flow

1. Click **Create Flow**
2. Name: **"Update Zoho Lead from App"**

### 3.2 Setup Webhook Trigger

1. Trigger: **Webhook**
2. **COPY WEBHOOK URL** - you'll need this

### 3.3 Add Action: Update Lead

1. Click **+** to add action
2. Select **Zoho CRM**
3. Action: **Update Record**
4. Configure:
   - Module: **Leads**
   - Record ID: `${zoho_lead_id}` (from webhook body)
   - Fields to update (map from webhook):
     ```
     Last Name: ${last_name}
     Phone: ${phone}
     Email: ${email}
     Company: ${company}
     Lead Status: ${lead_status}
     Lead Source: ${lead_source}
     Field: ${field}
     Follow-up Date: ${follow_up_date}
     Next Action: ${next_action}
     Expected Close: ${expected_close}
     ```

### 3.4 Add Custom Function (Return Response)

1. Click **+** after Update Record
2. Select **Custom Function**
3. Function Name: `returnSuccess`
4. Return Type: `map`
5. **Code:**

```javascript
response = Map();
response.put("success", true);
response.put("message", "Lead updated successfully");
return response;
```

6. Click **Save**

### 3.5 Save

1. Click **Save**
2. **COPY THE WEBHOOK URL**

---

## Step 4: Create Zoho Flow - Assign Lead

### 4.1 Create New Flow

1. Click **Create Flow**
2. Name: **"Assign Lead to App User"**

### 4.2 Setup Webhook Trigger

1. Trigger: **Webhook**
2. **COPY WEBHOOK URL**

### 4.3 Add Action: Update Lead

1. Click **+** to add action
2. Select **Zoho CRM**
3. Action: **Update Record**
4. Configure:
   - Module: **Leads**
   - Record ID: `${zoho_lead_id}` (from webhook)
   - Field to update:
     ```
     App_Assigned_To: ${app_assigned_to}
     ```
   
   **IMPORTANT:** We update `App_Assigned_To`, **NOT** `Lead Owner`

### 4.4 Add Custom Function (Return Response)

1. Click **+** after Update Record
2. Select **Custom Function**
3. Function Name: `returnAssignmentSuccess`
4. Return Type: `map`
5. **Code:**

```javascript
response = Map();
response.put("success", true);
response.put("message", "Assignment updated");
return response;
```

6. Click **Save**

### 4.5 Save

1. Click **Save**
2. **COPY THE WEBHOOK URL**

---

## Step 5: Configure App with Webhook URLs

**You should now have 3 webhook URLs:**

1. **Fetch Leads:** `https://flow.zoho.in/xxx/webhook/XXXXX`
2. **Update Lead:** `https://flow.zoho.in/xxx/webhook/YYYYY`
3. **Assign Lead:** `https://flow.zoho.in/xxx/webhook/ZZZZZ`

### Configure in App:

**Method 1: Browser Console**
1. Open the Sales Team App
2. Open browser console (F12)
3. Run:
   ```javascript
   configureZohoWebhooks(
     'https://flow.zoho.in/xxx/webhook/XXXXX', // Fetch
     'https://flow.zoho.in/xxx/webhook/YYYYY', // Update
     'https://flow.zoho.in/xxx/webhook/ZZZZZ'  // Assign
   )
   ```

**Method 2: Edit JavaScript File**
1. Open `assets/js/zoho-integration.js`
2. Find `const ZOHO_WEBHOOKS = {`
3. Update the URLs:
   ```javascript
   const ZOHO_WEBHOOKS = {
       fetchLeads: 'https://flow.zoho.in/xxx/webhook/XXXXX',
       updateLead: 'https://flow.zoho.in/xxx/webhook/YYYYY',
       assignLead: 'https://flow.zoho.in/xxx/webhook/ZZZZZ'
   }
   ```

---

## Step 6: Run Database Migration

1. Go to Supabase dashboard
2. Navigate to **SQL Editor**
3. Open the file: `backend/zoho-crm-integration.sql`
4. Click **Run**
5. Verify tables created successfully

---

## Step 7: Test the Integration

### Test 1: Fetch Leads

1. Login as admin
2. Go to Leads page
3. Click **"Sync CRM"** button
4. Verify:
   - ✅ Leads appear with CRM badge
   - ✅ No duplicates
   - ✅ Toast shows "Synced X CRM leads (Y new)"

### Test 2: Update Lead

1. Click on a CRM lead with CRM badge
2. Edit any field (status, phone, etc.)
3. Save
4. Verify in Zoho CRM that the field updated

### Test 3: Assign Lead

1. As admin, find a CRM lead
2. Use assignment dropdown
3. Select a user
4. Verify:
   - ✅ Toast shows "Lead assigned"
   - ✅ User can see lead when they login
   - ✅ `App_Assigned_To` field updated in Zoho CRM

---

## Troubleshooting

### Issue: "Zoho Flow webhook not configured"

**Solution:** Run `configureZohoWebhooks()` in browser console with your webhook URLs

### Issue: No leads showing after sync

**Check:**
1. Zoho Flow execution logs (in Zoho Flow dashboard)
2. Browser console for errors
3. Supabase database - check if `crm_lead_registry` has entries

### Issue: Update not syncing to Zoho

**Check:**
1. Zoho Flow "Update Lead" flow execution logs
2. Verify webhook URL is correct
3. Check field mapping in Zoho Flow

### Issue: Duplicates appearing

**Check:**
1. Supabase `crm_lead_registry` table
2. Verify `zoho_lead_id` is unique in registry

---

## Next Steps

After successful testing:

1. **Add more users** in Supabase `users` table
2. **Configure auto-sync** (change Fetch Leads trigger to Schedule)
3. **Monitor** Zoho Flow execution logs
4. **Train team** on CRM lead features

---

## Support

If you encounter issues:
1. Check Zoho Flow execution history
2. Check browser console for JavaScript errors
3. Check Supabase logs
4. Verify all webhook URLs are configured correctly

---

## Summary Checklist

- [ ] Custom fields added to Zoho CRM
- [ ] Zoho Flow 1: Fetch Leads created
- [ ] Zoho Flow 2: Update Lead created
- [ ] Zoho Flow 3: Assign Lead created
- [ ] Webhook URLs configured in app
- [ ] Database migration run
- [ ] Tested: Fetch leads
- [ ] Tested: Update lead
- [ ] Tested: Assign lead
- [ ] No errors in console
- [ ] Everything working!

🎉 **Integration Complete!**
