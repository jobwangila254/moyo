const API = window.location.origin;
let token = localStorage.getItem('adminToken');
let currentUserPage = 1;
let currentReportPage = 1;

function debounce(fn, ms) { let t; return function() { clearTimeout(t); t = setTimeout(() => fn(), ms); }; }
function $(id) { return document.getElementById(id); }

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  const page = $('page-' + name);
  const link = document.querySelector('nav a[data-page="' + name + '"]');
  if (page) page.classList.add('active');
  if (link) link.classList.add('active');
  document.querySelector('aside').classList.remove('open');
  if (name === 'dashboard') loadDashboard();
  if (name === 'users') loadUsers();
  if (name === 'reports') loadReports();
  if (name === 'analytics') loadAnalytics();
}

async function api(path, opts) {
  opts = opts || {};
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var res = await fetch(API + path, Object.assign({}, opts, { headers: headers }));
  if (res.status === 401) { doLogout(); throw new Error('Unauthorized'); }
  return res.json();
}

async function doLogin() {
  var phone = $('loginPhone').value.trim();
  var password = $('loginPassword').value;
  var err = $('loginError');
  try {
    var data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ phone: phone, password: password }) });
    if (!data.success) { err.textContent = data.error; err.style.display = 'block'; return; }
    token = data.data.token;
    localStorage.setItem('adminToken', token);
    $('adminName').textContent = data.data.user.name;
    $('loginOverlay').style.display = 'none';
    loadDashboard();
  } catch (e) { err.textContent = 'Login failed'; err.style.display = 'block'; }
}

function doLogout() {
  token = null;
  localStorage.removeItem('adminToken');
  $('loginOverlay').style.display = 'flex';
  $('loginPhone').value = '';
  $('loginPassword').value = '';
  $('loginError').style.display = 'none';
}

function closeModal(id) { $(id).classList.remove('show'); }
function formatNum(n) { return n == null ? '0' : n.toLocaleString(); }
function formatDate(d) { return new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }); }
function badge(cls, text) { return '<span class="badge badge-' + cls + '">' + text + '</span>'; }

async function loadDashboard() {
  try {
    var results = await Promise.all([
      api('/api/admin/analytics/overview'),
      api('/api/admin/analytics/signups'),
    ]);
    var overview = results[0];
    var signups = results[1];
    if (overview.success) {
      var d = overview.data;
      $('overviewStats').innerHTML = [
        statCard('Total Users', formatNum(d.totalUsers), 'pink'),
        statCard('Active Users', formatNum(d.activeUsers), 'green'),
        statCard('Premium Users', formatNum(d.premiumUsers), 'blue'),
        statCard('Today Signups', formatNum(d.todayUsers), 'pink'),
        statCard('Matches', formatNum(d.totalMatches), 'orange'),
        statCard('Messages', formatNum(d.totalMessages), 'blue'),
        statCard('Pending Reports', formatNum(d.pendingReports), 'orange'),
        statCard('Flagged Photos', formatNum(d.flaggedPhotos), 'pink'),
        statCard('Total Revenue', 'KES ' + formatNum(d.totalRevenue), 'green'),
      ].join('');
    }
    if (signups.success && signups.data.length) {
      var max = Math.max.apply(null, signups.data.map(function(d) { return d.count; }).concat([1]));
      var bars = signups.data.map(function(d) {
        return '<div class="chart-bar" style="height:' + Math.max((d.count / max) * 100, 2) + '%"><div class="tooltip">' + d.date + ': ' + d.count + '</div></div>';
      }).join('');
      $('signupChart').innerHTML = bars;
      $('signupLabels').innerHTML = '<span>' + signups.data[0].date + '</span><span>' + signups.data[signups.data.length - 1].date + '</span>';
    }
  } catch (e) { console.error(e); }
}

function statCard(label, value, color) {
  return '<div class="stat-card"><div class="label">' + label + '</div><div class="value ' + color + '">' + value + '</div></div>';
}

async function loadUsers() {
  var search = $('userSearch').value;
  var tier = $('userTierFilter').value;
  var active = $('userActiveFilter').value;
  try {
    var res = await api('/api/admin/users?page=' + currentUserPage + '&search=' + encodeURIComponent(search) + '&tier=' + tier + '&isActive=' + active);
    if (!res.success) return;
    $('usersTable').innerHTML = res.data.length ? res.data.map(function(u) {
      return '<tr><td>' + u.id + '</td><td>' + u.name + '</td><td>' + u.phone + '</td><td>' + u.age + '</td><td>' + (u.county ? u.county.name : '-') + '</td><td>' + badge(u.tier === 'PREMIUM' ? 'premium' : 'free', u.tier) + '</td><td>' + (u.role === 'ADMIN' ? badge('admin', 'Admin') : '-') + '</td><td>' + badge(u.isActive ? 'active' : 'inactive', u.isActive ? 'Active' : 'Inactive') + '</td><td>' + formatDate(u.createdAt) + '</td><td><button class="btn btn-sm edit-user-btn" data-id="' + u.id + '">Edit</button> <button class="btn btn-sm btn-danger delete-user-btn" data-id="' + u.id + '">Deactivate</button></td></tr>';
    }).join('') : '<tr><td colspan="10" class="empty">No users found</td></tr>';
    var p = res.pagination;
    var prevDisabled = p.page <= 1 ? ' disabled' : '';
    var nextDisabled = p.page >= p.totalPages ? ' disabled' : '';
    $('usersPagination').innerHTML = '<button id="usersPrev"' + prevDisabled + '>Prev</button><span>Page ' + p.page + ' of ' + p.totalPages + ' (' + p.total + ' total)</span><button id="usersNext"' + nextDisabled + '>Next</button>';
    var prevBtn = $('usersPrev');
    var nextBtn = $('usersNext');
    if (prevBtn) prevBtn.addEventListener('click', function() { currentUserPage--; loadUsers(); });
    if (nextBtn) nextBtn.addEventListener('click', function() { currentUserPage++; loadUsers(); });
    document.querySelectorAll('.edit-user-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { editUser(parseInt(this.getAttribute('data-id'))); });
    });
    document.querySelectorAll('.delete-user-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { deleteUser(parseInt(this.getAttribute('data-id'))); });
    });
  } catch (e) { console.error(e); }
}

async function editUser(id) {
  try {
    var res = await api('/api/admin/users/' + id);
    if (!res.success) return;
    var u = res.data;
    $('userModalTitle').textContent = 'Edit User: ' + u.name;
    var photosHtml = '';
    if (u.photos && u.photos.length) {
      photosHtml = '<label style="margin-top:12px">Photos</label><div class="photo-grid">' + u.photos.map(function(p) { return '<img src="' + p + '" alt="photo">'; }).join('') + '</div>';
    }
    var reportsHtml = '';
    if (u.reports && u.reports.length) {
      reportsHtml = '<label style="margin-top:12px">Reports Against</label><div style="font-size:13px;margin-top:4px">' + u.reports.map(function(r) { return '<div style="padding:4px 0;border-bottom:1px solid var(--border)">' + r.reason + ' \u2014 by ' + r.reporter.name + ' (' + formatDate(r.createdAt) + ')</div>'; }).join('') + '</div>';
    }
    $('userModalContent').innerHTML = '<input type="hidden" id="editUserId" value="' + u.id + '">' +
      '<div class="user-detail-grid">' +
      '<div><label>Name</label><input id="editName" value="' + (u.name || '') + '"></div>' +
      '<div><label>Bio</label><input id="editBio" value="' + (u.bio || '') + '"></div>' +
      '<div><label>Occupation</label><input id="editOccupation" value="' + (u.occupation || '') + '"></div>' +
      '<div><label>Tier</label><select id="editTier"><option value="FREE"' + (u.tier === 'FREE' ? ' selected' : '') + '>Free</option><option value="PREMIUM"' + (u.tier === 'PREMIUM' ? ' selected' : '') + '>Premium</option></select></div>' +
      '<div><label>Role</label><select id="editRole"><option value="USER"' + (u.role === 'USER' ? ' selected' : '') + '>User</option><option value="ADMIN"' + (u.role === 'ADMIN' ? ' selected' : '') + '>Admin</option></select></div>' +
      '<div><label>Photo Status</label><select id="editPhotoStatus"><option value="approved"' + (u.photoModerationStatus === 'approved' ? ' selected' : '') + '>Approved</option><option value="flagged"' + (u.photoModerationStatus === 'flagged' ? ' selected' : '') + '>Flagged</option></select></div>' +
      '<div><label>Phone Verified</label><select id="editPhoneVerified"><option value="true"' + (u.phoneVerified ? ' selected' : '') + '>Yes</option><option value="false"' + (!u.phoneVerified ? ' selected' : '') + '>No</option></select></div>' +
      '</div>' + photosHtml + reportsHtml;
    $('userModal').classList.add('show');
  } catch (e) { console.error(e); }
}

async function saveUserEdit() {
  var id = $('editUserId').value;
  try {
    await api('/api/admin/users/' + id, {
      method: 'PUT',
      body: JSON.stringify({
        name: $('editName').value,
        bio: $('editBio').value,
        occupation: $('editOccupation').value,
        tier: $('editTier').value,
        role: $('editRole').value,
        photoModerationStatus: $('editPhotoStatus').value,
        phoneVerified: $('editPhoneVerified').value === 'true',
      }),
    });
    closeModal('userModal');
    loadUsers();
  } catch (e) { console.error(e); }
}

async function deleteUser(id) {
  if (!confirm('Deactivate this user?')) return;
  try {
    await api('/api/admin/users/' + id, { method: 'DELETE' });
    loadUsers();
  } catch (e) { console.error(e); }
}

async function loadReports() {
  var status = $('reportStatusFilter').value;
  try {
    var res = await api('/api/admin/reports?page=' + currentReportPage + '&status=' + status);
    if (!res.success) return;
    $('reportsTable').innerHTML = res.data.length ? res.data.map(function(r) {
      return '<tr><td>' + r.id + '</td><td>' + r.reporter.name + ' (' + r.reporter.phone + ')</td><td>' + r.reported.name + ' (' + r.reported.phone + ')</td><td>' + r.reason + '</td><td>' + badge(r.status, r.status) + '</td><td>' + formatDate(r.createdAt) + '</td><td><select class="report-status-select" data-id="' + r.id + '" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:11px"><option value="">Change...</option><option value="pending">Pending</option><option value="reviewed">Reviewed</option><option value="dismissed">Dismissed</option><option value="resolved">Resolved</option></select></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">No reports found</td></tr>';
    var p = res.pagination;
    var prevDisabled = p.page <= 1 ? ' disabled' : '';
    var nextDisabled = p.page >= p.totalPages ? ' disabled' : '';
    $('reportsPagination').innerHTML = '<button id="reportsPrev"' + prevDisabled + '>Prev</button><span>Page ' + p.page + ' of ' + p.totalPages + ' (' + p.total + ' total)</span><button id="reportsNext"' + nextDisabled + '>Next</button>';
    var prevBtn = $('reportsPrev');
    var nextBtn = $('reportsNext');
    if (prevBtn) prevBtn.addEventListener('click', function() { currentReportPage--; loadReports(); });
    if (nextBtn) nextBtn.addEventListener('click', function() { currentReportPage++; loadReports(); });
    document.querySelectorAll('.report-status-select').forEach(function(sel) {
      sel.addEventListener('change', function() { updateReport(parseInt(this.getAttribute('data-id')), this.value); });
    });
  } catch (e) { console.error(e); }
}

async function updateReport(id, status) {
  if (!status) return;
  try {
    await api('/api/admin/reports/' + id, { method: 'PUT', body: JSON.stringify({ status: status }) });
    loadReports();
  } catch (e) { console.error(e); }
}

async function loadAnalytics() {
  try {
    var res = await api('/api/admin/analytics/events');
    if (!res.success) return;
    var max = Math.max.apply(null, res.data.map(function(e) { return e.count; }).concat([1]));
    $('eventsList').innerHTML = res.data.length ? res.data.map(function(e) {
      return '<div class="event-row"><div class="event-name">' + e.eventType + '</div><div class="event-bar-bg"><div class="event-bar-fill" style="width:' + (e.count / max) * 100 + '%"></div></div><div class="event-count">' + formatNum(e.count) + '</div></div>';
    }).join('') : '<div class="empty">No events recorded</div>';
  } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', function() {
  $('loginBtn').addEventListener('click', doLogin);
  $('logoutBtn').addEventListener('click', doLogout);
  $('mobileToggle').addEventListener('click', function() { document.querySelector('aside').classList.toggle('open'); });
  $('userModalClose').addEventListener('click', function() { closeModal('userModal'); });
  $('userModalSave').addEventListener('click', saveUserEdit);

  $('loginPassword').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  $('loginPhone').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });

  document.querySelectorAll('nav a[data-page]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      showPage(this.getAttribute('data-page'));
    });
  });

  var userSearchTimeout;
  $('userSearch').addEventListener('input', function() {
    clearTimeout(userSearchTimeout);
    userSearchTimeout = setTimeout(loadUsers, 300);
  });
  $('userTierFilter').addEventListener('change', loadUsers);
  $('userActiveFilter').addEventListener('change', loadUsers);
  $('reportStatusFilter').addEventListener('change', loadReports);

  if (token) {
    api('/api/admin/analytics/overview').then(function(res) {
      if (res.success) {
        $('loginOverlay').style.display = 'none';
        $('adminName').textContent = 'Admin';
        loadDashboard();
      } else {
        doLogout();
      }
    }).catch(function() { doLogout(); });
  }
});
