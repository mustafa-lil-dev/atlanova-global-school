# Atlanova Global School — Website + LMS

A premium marketing website **and** a working, role-based LMS for **Atlanova
Global School**, an international online school for Grades 1–8. The marketing
site is static HTML/CSS/JS (zero build step); the LMS runs on Supabase
(open-source Postgres backend) with no separate server to host.

**Tagline:** A Global Classroom. A Brighter Future.

## Project structure

```
├── index.html, programs.html, curriculum.html, how-it-works.html,
│   admissions.html, tuition.html, faq.html, contact.html, about.html,
│   teachers.html, parents.html, students.html   Marketing pages
├── apply.html            5-step application form incl. document upload,
│                          submits to Supabase + emails you a copy
├── login.html            Single login for everyone (students/parents/
│                          teachers/admin) — real Supabase Auth
├── dashboard.html         The LMS itself — shows a different view per role
├── css/styles.css        Design system (glass/premium look) — CSS variables
├── js/main.js             Site-wide behaviour, forms, Supabase client
├── js/dashboard.js        All LMS logic (role detection, data, editing)
├── assets/                Logo files
├── robots.txt, sitemap.xml
```

## Running locally

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

No build tools or npm install needed anywhere.

## The LMS (Supabase project "school project", id `qonvtfpztpxwjrbyvrcg`)

### One login, four experiences
Everyone logs in at `login.html` with an email + password you set up for them.
What they see on `dashboard.html` depends on the `role` on their account:

- **Admin (you)** — sees everything. Reviews applications (with secure links
  to uploaded documents), creates subjects/classes, enrolls students, links
  parents to their children, edits anyone's grade level, and can mark
  attendance/enter grades for any class.
- **Teacher** — sees only their own classes, marks attendance, and enters/
  deletes grades for their own students. Cannot see other teachers' classes.
- **Student** — read-only: their enrolled subjects, their attendance history,
  their grades. Cannot edit anything.
- **Parent** — read-only, same three views as a student, for whichever child
  (or children) are linked to them via a dropdown. Cannot edit anything.

This is enforced by database-level Row Level Security (RLS) in Postgres, not
just hidden in the UI — even a technical user poking at the API directly
can't see or change data outside their role.

### How to create your first login (yourself, as admin)
1. Go to your Supabase project's Authentication page:
   `https://supabase.com/dashboard/project/qonvtfpztpxwjrbyvrcg/auth/users`
2. Click **Add user** → **Create new user**.
3. Set your email and a password.
4. Under **User Metadata**, add raw JSON:
   ```json
   { "full_name": "Jawad Mustafa", "role": "admin" }
   ```
5. Save. A matching row is created automatically in the `profiles` table by
   a database trigger — you can now log in at `login.html`.

### Creating teacher / student / parent logins
Same steps as above, just change `"role"` to `"teacher"`, `"student"`, or
`"parent"`, and (for students) optionally add `"grade_level": "Grade 4"`.
Give the person their email + password — that's their login.

Once accounts exist, log in as **admin** and use the dashboard to:
1. **Subjects & Classes tab** → add subjects, then add classes (pick subject
   + teacher + grade level).
2. **People tab** → link a parent to their child (parent accounts see nothing
   until you do this).
3. **Subjects & Classes tab → Enroll a Student** → put students into classes.
4. Teachers can now log in and mark attendance / enter grades themselves, or
   you can do it for them from **Attendance & Grades**.

⚠️ Careful editing your own row in the People table — changing your own role
away from `admin` will lock you out of the admin view (you'd need to fix it
directly in Supabase's Table Editor).

## Applications & documents

`apply.html`'s step 4 now has real file uploads (transcript, ID document,
photo, other) instead of "coming soon." Files upload to a private Supabase
Storage bucket (`application-documents`) and the application is saved to the
`applications` table. In the admin dashboard's **Applications** tab, click
**View** on any row to generate secure, time-limited links to the uploaded
files and change the application's status (new/reviewed/accepted/rejected).

## Email notifications (jawadimustafa7@gmail.com)

Both the application form and the contact form now also send you an email
(in addition to saving to Supabase) using **FormSubmit.co** — a free,
no-signup email relay that works entirely from the browser (no server
needed).

**One-time step required:** the *first* time someone submits either form,
FormSubmit sends a confirmation email to jawadimustafa7@gmail.com — you must
click the confirmation link in that email once to activate delivery. After
that, every future submission arrives automatically. (Submissions are always
saved to Supabase regardless, so nothing is lost even before you confirm.)

## Design: glass / premium look

`css/styles.css` now has a frosted-glass visual system — soft blurred cards,
an ambient gradient background, and a refined glass navigation bar — applied
through shared CSS classes (`.feature-card`, `.form-card`, `.price-card`,
`.grade-card`, `.mockup`, the dashboard's `.panel-card`/`.stat-card`, etc.),
so it's consistent across every page automatically. Colors and effects are
CSS variables at the top of the file (`--glass-bg`, `--glass-shadow`, etc.)
if you want to tune the intensity.

## Backend details (Supabase)

- **Client setup:** `js/main.js` creates a Supabase client using the project
  URL and a **publishable/anon key** — safe to expose client-side; all access
  control is via RLS, not key secrecy.
- **Tables:** `profiles`, `subjects`, `classes`, `enrollments`, `parent_links`,
  `attendance`, `grades`, plus the original `applications` / `contact_messages`.
- **To change the connected project:** edit `SUPABASE_URL` and
  `SUPABASE_ANON_KEY` at the top of `js/main.js`.
- **To inspect/edit data directly:** Supabase dashboard → Table Editor.

## Live classes

Live classes still run on Discord (invite linked site-wide):
https://discord.gg/Z7UxG72fPN — the dashboard adds attendance/grades/subjects
on top of that, it doesn't replace live teaching.

## Known placeholders to fill in before launch

- **Teachers** (`teachers.html`): real names, photos, bios
- Confirm the FormSubmit activation email (see above) before relying on it
