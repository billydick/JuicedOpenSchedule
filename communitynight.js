// Community Night Championship — lazy-loaded page logic.
// Data: communitynight_data.json. Each view (a season or a whole year) is registered in the
// site's SEASON_DATA so the existing Juiced Open driver / race-results modals work unchanged.
(function () {
  var CN = { data: null, year: null, seasonKey: null, view: 'season', loading: false };

  function $(id) { return document.getElementById(id); }
  function isCnActive() {
    var p = $('page-communitynight');
    return !!(p && p.classList.contains('active'));
  }
  function currentKey() {
    if (!CN.data) return null;
    if (CN.view === 'year') return (yearObj() || {}).key;
    return CN.seasonKey;
  }
  function yearObj() {
    return (CN.data.years || []).filter(function (y) { return y.year === CN.year; })[0];
  }

  // ── Hook the shared modals: when the CN page is showing, they read the CN view ──
  var _origActiveTab = window.getActiveTabId;
  window.getActiveTabId = function () {
    if (isCnActive() && currentKey()) return currentKey();
    return _origActiveTab();
  };

  var _origOpenDriver = window.openDriver;
  window.openDriver = function (did) {
    _origOpenDriver(did);
    if (!isCnActive()) return;
    var sd = SEASON_DATA[currentKey()];
    var s = sd && sd.standings[did];
    if (!s) return;
    $('modalMeta').textContent = s.starts + ' starts • ' + s.avg_inc + ' inc/race avg • S/F ' + s.sf;
    var arc = $('modalStats').querySelector('.modal-arc-tile');
    var tiles = [['PTS', s.pts], ['WINS', s.wins], ['PODIUMS', s.podiums], ['TOP 5', s.top5],
                 ['SCORED', s.scored + '/' + s.starts], ['POS', 'P' + s.pos]];
    $('modalStats').innerHTML = (arc ? arc.outerHTML : '') + tiles.map(function (x) {
      return '<div class="modal-stat"><div class="modal-stat-val">' + x[1] + '</div><div class="modal-stat-label">' + x[0] + '</div></div>';
    }).join('');
  };

  // ── Data ──
  function load(cb) {
    if (CN.data) { cb(); return; }
    if (CN.loading) return;
    CN.loading = true;
    fetch('communitynight_data.json?ts=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        CN.data = d;
        Object.keys(d.views || {}).forEach(function (k) {
          var v = d.views[k];
          SEASON_DATA[k] = { season_id: v.season_id, standings: v.standings, history: v.history, races: v.races };
        });
        var def = d.default_view;
        var y = (d.years || []).filter(function (y) { return y.seasons.some(function (s) { return s.key === def; }); })[0] || (d.years || [])[0];
        if (y) {
          CN.year = y.year;
          CN.seasonKey = def || (y.seasons[y.seasons.length - 1] || {}).key;
        }
        CN.loading = false;
        cb();
      })
      .catch(function (e) {
        CN.loading = false;
        $('cn-lb-body').innerHTML = '<div class="cn-empty">Community Night data unavailable</div>';
        hideOverlay();
        console.error('communitynight:', e);
      });
  }

  // ── Render ──
  function renderControls() {
    var years = CN.data.years || [];
    $('cn-year-pills').innerHTML = years.map(function (y) {
      return '<button class="cn-pill' + (y.year === CN.year ? ' active' : '') + '" onclick="cnSetYear(' + y.year + ')">' + y.year + '</button>';
    }).join('');

    var y = yearObj();
    var byNum = {};
    (y ? y.seasons : []).forEach(function (s) { byNum[s.num] = s; });
    var pills = '';
    for (var n = 1; n <= 4; n++) {
      var s = byNum[n];
      var active = CN.view === 'season' && s && s.key === CN.seasonKey;
      pills += '<button class="cn-pill' + (active ? ' active' : '') + '"' +
        (s && CN.view === 'season' ? ' onclick="cnSetSeason(\'' + s.key + '\')"' : ' disabled') +
        (s ? ' title="Started ' + s.start_date + '"' : ' title="Not started"') + '>' +
        'S' + n + (s && s.active ? '<span class="cn-live-dot"></span>' : '') + '</button>';
    }
    $('cn-season-pills').innerHTML = pills;

    document.querySelectorAll('#cn-view-toggle .cn-toggle-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === CN.view);
    });
  }

  function renderView() {
    var key = currentKey();
    var v = CN.data.views[key];
    if (!v) {
      $('cn-lb-body').innerHTML = '<div class="cn-empty">No races yet</div>';
      $('cn-nights').innerHTML = '';
      $('cn-stats').innerHTML = '';
      return;
    }
    $('cn-title').textContent = (CN.view === 'year' ? CN.year + ' Yearly' : v.label) + ' — Standings';
    $('cn-subtitle').textContent = CN.view === 'year'
      ? 'Points • Every scored race in ' + CN.year + ' (Seasons 1–4)'
      : 'Points • Every race counts • 51% laps';

    var st = v.stats || {};
    $('cn-stats').innerHTML = [
      ['Race Nights', st.nights, ''], ['Races', st.races, ''], ['Drivers', st.drivers, '']
    ].map(function (x) {
      return '<div class="cn-stat"><div class="cn-stat-val ' + x[2] + '">' + (x[1] == null ? '—' : x[1]) + '</div><div class="cn-stat-label">' + x[0] + '</div></div>';
    }).join('');

    $('cn-lb-body').innerHTML = v.standings_html || '<div class="cn-empty">No scored races yet</div>';
    $('cn-nights').innerHTML = v.nights_html || '<div class="cn-empty">No race nights yet</div>';

    var banner = $('cn-mock-banner');
    if (CN.data.mock && !banner) {
      banner = document.createElement('div');
      banner.id = 'cn-mock-banner';
      banner.className = 'cn-mock-banner';
      banner.textContent = 'Mockup — sample data from recent Juiced Open races';
      document.querySelector('.cn-controls').insertAdjacentElement('afterend', banner);
    }
  }

  function render() {
    renderControls();
    renderView();
    hideOverlay();
  }

  function hideOverlay() {
    var ov = $('cn-loading-overlay');
    if (!ov || !ov.classList.contains('visible')) return;
    ov.style.transition = 'opacity .6s ease-out';
    ov.style.opacity = '0';
    setTimeout(function () { ov.classList.remove('visible'); ov.style.opacity = ''; ov.style.transition = ''; }, 600);
  }

  // ── Sub-nav (ported from setSubPage; scoped to the CN page) ──
  CN.sub = 'standings';
  window.cnSetSubPage = function (name) {
    CN.sub = name;
    document.querySelectorAll('#page-communitynight .cn-sub-page').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('#page-communitynight .sub-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-cn-sub') === name);
    });
    var sp = $('cn-sub-' + name);
    if (sp) sp.classList.add('active');
    if (name === 'drivers') cnInitDriversPage();
  };

  // ── DRIVERS PAGE (ported from the Juiced Open drivers lookup; data from CN.data.drivers) ──
  var cnDriversInited = false;
  var cnCarouselIdx = 0;
  var cnCarouselTimer = null;

  function cnCareer() { return (CN.data && CN.data.drivers && CN.data.drivers.career) || {}; }

  // was getSeason1Standings(): look in the active CN season instead of JO seasons
  function cnActiveStandings(did) {
    var sd = CN.data && SEASON_DATA[CN.data.default_view];
    return (sd && sd.standings && sd.standings[did]) || null;
  }

  function cnDriverBadgeHtml(did) {
    var logo = TEAM_MAP[did];
    if (logo) return '<img class="carousel-card-logo" src="team_logos/' + logo + '" alt="" onerror="this.style.display=&quot;none&quot;">';
    var s = cnActiveStandings(did);
    if (!s || !s.arc_emoji) return '';
    var arc = s.arc_emoji;
    if (arc === 'SNIPER_SVG') return SNIPER_SVG_LARGE;
    return '<div class="carousel-card-badge">' + arc + '</div>';
  }

  function cnArcLabelColor(did) {
    var s = cnActiveStandings(did);
    if (!s) return { label: '', color: 'rgba(200,200,200,.55)' };
    return { label: s.arc_label || '', color: s.arc_color || 'rgba(200,200,200,.55)' };
  }

  function cnRenderDriverNameRow(d) {
    var did = d.did;
    var cd = cnCareer()[did];
    if (!cd) return '';
    var ac = cnArcLabelColor(did);
    var seasonsStr = cd.seasons === 1 ? '1 season' : cd.seasons + ' seasons';
    var startsStr = cd.total_starts + (cd.total_starts === 1 ? ' start' : ' starts');
    return '<div class="driver-name-row" data-did="' + did + '">'
      + '<div class="dnr-name" style="color:' + d.name_color + '">' + d.name + '</div>'
      + (ac.label ? '<div class="dnr-arc" style="color:' + ac.color + '">' + ac.label + '</div>' : '')
      + '<div class="dnr-starts">' + seasonsStr + ' &bull; ' + startsStr + '</div>'
      + '</div>';
  }

  window.cnFilterDrivers = function (q) {
    var all = (CN.data && CN.data.drivers && CN.data.drivers.all) || [];
    var grid = $('cnDriversGrid');
    var countEl = $('cnDriversCount');
    var hero = $('cnDriversHero');
    q = (q || '').trim().toLowerCase();
    if (q) {
      var filtered = all.filter(function (d) { return d.name.toLowerCase().indexOf(q) !== -1; });
      grid.innerHTML = filtered.map(cnRenderDriverNameRow).join('');
      grid.style.display = 'flex';
      grid.style.flexDirection = 'column';
      countEl.textContent = filtered.length + ' DRIVER' + (filtered.length !== 1 ? 'S' : '');
      if (hero) hero.style.display = 'none';
    } else {
      grid.innerHTML = '';
      grid.style.display = 'none';
      countEl.textContent = '';
      if (hero) hero.style.display = 'block';
    }
  };

  function cnInitDriversPage() {
    if (cnDriversInited || !CN.data) return;
    cnDriversInited = true;
    var n = ((CN.data.drivers || {}).all || []).length;
    $('cnDriversSearch').placeholder = 'Search ' + n + ' drivers...';
    cnRenderCarousel();
  }

  function cnRenderCarousel() {
    var cards = (CN.data.drivers || {}).carousel || [];
    if (!cards.length) return;
    var track = $('cnDriversCarouselTrack');
    var dotsEl = $('cnDriversCarouselDots');
    if (!track) return;

    track.innerHTML = cards.map(function (c, i) {
      var did = c.did;
      var ac = cnArcLabelColor(did);
      var badgeHtml = cnDriverBadgeHtml(did);
      var bgStyle = c.track_img ? 'background-image:url(' + c.track_img + ');background-position:center center' : 'background:#111';
      var champHtml = c.champ_pos ? 'P' + c.champ_pos + ' IN ' + c.champ_label + ' &bull; ' + c.champ_pts + ' PTS' : '';
      return '<div class="cn-carousel-card' + (i === 0 ? ' active' : '') + '" data-did="' + did + '">'
        + '<div class="carousel-card-bg" style="' + bgStyle + '"></div>'
        + '<div class="carousel-card-overlay"></div>'
        + '<div class="carousel-card-content">'
        + (champHtml ? '<div class="carousel-card-champ-pos">' + champHtml + '</div>' : '')
        + '<div class="carousel-card-driver-row">'
        + badgeHtml
        + '<div class="carousel-card-name" style="color:' + c.name_color + '">' + c.name + '</div>'
        + '</div>'
        + '<div class="carousel-card-hook">' + c.hook + '</div>'
        + '<div class="carousel-card-meta">'
        + '<div class="carousel-card-meta-item">TRACK<span>' + c.track + '</span></div>'
        + '<div class="carousel-card-meta-item">DATE<span>' + c.date + '</span></div>'
        + (ac.label ? '<div class="carousel-card-meta-item">STYLE<span>' + ac.label + '</span></div>' : '')
        + '</div>'
        + '</div></div>';
    }).join('');

    dotsEl.innerHTML = cards.map(function (c, i) {
      return '<div class="cn-carousel-dot' + (i === 0 ? ' active' : '') + '" onclick="cnGoCarousel(' + i + ')"></div>';
    }).join('');

    cnStartCarousel();
    track.addEventListener('touchstart', function () { clearInterval(cnCarouselTimer); }, { passive: true });
    track.addEventListener('touchend', cnStartCarousel);
  }

  window.cnGoCarousel = function (idx) {
    var cards = document.querySelectorAll('#cnDriversCarouselTrack .cn-carousel-card');
    var dots = document.querySelectorAll('#cnDriversCarouselDots .cn-carousel-dot');
    cards.forEach(function (c, i) {
      if (c.classList.contains('active') && i !== idx) {
        c.style.opacity = '0';
        setTimeout(function () { c.classList.remove('active'); c.style.opacity = ''; }, 400);
      }
    });
    setTimeout(function () {
      cards.forEach(function (c, i) { if (i === idx) { c.classList.add('active'); } });
    }, 400);
    dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    cnCarouselIdx = idx;
  };

  function cnStartCarousel() {
    clearInterval(cnCarouselTimer);
    var n = ((CN.data.drivers || {}).carousel || []).length;
    cnCarouselTimer = setInterval(function () {
      cnCarouselIdx = (cnCarouselIdx + 1) % n;
      cnGoCarousel(cnCarouselIdx);
    }, 15000);
  }

  // Carousel card click -> career modal (the site's global handler covers .driver-name-row)
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.cn-carousel-card');
    if (card && card.getAttribute('data-did')) openCareerModal(card.getAttribute('data-did'));
  });

  // Career modal: same openCareerModal, reading CN career data while the CN page is showing
  var _origOpenCareer = window.openCareerModal;
  window.openCareerModal = function (did) {
    if (!isCnActive()) return _origOpenCareer(did);
    var joCareer = window.CAREER_DATA;
    window.CAREER_DATA = cnCareer();
    try { _origOpenCareer(did); } finally { window.CAREER_DATA = joCareer; }
  };

  // ── Public ──
  window.cnSetYear = function (year) {
    CN.year = year;
    var y = yearObj();
    var active = y && (y.seasons.filter(function (s) { return s.active; })[0] || y.seasons[y.seasons.length - 1]);
    CN.seasonKey = active ? active.key : null;
    render();
  };
  window.cnSetSeason = function (key) { CN.seasonKey = key; CN.view = 'season'; render(); };
  window.cnSetView = function (view) { CN.view = view; render(); };
  window.cnInit = function () { load(function () { render(); cnSetSubPage(CN.sub); }); };
  // Data only (no render) — used by the live page to look up Community Night standings
  window.cnLoadData = function (cb) { load(cb || function () {}); };
})();
