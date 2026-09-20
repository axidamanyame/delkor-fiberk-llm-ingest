-- Keep only Delkor-Fiberk jobs in app_roles. UPOS leftovers (Admin, Manager, Shop Manager, …) go.
-- SQL editor: run the whole file once.

ALTER TABLE public.profiles DISABLE TRIGGER USER;

CREATE TEMP TABLE delkor_jobs (name text PRIMARY KEY);
INSERT INTO delkor_jobs (name) VALUES
  ('Accountant'),
  ('Accounts Payable Officer'),
  ('Accounts Receivable Officer'),
  ('Administrative Assistant'),
  ('Area Manager'),
  ('Brand Manager'),
  ('Budgeting & Forecasting Analyst'),
  ('Business Systems Analyst'),
  ('CCTV Monitoring Officer'),
  ('CRM Administrator'),
  ('Call Center Supervisor'),
  ('Cashier'),
  ('Compensation & Benefits Analyst'),
  ('Compliance Officer'),
  ('Content Creator'),
  ('Contracts Manager'),
  ('Corporate Communications Manager'),
  ('Cost Accountant'),
  ('Customer Experience Manager'),
  ('Customer Service Manager'),
  ('Customer Support Specialist'),
  ('Cybersecurity Analyst'),
  ('Data Entry'),
  ('Data Protection Officer'),
  ('Database Administrator'),
  ('Delivery'),
  ('Digital Marketing Specialist'),
  ('Dispatch Supervisor'),
  ('Distribution Center Manager'),
  ('Document Control Officer'),
  ('Driver Compliance Officer'),
  ('ERP Administrator'),
  ('Employee Relations Officer'),
  ('Escalations Manager'),
  ('Facilities Manager'),
  ('Field Agent'),
  ('Field Sales Manager'),
  ('Finance Manager'),
  ('Financial Controller'),
  ('Fleet Coordinator'),
  ('Fleet Manager'),
  ('Founder'),
  ('Graphic Designer'),
  ('HQ Admin'),
  ('HR Admin'),
  ('HR Business Partner'),
  ('HR Manager'),
  ('Head of Procurement'),
  ('Head of Retail Operations'),
  ('Head of Sales'),
  ('Head of Supply Chain'),
  ('IT Director'),
  ('IT Manager'),
  ('IT Support Lead'),
  ('Inside Sales Manager'),
  ('Inventory'),
  ('Inventory Control Manager'),
  ('Key Account Manager'),
  ('Legal Counsel'),
  ('Logistics Manager'),
  ('Loss Prevention Manager'),
  ('Maintenance Coordinator'),
  ('Marketing Manager'),
  ('Network Administrator'),
  ('Office Manager'),
  ('Owner'),
  ('Partner'),
  ('Payroll Manager'),
  ('Pending'),
  ('Procurement Manager'),
  ('Purchase Coordinator'),
  ('QA Analyst'),
  ('QA Manager'),
  ('Quality & Standards Officer'),
  ('Quality Assurance Supervisor'),
  ('Receiving Supervisor'),
  ('Recruitment Specialist'),
  ('Regional Operations Manager'),
  ('Retail Merchandising Manager'),
  ('Retail Training & Development Manager'),
  ('Route Planner'),
  ('Safety & Compliance Officer'),
  ('Sales'),
  ('Sales Operations Analyst'),
  ('Security Manager'),
  ('Social Media Manager'),
  ('Software Developer / Integrations Engineer'),
  ('Sourcing Specialist'),
  ('Standards & Compliance Specialist'),
  ('Stock Control Supervisor'),
  ('Store Performance Analyst'),
  ('Supplier Relationship Manager'),
  ('Supply Planner'),
  ('Systems Administrator'),
  ('Systems Developer'),
  ('Territory Sales Manager'),
  ('Training & Development Specialist'),
  ('Transport Manager'),
  ('Treasury Manager'),
  ('Visual Merchandising Lead'),
  ('Warehouse Operations Manager'),
  ('Warehouse Supervisor'),
  ('Warehouse Systems Coordinator');

UPDATE public.profiles p
SET role = p.role_name
WHERE coalesce(p.role_name,'') <> ''
  AND EXISTS (SELECT 1 FROM delkor_jobs d WHERE lower(d.name) = lower(p.role_name))
  AND NOT EXISTS (SELECT 1 FROM delkor_jobs d WHERE lower(d.name) = lower(coalesce(p.role,'')));

UPDATE public.profiles p
SET role_id = NULL
WHERE p.role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.app_roles r
    JOIN delkor_jobs d ON lower(d.name) = lower(r.name)
    WHERE r.id = p.role_id
  );

DELETE FROM public.app_roles r
WHERE NOT EXISTS (SELECT 1 FROM delkor_jobs d WHERE lower(d.name) = lower(r.name));

INSERT INTO public.app_roles (name, description, permissions)
SELECT d.name, 'Delkor job', '{}'::jsonb
FROM delkor_jobs d
WHERE NOT EXISTS (SELECT 1 FROM public.app_roles r WHERE lower(r.name) = lower(d.name));

UPDATE public.profiles p
SET role_id = r.id
FROM public.app_roles r
WHERE lower(r.name) = lower(COALESCE(NULLIF(p.role_name,''), p.role, ''));

ALTER TABLE public.profiles ENABLE TRIGGER USER;
DROP TABLE delkor_jobs;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.role, '') IS NOT DISTINCT FROM COALESCE(OLD.role, '')
     AND COALESCE(NEW.role_name, '') IS NOT DISTINCT FROM COALESCE(OLD.role_name, '')
     AND COALESCE(NEW.role_id::text, '') IS NOT DISTINCT FROM COALESCE(OLD.role_id::text, '') THEN
    RETURN NEW;
  END IF;
  IF public.df_is_hq() OR public.df_is_owner() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.id = auth.uid() THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Role changes must be made by Founder, Owner or HQ Admin';
END;
$$;
