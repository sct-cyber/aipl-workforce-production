-- Doc number sequence
CREATE SEQUENCE IF NOT EXISTS public.generated_documents_seq START 1;

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS doc_number text UNIQUE;

CREATE OR REPLACE FUNCTION public.assign_doc_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.doc_number IS NULL OR NEW.doc_number = '' THEN
    NEW.doc_number := 'AIPL-DOC-' || lpad(nextval('public.generated_documents_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_doc_number ON public.generated_documents;
CREATE TRIGGER trg_assign_doc_number
  BEFORE INSERT ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number();

-- Storage policies for `documents` bucket
DROP POLICY IF EXISTS "docs_staff_select" ON storage.objects;
DROP POLICY IF EXISTS "docs_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "docs_staff_delete" ON storage.objects;

CREATE POLICY "docs_staff_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.is_staff(auth.uid()));
CREATE POLICY "docs_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.is_staff(auth.uid()));
CREATE POLICY "docs_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.is_staff(auth.uid()));

-- Seed default templates (idempotent by code)
INSERT INTO public.document_templates (code, name, category, description, content, active) VALUES
  ('TPL-KYC', 'Worker KYC', 'worker', 'Worker KYC summary sheet',
$$WORKER KYC SUMMARY

KYC ID: {{kyc_id}}
Name: {{worker_name}}
Father's Name: {{father_name}}
Date of Birth: {{dob}}
Aadhaar: {{aadhaar}}
PAN: {{pan}}
Phone: {{phone}}
Address: {{address}}

Project: {{project_name}}
Designation: {{designation}}
Trade: {{trade}}
Date of Joining: {{doj}}

Bank: {{bank_name}}
A/C: {{account_number}}
IFSC: {{ifsc}}$$, true),
  ('TPL-IDCARD', 'ID Card', 'worker', 'Worker identification card',
$$AIPL WORKFORCE ID CARD

Name: {{worker_name}}
KYC ID: {{kyc_id}}
Designation: {{designation}}
Trade: {{trade}}
Project: {{project_name}}
Phone: {{phone}}
Blood Group: {{blood_group}}
Emergency: {{emergency_contact}}

Valid until: {{valid_until}}$$, true),
  ('TPL-ADV-REQ', 'Advance Request', 'advance', 'Advance (Kharchi) request form',
$$ADVANCE REQUEST

Request No: {{advance_code}}
Date: {{request_date}}

Worker: {{worker_name}} ({{kyc_id}})
Project: {{project_name}}
Designation: {{designation}}

Type: {{advance_type}}
Amount: INR {{amount}}
Reason: {{reason}}

Recovery starts: {{recovery_month}}
Monthly recovery: INR {{recovery_amount}}

Requested by: {{requested_by}}$$, true),
  ('TPL-ADV-APR', 'Advance Approval', 'advance', 'Advance approval letter',
$$ADVANCE APPROVAL

Ref: {{advance_code}}
Date: {{approval_date}}

This is to certify that an advance of INR {{amount}} ({{advance_type}}) has been
APPROVED for {{worker_name}} ({{kyc_id}}), {{designation}} at {{project_name}}.

Recovery: INR {{recovery_amount}} per month starting {{recovery_month}}.

Approved by: {{approved_by}}$$, true),
  ('TPL-WARN', 'Warning Letter', 'worker', 'Formal warning letter',
$$WARNING LETTER

Date: {{issue_date}}
To: {{worker_name}} ({{kyc_id}})
Designation: {{designation}} - {{project_name}}

This letter is issued as a formal warning regarding: {{incident}}

Incident date: {{incident_date}}
Details:
{{details}}

You are advised to correct this conduct immediately. Any recurrence may result
in strict disciplinary action including termination.

Issued by: {{issued_by}}$$, true),
  ('TPL-BLACKLIST', 'Blacklist Letter', 'blacklist', 'Blacklist notification',
$$BLACKLIST NOTIFICATION

Ref: {{blacklist_ref}}
Date: {{blacklist_date}}

Worker: {{worker_name}}
Aadhaar: {{aadhaar}}
Previous Project: {{project_name}}
Previous Designation: {{designation}}

Reason / Category: {{reason}}
Details: {{details}}

The above worker has been BLACKLISTED and shall not be re-engaged on any AIPL
project without written approval from HR / Management.

Issued by: {{issued_by}}$$, true),
  ('TPL-EXP', 'Experience Certificate', 'worker', 'Experience certificate',
$$EXPERIENCE CERTIFICATE

Date: {{issue_date}}

This is to certify that {{worker_name}} ({{kyc_id}}) was employed with AIPL as
{{designation}} ({{trade}}) at {{project_name}} from {{doj}} to {{dol}}.

During the tenure, conduct and work performance were found satisfactory. We wish
them success in future endeavours.

For AIPL,
{{issued_by}}$$, true),
  ('TPL-NODUES', 'No Dues Certificate', 'worker', 'No dues clearance certificate',
$$NO DUES CERTIFICATE

Date: {{issue_date}}

This is to certify that {{worker_name}} ({{kyc_id}}), {{designation}} at
{{project_name}}, has cleared all dues with the company as on {{clearance_date}}.

No amount is recoverable from or payable to the said worker.

For AIPL,
{{issued_by}}$$, true)
ON CONFLICT (code) DO NOTHING;