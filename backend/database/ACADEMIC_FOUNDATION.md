# Academic foundation

Migration `0003_academic_enrollment_guardians.mysql.sql` introduces the
historical and account-linking model used by admissions, report cards,
promotion, and guardian access.

## Model

- `academic_years`: school-owned years with at most one `active` year.
- `academic_terms`: ordered reporting periods within a year.
- `student_enrollments`: a student's year-specific class, roll number, status,
  and enrollment dates.
- `students.user_id`: optional one-to-one student portal account link.
- `guardian_relationships`: many-to-many guardian/student links and explicit
  portal, pickup, emergency, academic-update, and financial-update permissions.

All academic relationship tables contain `school_id`. Composite foreign keys
reject cross-school academic-year, class, student, enrollment, and guardian-to-
student references at the database boundary. User account school and role are
additionally validated by API authorization.

## Initial setup

1. Create an academic year as `planned`.
2. Create its terms with unique `sequence_number` values.
3. When ready, close the old active year and set the new year to `active`.
   The database permits only one active year per school.
4. Create one `student_enrollments` row per admitted student. Use `pending`
   until placement is confirmed, then assign `class_id`, `roll_number`, and
   `active`.
5. Link a student portal account by setting `students.user_id`.
6. Create guardian users with a `guardian` profile, then add one
   `guardian_relationships` row for each child.

Do the active-year change in a database transaction so a failure cannot leave
the school without the intended active year.

## Admissions

Create or update the permanent `students` record first. Create the enrollment
for the intended academic year second. An applicant can remain `pending` with
no class or roll number; acceptance changes that enrollment to `active`.

Do not create a new student record for each academic year. The student record
is the identity; enrollment rows are the history.

## Report cards

A report card should be keyed by `student_enrollment_id` and
`academic_term_id` when its dedicated migration is introduced. Until then,
read results only after resolving the student's enrollment and verifying that
the term belongs to the same academic year. Never infer historical class from
the mutable `students.class_id` field.

## Promotion and repetition

Run promotion as a transaction:

1. Mark the current enrollment `promoted`, `repeated`, or `graduated` and set
   `ended_on`.
2. For promotion or repetition, insert a new enrollment in the destination
   academic year with the destination class.
3. Update `students.class_id` to match the new active placement for legacy
   screens.
4. Commit only after all affected students pass validation.

The unique `(student_id, academic_year_id)` key prevents accidental duplicate
placements in one year.

## Guardian access

Guardian access is granted only when the authenticated user has a matching
relationship with `has_portal_access = 1`. To revoke access without deleting
relationship history, set that flag to `0`. Use `is_primary` for the preferred
contact and the other flags for narrowly scoped operational permissions.

The API exposes guardian/student relationships, but clients must still avoid
showing financial or pickup functions unless the corresponding permission is
enabled.

## Migration and rollback

Back up first, then run:

```bash
npm run db:migrate:status -- --env .env.vercel.local
npm run db:backup -- --env .env.vercel.local --output before-0003.sql.gz
npm run db:migrate -- --env .env.vercel.local --apply
npm run db:migrate:status -- --env .env.vercel.local
```

Migration `0003` is additive and does not fabricate enrollment history from
the legacy `students.class_id` field. Backfill only after each school's actual
academic year has been confirmed. For rollback, restore the verified backup;
do not edit an already applied migration.
