// Atlanova Global School — shared front-end behaviour

// ---------------------------------------------------------------
// Supabase setup
// Public URL + publishable/anon key are safe to expose in client-side
// code — access is restricted by Row Level Security policies on the
// database side (public can INSERT only, never SELECT other records).
// ---------------------------------------------------------------
var SUPABASE_URL = 'https://qonvtfpztpxwjrbyvrcg.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_MJD4hDxPNczfbn0FHSuF2w_p2elrD_M';
var supabaseClient = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

document.addEventListener('DOMContentLoaded', function () {

  /* Mobile nav */
  var toggle = document.querySelector('.nav-toggle');
  var mobileMenu = document.querySelector('.mobile-menu');
  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function () {
      var isOpen = mobileMenu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* Scroll reveal */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* FAQ accordion */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-a').style.maxHeight = null;
          openItem.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('open', !isOpen);
      q.setAttribute('aria-expanded', (!isOpen).toString());
      a.style.maxHeight = !isOpen ? a.scrollHeight + 'px' : null;
    });
  });

  /* Document upload widgets (apply.html step 4) */
  var docInputs = { transcript: null, idDoc: null, photo: null, other: null };
  (function () {
    var map = [
      ['dropTranscript', 'fileTranscript', 'transcript'],
      ['dropIdDoc', 'fileIdDoc', 'idDoc'],
      ['dropPhoto', 'filePhoto', 'photo'],
      ['dropOther', 'fileOther', 'other']
    ];
    map.forEach(function (row) {
      var drop = document.getElementById(row[0]);
      var input = document.getElementById(row[1]);
      if (!drop || !input) return;
      input.addEventListener('change', function () {
        var file = input.files && input.files[0] ? input.files[0] : null;
        docInputs[row[2]] = file;
        var label = drop.querySelector('[data-label]');
        var sub = drop.querySelector('[data-sub]');
        if (file) {
          drop.classList.add('has-file');
          if (label) label.textContent = file.name;
          if (sub) sub.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB — click to change';
        } else {
          drop.classList.remove('has-file');
        }
      });
    });
  })();

  /* Multi-step application form */
  var formSteps = document.querySelectorAll('.form-step');
  var stepIndicators = document.querySelectorAll('.step');
  if (formSteps.length) {
    var current = 0;

    function showStep(index) {
      formSteps.forEach(function (s, i) { s.classList.toggle('active', i === index); });
      stepIndicators.forEach(function (s, i) {
        s.classList.toggle('active', i === index);
        s.classList.toggle('done', i < index);
      });
      if (index === formSteps.length - 1) buildReview();
      window.scrollTo({ top: document.querySelector('.form-card').offsetTop - 110, behavior: 'smooth' });
    }

    document.querySelectorAll('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var stepEl = btn.closest('.form-step');
        var required = stepEl.querySelectorAll('[required]');
        var valid = true;
        required.forEach(function (field) {
          if (!field.value) { valid = false; field.style.borderColor = '#c0392b'; }
          else { field.style.borderColor = ''; }
        });

        // Step 4 (documents): require transcript + ID document specifically
        if (stepEl.querySelector('#dropTranscript')) {
          var docStatus = document.getElementById('docStatus');
          if (!docInputs.transcript || !docInputs.idDoc) {
            valid = false;
            if (docStatus) {
              docStatus.textContent = 'Please upload the report card/transcript and an ID document to continue.';
              docStatus.style.color = '#c0392b';
            }
          } else if (docStatus) {
            docStatus.textContent = '';
          }
        }

        if (!valid) return;
        if (current < formSteps.length - 1) { current++; showStep(current); }
      });
    });

    document.querySelectorAll('[data-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (current > 0) { current--; showStep(current); }
      });
    });

    function val(id) {
      var el = document.getElementById(id);
      if (!el) return '—';
      return el.value ? el.value : '—';
    }

    function buildReview() {
      var reviewEl = document.getElementById('reviewOutput');
      if (!reviewEl) return;
      reviewEl.innerHTML =
        '<div class="review-block"><h5>Student</h5><dl>' +
        '<dt>Full name</dt><dd>' + val('studentName') + '</dd>' +
        '<dt>Date of birth</dt><dd>' + val('studentDob') + '</dd>' +
        '<dt>Applying for grade</dt><dd>' + val('studentGrade') + '</dd>' +
        '<dt>Country</dt><dd>' + val('studentCountry') + '</dd>' +
        '<dt>Previous school</dt><dd>' + val('previousSchool') + '</dd>' +
        '</dl></div>' +
        '<div class="review-block"><h5>Parent / Guardian</h5><dl>' +
        '<dt>Name</dt><dd>' + val('parentName') + '</dd>' +
        '<dt>Email</dt><dd>' + val('parentEmail') + '</dd>' +
        '<dt>Phone</dt><dd>' + val('parentPhone') + '</dd>' +
        '<dt>Country</dt><dd>' + val('parentCountry') + '</dd>' +
        '<dt>Address</dt><dd>' + val('parentAddress') + '</dd>' +
        '</dl></div>' +
        '<div class="review-block"><h5>Academic Information</h5><dl>' +
        '<dt>Previous grade completed</dt><dd>' + val('academicGrade') + '</dd>' +
        '<dt>Learning needs / support</dt><dd>' + val('learningNeeds') + '</dd>' +
        '</dl></div>' +
        '<div class="review-block"><h5>Documents</h5><dl>' +
        '<dt>Transcript / report card</dt><dd>' + (docInputs.transcript ? docInputs.transcript.name : 'Not uploaded') + '</dd>' +
        '<dt>ID document</dt><dd>' + (docInputs.idDoc ? docInputs.idDoc.name : 'Not uploaded') + '</dd>' +
        '<dt>Photo</dt><dd>' + (docInputs.photo ? docInputs.photo.name : '—') + '</dd>' +
        '<dt>Other document</dt><dd>' + (docInputs.other ? docInputs.other.name : '—') + '</dd>' +
        '</dl></div>';
    }

    var submitBtn = document.getElementById('submitApplication');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var confirmBox = document.getElementById('confirmAccurate');
        if (confirmBox && !confirmBox.checked) {
          confirmBox.focus();
          return;
        }

        var statusEl = document.getElementById('applicationStatus');

        function goToConfirmation() {
          current++;
          showStep(current);
        }

        if (!supabaseClient) {
          // Supabase client not available (e.g. script blocked) — still let
          // the user see a confirmation rather than a dead end.
          goToConfirmation();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading documents…';
        if (statusEl) { statusEl.textContent = ''; }

        function makeId() {
          if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
          return 'app-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        }
        var folder = makeId();

        function uploadDoc(file) {
          if (!file) return Promise.resolve(null);
          var safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
          var path = folder + '/' + Date.now() + '_' + safeName;
          return supabaseClient.storage.from('application-documents').upload(path, file, { upsert: false })
            .then(function (res) {
              if (res.error) { throw res.error; }
              return path;
            });
        }

        Promise.all([
          uploadDoc(docInputs.transcript),
          uploadDoc(docInputs.idDoc),
          uploadDoc(docInputs.photo),
          uploadDoc(docInputs.other)
        ]).then(function (paths) {
          submitBtn.textContent = 'Submitting…';
          var transcriptPath = paths[0], idDocPath = paths[1], photoPath = paths[2], otherPath = paths[3];

          return supabaseClient.from('applications').insert({
            student_name: val('studentName'),
            student_dob: document.getElementById('studentDob').value || null,
            student_grade: val('studentGrade'),
            student_country: val('studentCountry'),
            previous_school: val('previousSchool') === '—' ? null : val('previousSchool'),
            parent_name: val('parentName'),
            parent_email: val('parentEmail'),
            parent_phone: val('parentPhone'),
            parent_country: val('parentCountry'),
            parent_address: val('parentAddress') === '—' ? null : val('parentAddress'),
            academic_grade: val('academicGrade') === '—' ? null : val('academicGrade'),
            learning_needs: val('learningNeeds') === '—' ? null : val('learningNeeds'),
            transcript_path: transcriptPath,
            id_document_path: idDocPath,
            photo_path: photoPath,
            other_document_path: otherPath
          }).then(function (result) {
            if (result.error) { throw result.error; }
            return paths;
          });
        }).then(function (paths) {
          // Best-effort: build 60-day signed links and email the admissions inbox.
          // If this step fails for any reason, the application is already saved
          // in Supabase, so we still show the confirmation screen.
          var labels = ['Transcript', 'ID document', 'Photo', 'Other document'];
          Promise.all(paths.map(function (p) {
            if (!p) return Promise.resolve(null);
            return supabaseClient.storage.from('application-documents').createSignedUrl(p, 60 * 60 * 24 * 60)
              .then(function (r) { return (r.data && r.data.signedUrl) ? r.data.signedUrl : null; })
              .catch(function () { return null; });
          })).then(function (links) {
            var docLines = links.map(function (l, i) { return l ? (labels[i] + ': ' + l) : null; }).filter(Boolean).join('\n');
            fetch('https://formsubmit.co/ajax/jawadimustafa7@gmail.com', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                _subject: 'New Atlanova application — ' + val('studentName'),
                'Student name': val('studentName'),
                'Applying for grade': val('studentGrade'),
                'Student country': val('studentCountry'),
                'Previous school': val('previousSchool'),
                'Parent name': val('parentName'),
                'Parent email': val('parentEmail'),
                'Parent phone': val('parentPhone'),
                'Learning needs': val('learningNeeds'),
                'Documents (links valid 60 days)': docLines || 'None uploaded'
              })
            }).catch(function () { /* non-fatal */ });
          });
        }).then(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Application';
          goToConfirmation();
        }).catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Application';
          if (statusEl) {
            statusEl.textContent = 'Something went wrong submitting your application. Please try again or email jawadimustafa7@gmail.com directly.';
            statusEl.style.color = '#c0392b';
          }
          console.error(err);
        });
      });
    }
  }

  /* Contact form */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('cName');
      var email = document.getElementById('cEmail');
      var topic = document.getElementById('cTopic');
      var message = document.getElementById('cMessage');
      var statusEl = document.getElementById('contactStatus');
      var submitBtn = contactForm.querySelector('button[type="submit"]');

      if (!name.value || !email.value || !message.value) {
        if (statusEl) {
          statusEl.textContent = 'Please fill in your name, email, and message.';
          statusEl.style.color = '#c0392b';
        }
        return;
      }

      if (!supabaseClient) {
        if (statusEl) {
          statusEl.textContent = 'Message could not be sent right now — please email jawadimustafa7@gmail.com directly.';
          statusEl.style.color = '#c0392b';
        }
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      if (statusEl) { statusEl.textContent = ''; }

      supabaseClient.from('contact_messages').insert({
        name: name.value,
        email: email.value,
        topic: topic ? topic.value : null,
        message: message.value
      }).then(function (result) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
        if (result.error) {
          if (statusEl) {
            statusEl.textContent = 'Something went wrong sending your message. Please try again or email jawadimustafa7@gmail.com directly.';
            statusEl.style.color = '#c0392b';
          }
          return;
        }
        fetch('https://formsubmit.co/ajax/jawadimustafa7@gmail.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            _subject: 'New Atlanova contact message — ' + name.value,
            Name: name.value,
            Email: email.value,
            Topic: topic ? topic.value : '—',
            Message: message.value
          })
        }).catch(function () { /* non-fatal — message is already saved in Supabase */ });
        contactForm.reset();
        if (statusEl) {
          statusEl.textContent = 'Message sent — thank you! We\'ll get back to you soon.';
          statusEl.style.color = '#1a7a4c';
        }
      });
    });
  }

});
