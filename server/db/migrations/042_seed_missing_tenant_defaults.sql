-- Tenants created through the platform API never got leave or consent types
-- (only the demo institution was seeded, in init.js), which left the teacher
-- leave form and the consent screen with permanently empty dropdowns.
-- Seed defaults only for institutions that have none, so schools that already
-- configured their own are left untouched.

INSERT INTO leave_types (institution_id, name, days_per_year, requires_approval, requires_document)
SELECT i.id, d.name, d.days, d.approval, d.document
  FROM institutions i
 CROSS JOIN (VALUES
      ('Casual Leave',    12,  TRUE,  FALSE),
      ('Sick Leave',      10,  TRUE,  TRUE),
      ('Earned Leave',    15,  TRUE,  FALSE),
      ('Maternity Leave', 180, TRUE,  TRUE),
      ('Unpaid Leave',    0,   TRUE,  FALSE)
   ) AS d(name, days, approval, document)
 WHERE NOT EXISTS (SELECT 1 FROM leave_types lt WHERE lt.institution_id = i.id);

INSERT INTO consent_types (institution_id, name, description, category, required)
SELECT i.id, d.name, d.description, d.category, d.required
  FROM institutions i
 CROSS JOIN (VALUES
      ('Photography Consent',     'Permission to photograph the student for school use.',  'photography',     FALSE),
      ('Field Trip Consent',      'Permission to attend off-campus excursions.',           'excursion',       TRUE),
      ('Online Class Recording',  'Permission to record online classes attended.',         'online_class',    FALSE),
      ('Data Processing Consent', 'Permission to process the student''s personal data.',   'data_processing', TRUE),
      ('Transport Consent',       'Permission to use school transport.',                   'transport',       FALSE)
   ) AS d(name, description, category, required)
 WHERE NOT EXISTS (SELECT 1 FROM consent_types ct WHERE ct.institution_id = i.id);
