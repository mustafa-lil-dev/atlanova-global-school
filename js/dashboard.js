// Atlanova Global School — LMS dashboard logic
// Requires js/main.js to have run first (defines window.supabaseClient).

(function () {

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (e) { return d; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.supabaseClient) {
      var errEl = document.getElementById('dashError');
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Could not connect to Atlanova services. Please refresh the page.'; }
      var loadEl = document.getElementById('dashLoading');
      if (loadEl) loadEl.style.display = 'none';
      return;
    }

    var sb = window.supabaseClient;
    var me = null;          // auth user
    var myProfile = null;   // profiles row

    // Simple in-memory caches shared across role views
    var cache = { profiles: [], profilesById: {}, subjects: [], subjectsById: {}, classes: [], classesById: {} };

    /* ---------------- Tab switching (scoped per .dash-tabs group) ---------------- */
    document.querySelectorAll('.dash-tabs').forEach(function (tabGroup) {
      var parent = tabGroup.parentElement;
      tabGroup.querySelectorAll('.dash-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabGroup.querySelectorAll('.dash-tab').forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          var target = tab.getAttribute('data-tab');
          parent.querySelectorAll(':scope > .dash-panel').forEach(function (p) {
            p.classList.toggle('active', p.id === target);
          });
        });
      });
    });

    /* ---------------- Logout ---------------- */
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        sb.auth.signOut().then(function () { window.location.href = 'login.html'; });
      });
    }

    /* ---------------- Docs modal ---------------- */
    var docsModal = document.getElementById('docsModal');
    document.getElementById('docsModalClose').addEventListener('click', function () { docsModal.classList.remove('open'); });
    docsModal.addEventListener('click', function (e) { if (e.target === docsModal) docsModal.classList.remove('open'); });

    /* ================= BOOTSTRAP: auth + profile ================= */
    sb.auth.getSession().then(function (sessionRes) {
      var session = sessionRes.data && sessionRes.data.session;
      if (!session) { window.location.href = 'login.html'; return; }
      me = session.user;
      return sb.from('profiles').select('*').eq('id', me.id).single();
    }).then(function (profileRes) {
      if (!profileRes) return; // already redirected
      if (profileRes.error || !profileRes.data) {
        showError('Your account is signed in but has no school profile yet. Ask the administrator to finish setting up your account.');
        return;
      }
      myProfile = profileRes.data;
      document.getElementById('dashUserName').textContent = myProfile.full_name || me.email;
      document.getElementById('dashUserRole').textContent = myProfile.role;
      document.getElementById('dashAvatar').textContent = (myProfile.full_name || me.email || '?').trim().charAt(0).toUpperCase();

      document.getElementById('dashLoading').style.display = 'none';
      document.getElementById('dashContent').style.display = 'block';

      if (myProfile.role === 'admin') { document.getElementById('panel-admin').style.display = 'block'; initAdmin(); }
      else if (myProfile.role === 'teacher') { document.getElementById('panel-teacher').style.display = 'block'; initTeacher(); }
      else if (myProfile.role === 'student') { document.getElementById('panel-student').style.display = 'block'; initStudent(); }
      else if (myProfile.role === 'parent') { document.getElementById('panel-parent').style.display = 'block'; initParent(); }
    }).catch(function (err) {
      console.error(err);
      showError('Something went wrong loading your dashboard. Please refresh.');
    });

    function showError(msg) {
      document.getElementById('dashLoading').style.display = 'none';
      var errEl = document.getElementById('dashError');
      errEl.style.display = 'block';
      errEl.textContent = msg;
    }

    /* ================= SHARED: class workspace (attendance + grades) ================= */
    // Renders an attendance + grades editor for one class into `container`.
    // `canEdit` = teacher of the class or admin.
    function renderClassWorkspace(container, classId) {
      container.innerHTML = '<p class="dash-loading">Loading class…</p>';

      Promise.all([
        sb.from('enrollments').select('student_id').eq('class_id', classId),
        sb.from('attendance').select('*').eq('class_id', classId).order('date', { ascending: false }),
        sb.from('grades').select('*').eq('class_id', classId).order('created_at', { ascending: false })
      ]).then(function (results) {
        var enrollments = (results[0].data || []);
        var attendanceRows = (results[1].data || []);
        var gradeRows = (results[2].data || []);
        var studentIds = enrollments.map(function (e) { return e.student_id; });

        var missingIds = studentIds.filter(function (id) { return !cache.profilesById[id]; });
        var fetchMissing = missingIds.length
          ? sb.from('profiles').select('*').in('id', missingIds)
          : Promise.resolve({ data: [] });

        fetchMissing.then(function (res) {
          (res.data || []).forEach(function (p) { cache.profilesById[p.id] = p; });

          var students = studentIds.map(function (id) { return cache.profilesById[id]; }).filter(Boolean)
            .sort(function (a, b) { return (a.full_name || '').localeCompare(b.full_name || ''); });

          var todayStr = new Date().toISOString().slice(0, 10);

          var html = '';
          html += '<div class="panel-card">';
          html += '<div class="panel-head"><h3 style="margin:0;">Attendance</h3>' +
                  '<div class="field" style="margin:0;"><input type="date" id="wsAttDate" value="' + todayStr + '" style="padding:8px 12px;border:1px solid var(--gray-200);border-radius:8px;"></div></div>';
          if (!students.length) {
            html += '<div class="empty-state">No students enrolled in this class yet.</div>';
          } else {
            html += '<div style="overflow-x:auto;"><table class="dtable" id="wsAttTable"><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>';
            students.forEach(function (s) {
              html += '<tr data-student="' + s.id + '"><td>' + escapeHtml(s.full_name) + '</td><td>' +
                '<select class="wsAttStatus">' +
                ['present', 'absent', 'late', 'excused'].map(function (opt) { return '<option value="' + opt + '">' + opt + '</option>'; }).join('') +
                '</select></td></tr>';
            });
            html += '</tbody></table></div>';
            html += '<button class="btn btn-primary btn-sm mt-16" id="wsSaveAttendance">Save Attendance</button>';
            html += '<div style="overflow-x:auto;margin-top:22px;"><h3 style="font-size:15px;margin-bottom:10px;">Recent Records</h3><table class="dtable"><thead><tr><th>Date</th><th>Student</th><th>Status</th></tr></thead><tbody>';
            if (!attendanceRows.length) html += '<tr><td colspan="3" class="empty-state">No attendance recorded yet.</td></tr>';
            attendanceRows.slice(0, 40).forEach(function (r) {
              var p = cache.profilesById[r.student_id];
              html += '<tr><td>' + fmtDate(r.date) + '</td><td>' + escapeHtml(p ? p.full_name : r.student_id) + '</td><td><span class="pill pill-' + r.status + '">' + r.status + '</span></td></tr>';
            });
            html += '</tbody></table></div>';
          }
          html += '</div>';

          html += '<div class="panel-card">';
          html += '<div class="panel-head"><h3 style="margin:0;">Grades</h3></div>';
          if (students.length) {
            html += '<div class="field-row">' +
              '<div class="field"><label>Student</label><select id="wsGradeStudent">' + students.map(function (s) { return '<option value="' + s.id + '">' + escapeHtml(s.full_name) + '</option>'; }).join('') + '</select></div>' +
              '<div class="field"><label>Assessment name</label><input type="text" id="wsGradeName" placeholder="e.g. Unit 3 Quiz"></div>' +
              '</div>' +
              '<div class="field-row">' +
              '<div class="field"><label>Score</label><input type="number" id="wsGradeScore" step="0.1"></div>' +
              '<div class="field"><label>Out of</label><input type="number" id="wsGradeMax" value="100" step="0.1"></div>' +
              '</div>' +
              '<div class="field"><label>Term</label><input type="text" id="wsGradeTerm" value="Current Term"></div>' +
              '<button class="btn btn-primary btn-sm" id="wsAddGrade">Add Grade</button>';
          } else {
            html += '<div class="empty-state">Enroll students in this class to start entering grades.</div>';
          }
          html += '<div style="overflow-x:auto;margin-top:18px;"><table class="dtable" id="wsGradesTable"><thead><tr><th>Student</th><th>Assessment</th><th>Score</th><th>Term</th><th></th></tr></thead><tbody>';
          if (!gradeRows.length) html += '<tr><td colspan="5" class="empty-state">No grades recorded yet.</td></tr>';
          gradeRows.forEach(function (g) {
            var p = cache.profilesById[g.student_id];
            html += '<tr data-grade="' + g.id + '"><td>' + escapeHtml(p ? p.full_name : g.student_id) + '</td><td>' + escapeHtml(g.assessment_name) +
              '</td><td>' + g.score + ' / ' + g.max_score + '</td><td>' + escapeHtml(g.term) + '</td>' +
              '<td><button class="btn btn-outline-dark btn-sm wsDeleteGrade">Delete</button></td></tr>';
          });
          html += '</tbody></table></div></div>';

          container.innerHTML = html;

          var saveAttBtn = document.getElementById('wsSaveAttendance');
          if (saveAttBtn) {
            saveAttBtn.addEventListener('click', function () {
              var date = document.getElementById('wsAttDate').value;
              if (!date) return;
              var rows = [];
              document.querySelectorAll('#wsAttTable tbody tr').forEach(function (tr) {
                rows.push({
                  student_id: tr.getAttribute('data-student'),
                  class_id: classId,
                  date: date,
                  status: tr.querySelector('.wsAttStatus').value,
                  marked_by: me.id
                });
              });
              saveAttBtn.disabled = true;
              saveAttBtn.textContent = 'Saving…';
              sb.from('attendance').upsert(rows, { onConflict: 'student_id,class_id,date' }).then(function (res) {
                saveAttBtn.disabled = false;
                saveAttBtn.textContent = 'Save Attendance';
                if (res.error) { alert('Could not save attendance: ' + res.error.message); return; }
                renderClassWorkspace(container, classId);
              });
            });
          }

          var addGradeBtn = document.getElementById('wsAddGrade');
          if (addGradeBtn) {
            addGradeBtn.addEventListener('click', function () {
              var name = document.getElementById('wsGradeName').value.trim();
              var score = parseFloat(document.getElementById('wsGradeScore').value);
              var max = parseFloat(document.getElementById('wsGradeMax').value) || 100;
              var term = document.getElementById('wsGradeTerm').value.trim() || 'Current Term';
              var studentId = document.getElementById('wsGradeStudent').value;
              if (!name || isNaN(score)) { alert('Enter an assessment name and score.'); return; }
              addGradeBtn.disabled = true;
              sb.from('grades').insert({
                student_id: studentId, class_id: classId, assessment_name: name,
                score: score, max_score: max, term: term, recorded_by: me.id
              }).then(function (res) {
                addGradeBtn.disabled = false;
                if (res.error) { alert('Could not save grade: ' + res.error.message); return; }
                renderClassWorkspace(container, classId);
              });
            });
          }

          container.querySelectorAll('.wsDeleteGrade').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var row = btn.closest('[data-grade]');
              var id = row.getAttribute('data-grade');
              if (!confirm('Delete this grade entry?')) return;
              sb.from('grades').delete().eq('id', id).then(function (res) {
                if (res.error) { alert('Could not delete: ' + res.error.message); return; }
                renderClassWorkspace(container, classId);
              });
            });
          });
        });
      });
    }

    /* ================= TEACHER ================= */
    function initTeacher() {
      var picker = document.getElementById('teacherClassPicker');
      var workspace = document.getElementById('teacherClassWorkspace');
      sb.from('classes').select('*, subjects(name)').eq('teacher_id', me.id).then(function (res) {
        var classes = res.data || [];
        if (!classes.length) {
          picker.innerHTML = '<option>No classes assigned yet</option>';
          workspace.innerHTML = '<div class="panel-card empty-state">You have no classes yet — ask your administrator to assign you one.</div>';
          return;
        }
        picker.innerHTML = classes.map(function (c) {
          return '<option value="' + c.id + '">' + escapeHtml(c.name) + (c.subjects ? ' — ' + escapeHtml(c.subjects.name) : '') + '</option>';
        }).join('');
        renderClassWorkspace(workspace, classes[0].id);
        picker.addEventListener('change', function () { renderClassWorkspace(workspace, picker.value); });
      });
    }

    /* ================= STUDENT ================= */
    function loadOwnSubjects(studentId, tableId) {
      var tbody = document.querySelector('#' + tableId + ' tbody');
      sb.from('enrollments').select('class_id').eq('student_id', studentId).then(function (res) {
        var classIds = (res.data || []).map(function (r) { return r.class_id; });
        if (!classIds.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No subjects enrolled yet.</td></tr>'; return; }
        sb.from('classes').select('*, subjects(name)').in('id', classIds).then(function (res2) {
          var classes = res2.data || [];
          var teacherIds = classes.map(function (c) { return c.teacher_id; }).filter(Boolean);
          var fetchTeachers = teacherIds.length ? sb.from('profiles').select('id, full_name').in('id', teacherIds) : Promise.resolve({ data: [] });
          fetchTeachers.then(function (res3) {
            var teacherMap = {};
            (res3.data || []).forEach(function (t) { teacherMap[t.id] = t.full_name; });
            tbody.innerHTML = classes.map(function (c) {
              return '<tr><td>' + escapeHtml(c.subjects ? c.subjects.name : c.name) + '</td><td>' + escapeHtml(teacherMap[c.teacher_id] || '—') + '</td><td>' + escapeHtml(c.grade_level) + '</td></tr>';
            }).join('');
          });
        });
      });
    }

    function loadOwnAttendance(studentId, tableId) {
      var tbody = document.querySelector('#' + tableId + ' tbody');
      sb.from('attendance').select('*, classes(name)').eq('student_id', studentId).order('date', { ascending: false }).limit(60).then(function (res) {
        var rows = res.data || [];
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No attendance records yet.</td></tr>'; return; }
        tbody.innerHTML = rows.map(function (r) {
          return '<tr><td>' + fmtDate(r.date) + '</td><td>' + escapeHtml(r.classes ? r.classes.name : '—') + '</td><td><span class="pill pill-' + r.status + '">' + r.status + '</span></td></tr>';
        }).join('');
      });
    }

    function loadOwnGrades(studentId, tableId) {
      var tbody = document.querySelector('#' + tableId + ' tbody');
      sb.from('grades').select('*, classes(name)').eq('student_id', studentId).order('created_at', { ascending: false }).then(function (res) {
        var rows = res.data || [];
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No grades recorded yet.</td></tr>'; return; }
        tbody.innerHTML = rows.map(function (r) {
          return '<tr><td>' + escapeHtml(r.classes ? r.classes.name : '—') + '</td><td>' + escapeHtml(r.assessment_name) + '</td><td>' + r.score + ' / ' + r.max_score + '</td><td>' + escapeHtml(r.term) + '</td></tr>';
        }).join('');
      });
    }

    function initStudent() {
      loadOwnSubjects(me.id, 'studentSubjectsTable');
      loadOwnAttendance(me.id, 'studentAttendanceTable');
      loadOwnGrades(me.id, 'studentGradesTable');
    }

    /* ================= PARENT ================= */
    function initParent() {
      var picker = document.getElementById('parentChildPicker');
      sb.from('parent_links').select('student_id, profiles!parent_links_student_id_fkey(full_name)').eq('parent_id', me.id).then(function (res) {
        var links = res.data || [];
        if (!links.length) {
          // Fallback without FK-embed name (in case the relationship alias differs) — fetch names manually.
          sb.from('parent_links').select('student_id').eq('parent_id', me.id).then(function (res2) {
            var ids = (res2.data || []).map(function (r) { return r.student_id; });
            if (!ids.length) {
              picker.innerHTML = '<option>No linked children yet</option>';
              return;
            }
            sb.from('profiles').select('id, full_name').in('id', ids).then(function (res3) {
              buildChildPicker(res3.data || []);
            });
          });
          return;
        }
        var children = links.map(function (l) { return { id: l.student_id, full_name: l.profiles ? l.profiles.full_name : l.student_id }; });
        buildChildPicker(children);
      });

      function buildChildPicker(children) {
        if (!children.length) { picker.innerHTML = '<option>No linked children yet</option>'; return; }
        picker.innerHTML = children.map(function (c) { return '<option value="' + c.id + '">' + escapeHtml(c.full_name) + '</option>'; }).join('');
        loadChild(children[0].id);
        picker.addEventListener('change', function () { loadChild(picker.value); });
      }

      function loadChild(studentId) {
        loadOwnSubjects(studentId, 'parentSubjectsTable');
        loadOwnAttendance(studentId, 'parentAttendanceTable');
        loadOwnGrades(studentId, 'parentGradesTable');
      }
    }

    /* ================= ADMIN ================= */
    function initAdmin() {
      loadAdminOverview();
      loadPeople().then(function () {
        loadSubjects().then(function () {
          loadClasses().then(function () {
            loadEnrollments();
            loadParentLinks();
            initAdminClassPicker();
          });
        });
      });
      loadApplications();

      document.getElementById('addSubjectBtn').addEventListener('click', function () {
        var name = document.getElementById('newSubjectName').value.trim();
        var grade = document.getElementById('newSubjectGrade').value;
        if (!name) return;
        sb.from('subjects').insert({ name: name, grade_level: grade }).then(function (res) {
          if (res.error) { alert(res.error.message); return; }
          document.getElementById('newSubjectName').value = '';
          loadSubjects();
        });
      });

      document.getElementById('addClassBtn').addEventListener('click', function () {
        var name = document.getElementById('newClassName').value.trim();
        var subjectId = document.getElementById('newClassSubject').value;
        var teacherId = document.getElementById('newClassTeacher').value || null;
        var grade = document.getElementById('newClassGrade').value;
        if (!name || !subjectId) { alert('Add a class name and pick a subject first.'); return; }
        sb.from('classes').insert({ name: name, subject_id: subjectId, teacher_id: teacherId, grade_level: grade }).then(function (res) {
          if (res.error) { alert(res.error.message); return; }
          document.getElementById('newClassName').value = '';
          loadClasses().then(initAdminClassPicker);
        });
      });

      document.getElementById('enrollBtn').addEventListener('click', function () {
        var classId = document.getElementById('enrollClassSelect').value;
        var studentId = document.getElementById('enrollStudentSelect').value;
        if (!classId || !studentId) return;
        sb.from('enrollments').insert({ class_id: classId, student_id: studentId }).then(function (res) {
          if (res.error) { alert(res.error.message); return; }
          loadEnrollments();
        });
      });

      document.getElementById('linkParentBtn').addEventListener('click', function () {
        var parentId = document.getElementById('linkParentSelect').value;
        var studentId = document.getElementById('linkStudentSelect').value;
        if (!parentId || !studentId) return;
        sb.from('parent_links').insert({ parent_id: parentId, student_id: studentId }).then(function (res) {
          if (res.error) { alert(res.error.message); return; }
          loadParentLinks();
        });
      });
    }

    function loadAdminOverview() {
      var cards = document.querySelectorAll('#adminStats .stat-card .num');
      Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
        sb.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'new')
      ]).then(function (res) {
        cards[0].textContent = res[0].count || 0;
        cards[1].textContent = res[1].count || 0;
        cards[2].textContent = res[2].count || 0;
        cards[3].textContent = res[3].count || 0;
      });
    }

    function loadApplications() {
      var tbody = document.querySelector('#applicationsTable tbody');
      sb.from('applications').select('*').order('created_at', { ascending: false }).then(function (res) {
        var rows = res.data || [];
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No applications yet.</td></tr>'; return; }
        tbody.innerHTML = rows.map(function (a) {
          var docCount = ['transcript_path', 'id_document_path', 'photo_path', 'other_document_path'].filter(function (k) { return a[k]; }).length;
          return '<tr data-app="' + a.id + '">' +
            '<td>' + new Date(a.created_at).toLocaleDateString() + '</td>' +
            '<td>' + escapeHtml(a.student_name) + '</td>' +
            '<td>' + escapeHtml(a.student_grade) + '</td>' +
            '<td>' + escapeHtml(a.parent_name) + '<br><span style="color:var(--gray-500);font-size:12px;">' + escapeHtml(a.parent_email) + '</span></td>' +
            '<td><button class="btn btn-outline-dark btn-sm viewDocsBtn" ' + (docCount ? '' : 'disabled style="opacity:.4;"') + '>View (' + docCount + ')</button></td>' +
            '<td><select class="appStatusSelect">' +
              ['new', 'reviewed', 'accepted', 'rejected'].map(function (s) { return '<option value="' + s + '"' + (s === a.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
            '</select></td>' +
            '</tr>';
        }).join('');

        tbody.querySelectorAll('.appStatusSelect').forEach(function (sel) {
          sel.addEventListener('change', function () {
            var id = sel.closest('[data-app]').getAttribute('data-app');
            sb.from('applications').update({ status: sel.value }).eq('id', id).then(function (res2) {
              if (res2.error) alert(res2.error.message);
            });
          });
        });

        tbody.querySelectorAll('.viewDocsBtn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.closest('[data-app]').getAttribute('data-app');
            var app = rows.find(function (r) { return r.id === id; });
            openDocsModal(app);
          });
        });
      });
    }

    function openDocsModal(app) {
      var body = document.getElementById('docsModalBody');
      body.innerHTML = '<p class="dash-loading">Generating secure links…</p>';
      docsModal.classList.add('open');
      var fields = [
        ['Transcript / Report Card', app.transcript_path],
        ['ID Document', app.id_document_path],
        ['Photo', app.photo_path],
        ['Other Document', app.other_document_path]
      ];
      Promise.all(fields.map(function (f) {
        if (!f[1]) return Promise.resolve(null);
        return sb.storage.from('application-documents').createSignedUrl(f[1], 3600).then(function (r) {
          return r.data ? r.data.signedUrl : null;
        });
      })).then(function (links) {
        var html = '<ul style="list-style:none;padding:0;margin:0;">';
        fields.forEach(function (f, i) {
          html += '<li style="padding:10px 0;border-bottom:1px solid var(--gray-100);">' + f[0] + ': ' +
            (links[i] ? '<a href="' + links[i] + '" target="_blank" rel="noopener" style="color:var(--purple);font-weight:600;">Open ↗</a>' : '<span style="color:var(--gray-500);">Not provided</span>') +
            '</li>';
        });
        html += '</ul><p style="font-size:12px;color:var(--gray-500);margin-top:12px;">Links expire in 1 hour.</p>';
        body.innerHTML = html;
      });
    }

    function loadPeople() {
      var tbody = document.querySelector('#peopleTable tbody');
      return sb.from('profiles').select('*').order('role').order('full_name').then(function (res) {
        var rows = res.data || [];
        cache.profiles = rows;
        cache.profilesById = {};
        rows.forEach(function (p) { cache.profilesById[p.id] = p; });

        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No accounts yet — create one in Supabase Authentication.</td></tr>'; }
        else {
          tbody.innerHTML = rows.map(function (p) {
            return '<tr data-person="' + p.id + '">' +
              '<td><input type="text" class="pName" value="' + escapeHtml(p.full_name) + '"></td>' +
              '<td>' + escapeHtml(p.email || '—') + '</td>' +
              '<td><select class="pRole">' + ['admin', 'teacher', 'student', 'parent'].map(function (r) { return '<option value="' + r + '"' + (r === p.role ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></td>' +
              '<td><input type="text" class="pGrade" value="' + escapeHtml(p.grade_level || '') + '" placeholder="e.g. Grade 4" style="width:110px;"></td>' +
              '<td><button class="btn btn-primary btn-sm pSave">Save</button></td>' +
              '</tr>';
          }).join('');

          tbody.querySelectorAll('.pSave').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var tr = btn.closest('[data-person]');
              var id = tr.getAttribute('data-person');
              var full_name = tr.querySelector('.pName').value.trim();
              var role = tr.querySelector('.pRole').value;
              var grade_level = tr.querySelector('.pGrade').value.trim() || null;
              sb.from('profiles').update({ full_name: full_name, role: role, grade_level: grade_level }).eq('id', id).then(function (res2) {
                if (res2.error) { alert(res2.error.message); return; }
                loadPeople();
              });
            });
          });
        }

        // Populate role-scoped dropdowns used elsewhere
        var teachers = rows.filter(function (p) { return p.role === 'teacher'; });
        var students = rows.filter(function (p) { return p.role === 'student'; });
        var parents = rows.filter(function (p) { return p.role === 'parent'; });
        fillSelect('newClassTeacher', teachers, '(unassigned)');
        fillSelect('enrollStudentSelect', students);
        fillSelect('linkParentSelect', parents);
        fillSelect('linkStudentSelect', students);
      });
    }

    function fillSelect(id, list, emptyLabel) {
      var el = document.getElementById(id);
      if (!el) return;
      var opts = (emptyLabel ? '<option value="">' + emptyLabel + '</option>' : '') +
        list.map(function (p) { return '<option value="' + p.id + '">' + escapeHtml(p.full_name) + '</option>'; }).join('');
      el.innerHTML = opts || '<option value="">None yet</option>';
    }

    function loadSubjects() {
      var tbody = document.querySelector('#subjectsTable tbody');
      return sb.from('subjects').select('*').order('grade_level').order('name').then(function (res) {
        var rows = res.data || [];
        cache.subjects = rows;
        cache.subjectsById = {};
        rows.forEach(function (s) { cache.subjectsById[s.id] = s; });

        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No subjects yet.</td></tr>'; }
        else {
          tbody.innerHTML = rows.map(function (s) {
            return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + escapeHtml(s.grade_level) + '</td>' +
              '<td><button class="btn btn-outline-dark btn-sm delSubject" data-id="' + s.id + '">Delete</button></td></tr>';
          }).join('');
          tbody.querySelectorAll('.delSubject').forEach(function (btn) {
            btn.addEventListener('click', function () {
              if (!confirm('Delete this subject? Classes using it will also be removed.')) return;
              sb.from('subjects').delete().eq('id', btn.getAttribute('data-id')).then(function () { loadSubjects(); loadClasses(); });
            });
          });
        }

        fillSelect('newClassSubject', rows.map(function (s) { return { id: s.id, full_name: s.name + ' (' + s.grade_level + ')' }; }));
      });
    }

    function loadClasses() {
      var tbody = document.querySelector('#classesTable tbody');
      return sb.from('classes').select('*').order('grade_level').order('name').then(function (res) {
        var rows = res.data || [];
        cache.classes = rows;
        cache.classesById = {};
        rows.forEach(function (c) { cache.classesById[c.id] = c; });

        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No classes yet.</td></tr>'; }
        else {
          tbody.innerHTML = rows.map(function (c) {
            var subj = cache.subjectsById[c.subject_id];
            var teacher = cache.profilesById[c.teacher_id];
            return '<tr><td>' + escapeHtml(c.name) + '</td><td>' + escapeHtml(subj ? subj.name : '—') + '</td><td>' + escapeHtml(teacher ? teacher.full_name : 'Unassigned') + '</td><td>' + escapeHtml(c.grade_level) + '</td>' +
              '<td><button class="btn btn-outline-dark btn-sm delClass" data-id="' + c.id + '">Delete</button></td></tr>';
          }).join('');
          tbody.querySelectorAll('.delClass').forEach(function (btn) {
            btn.addEventListener('click', function () {
              if (!confirm('Delete this class? Enrollments, attendance, and grades for it will also be removed.')) return;
              sb.from('classes').delete().eq('id', btn.getAttribute('data-id')).then(function () { loadClasses(); loadEnrollments(); initAdminClassPicker(); });
            });
          });
        }

        fillSelect('enrollClassSelect', rows.map(function (c) { return { id: c.id, full_name: c.name }; }));
      });
    }

    function loadEnrollments() {
      var tbody = document.querySelector('#enrollmentsTable tbody');
      sb.from('enrollments').select('*').then(function (res) {
        var rows = res.data || [];
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No enrollments yet.</td></tr>'; return; }
        tbody.innerHTML = rows.map(function (e) {
          var student = cache.profilesById[e.student_id];
          var cls = cache.classesById[e.class_id];
          return '<tr><td>' + escapeHtml(student ? student.full_name : e.student_id) + '</td><td>' + escapeHtml(cls ? cls.name : e.class_id) + '</td>' +
            '<td><button class="btn btn-outline-dark btn-sm delEnroll" data-id="' + e.id + '">Remove</button></td></tr>';
        }).join('');
        tbody.querySelectorAll('.delEnroll').forEach(function (btn) {
          btn.addEventListener('click', function () {
            sb.from('enrollments').delete().eq('id', btn.getAttribute('data-id')).then(function () { loadEnrollments(); });
          });
        });
      });
    }

    function loadParentLinks() {
      var tbody = document.querySelector('#linksTable tbody');
      sb.from('parent_links').select('*').then(function (res) {
        var rows = res.data || [];
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No parent-student links yet.</td></tr>'; return; }
        tbody.innerHTML = rows.map(function (l) {
          var parent = cache.profilesById[l.parent_id];
          var student = cache.profilesById[l.student_id];
          return '<tr><td>' + escapeHtml(parent ? parent.full_name : l.parent_id) + '</td><td>' + escapeHtml(student ? student.full_name : l.student_id) + '</td>' +
            '<td><button class="btn btn-outline-dark btn-sm delLink" data-id="' + l.id + '">Remove</button></td></tr>';
        }).join('');
        tbody.querySelectorAll('.delLink').forEach(function (btn) {
          btn.addEventListener('click', function () {
            sb.from('parent_links').delete().eq('id', btn.getAttribute('data-id')).then(function () { loadParentLinks(); });
          });
        });
      });
    }

    function initAdminClassPicker() {
      var picker = document.getElementById('adminClassPicker');
      var workspace = document.getElementById('adminClassWorkspace');
      if (!cache.classes.length) {
        picker.innerHTML = '<option>No classes yet — add one in "Subjects & Classes"</option>';
        workspace.innerHTML = '';
        return;
      }
      picker.innerHTML = cache.classes.map(function (c) { return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>'; }).join('');
      renderClassWorkspace(workspace, cache.classes[0].id);
      picker.onchange = function () { renderClassWorkspace(workspace, picker.value); };
    }

  });
})();
