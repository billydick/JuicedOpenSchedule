
(function(){
  function lbKeepScroll(fn){
    var y=window.scrollY||window.pageYOffset;
    fn();
    window.scrollTo(0,y);
  }
  var RC={Junk:'#888',Common:'#ccc',Uncommon:'#1EFF00',Rare:'#0070DD',Epic:'#A335EE',Legendary:'#FF8000'};
  var RARITY_ORDER=['Legendary','Epic','Rare','Uncommon','Common','Junk'];
  var LB_DB={
    meta:{generated_at:'',total_catches:0,unique_catches:0,total_players:0,dex_total:0,dex_completion:0,custom_catch_count:0},
    competition_meta:{
      alltime:{label:'All Time',sub:'Historical leaderboard'},
      monthly:{label:'This Month',sub:'Monthly competition'},
      weekly:{label:'This Week',sub:'Weekly competition'},
      daily:{label:'Today',sub:'Daily competition'}
    },
    leaderboards:{alltime:[],monthly:[],weekly:[],daily:[]},
    daily_history:[],
    weekly_history:[],
    monthly_history:[],
    best_catch:{alltime:[],monthly:[],weekly:[],daily:[]},
    achievements:{stream:{},players:{},recent_unlocks:[]},
    records:[],
    angler_records:{},
    new_anglers:[],
    dex:[],
    recent:[]
  };
  var lbCurTime='daily';
  var lbDexFilter='All';
  var lbRefreshTimer=null;

  function lbNormalizePayload(payload){
    payload = payload || {};
    if (payload.recent_catches && !payload.recent) {
      payload.recent = payload.recent_catches.map(function(r){
        return {
          u:r.u || r.username || 'Unknown',
          i:r.i || r.name || 'Unknown',
          w:Number(r.w != null ? r.w : r.weight || 0),
          v:Number(r.v != null ? r.v : r.value || 0),
          r:r.r || r.rarity || 'Common',
          d:r.d || r.timestamp || ''
        };
      });
    }
    if (payload.dex && payload.dex.length && !payload.dex[0].n) {
      payload.dex = payload.dex.map(function(d){
        return {
          n:d.n || d.name || 'Unknown',
          r:d.r || d.rarity || 'Common',
          custom:!!d.custom,
          desc:d.desc || d.description || '',
          c:Number(d.c != null ? d.c : (d.caught ? 1 : 0)),
          rec:d.rec || ''
        };
      });
    }
    payload.records = payload.records || [];
    payload.recent = payload.recent || [];
    payload.dex = payload.dex || [];
    payload.competition_meta = payload.competition_meta || LB_DB.competition_meta;
    payload.leaderboards = payload.leaderboards || LB_DB.leaderboards;
    ['alltime','monthly','weekly','daily'].forEach(function(k){
      payload.leaderboards[k] = (payload.leaderboards[k] || []).map(function(p){
        return {
          n:p.n || p.u || p.username || 'Unknown',
          u:p.u || p.n || p.username || 'Unknown',
          g:Number(p.g || 0),
          c:Number(p.c || 0),
          l:p.l || p.last_cast || p.lastCast || '',
          casts:Number(p.casts || p.castCount || 0)
        };
      });
    });
    return payload;
  }

  async function lbLoadData(){
    try{
      var res = await fetch('/lurkbait_data.json?ts=' + Date.now(), {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      LB_DB = lbNormalizePayload(await res.json());
      lbRenderStats();
      lbRenderLeaderboard();
      lbRenderRecords();
      lbRenderDex();
      lbRenderRecent();
      lbRenderNewAnglers();
    }catch(err){
      console.warn('LurkBait data load failed', err);
    }
  }

  function lbPageActive(){
    var p=document.getElementById('page-lurkbait');
    return !!(p && p.classList.contains('active'));
  }

function lbThumb(name,isCustom){
    if(isCustom) return 'custom_catches_web/'+name.replace(/ /g,'_')+'.webp';
    return 'https://blam.cam/thumbnails/'+name.replace(/ /g,'_')+'_THUMB.png';
  }
  var lbCurTime='daily';
  var lbDexFilter='All';
  var lbAlltimeVisible=50;
  var lbAlltimeStep=50;
  var lbAlltimeSearch='';
  var lbCurSub='gold';
  var lbDailyIdx=0;
  var lbWeeklyIdx=0;
  var lbMonthlyIdx=0;
  function lbGetData(){
    if(lbCurSub==='bestcatch') return (LB_DB.best_catch||{})[lbCurTime]||[];
    if(lbCurTime==='daily'){
      var dh=LB_DB.daily_history||[];
      if(lbDailyIdx===0) return LB_DB.leaderboards.daily||[];
      var dp=dh[lbDailyIdx-1]; return dp?dp.leaderboard||[]:[];
    }
    if(lbCurTime==='monthly'){
      var mh=LB_DB.monthly_history||[];
      if(lbMonthlyIdx===0) return LB_DB.leaderboards.monthly||[];
      var mp=mh[lbMonthlyIdx-1]; return mp?mp.leaderboard||[]:[];
    }
    if(lbCurTime==='weekly'){
      var wh=LB_DB.weekly_history||[];
      if(lbWeeklyIdx===0) return LB_DB.leaderboards.weekly||[];
      var wp=wh[lbWeeklyIdx-1]; return wp?wp.leaderboard||[]:[];
    }
    return LB_DB.leaderboards.alltime||[];
  }
  window.lbSetSub=function(sub,btn){
    lbCurSub=sub;
    document.querySelectorAll('.lb-subtab').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
    lbRenderLeaderboard();
  };
  window.lbSetTime=function(t,btn){
    lbCurTime=t;
    lbDailyIdx=0;
    lbWeeklyIdx=0;
    lbMonthlyIdx=0;
    document.querySelectorAll('.lb-timetab').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
    if(t!=='alltime'){ lbAlltimeSearch=''; var s=document.getElementById('lb-alltime-search'); if(s) s.value=''; }
    lbRenderLeaderboard();
  };
  window.lbPeriodPrev=function(){
    if(lbCurTime==='daily'){ lbDailyIdx=Math.min(lbDailyIdx+1,(LB_DB.daily_history||[]).length-1); }
    if(lbCurTime==='weekly'){ lbWeeklyIdx=Math.min(lbWeeklyIdx+1,(LB_DB.weekly_history||[]).length-1); }
    if(lbCurTime==='monthly'){ lbMonthlyIdx=Math.min(lbMonthlyIdx+1,(LB_DB.monthly_history||[]).length-1); }
    lbRenderLeaderboard();
  };
  window.lbPeriodNext=function(){
    if(lbCurTime==='daily'){ lbDailyIdx=Math.max(lbDailyIdx-1,0); }
    if(lbCurTime==='weekly'){ lbWeeklyIdx=Math.max(lbWeeklyIdx-1,0); }
    if(lbCurTime==='monthly'){ lbMonthlyIdx=Math.max(lbMonthlyIdx-1,0); }
    lbRenderLeaderboard();
  };
  window.lbAlltimeSearchChanged=function(v){ lbAlltimeSearch=(v||'').toLowerCase().trim(); lbRenderLeaderboard(); };
  window.lbLoadMore=function(){ lbAlltimeVisible += lbAlltimeStep; lbRenderLeaderboard(); };
  window.lbSetSec=function(s,btn){
    var _sy=window.scrollY||window.pageYOffset;
    document.querySelectorAll('.lb-sectab').forEach(function(b){b.classList.remove('active')});
    document.querySelectorAll('#page-lurkbait .lb-panel').forEach(function(p){p.classList.remove('active')});
    btn.classList.add('active');
    document.getElementById('lb-panel-'+s).classList.add('active');
    var timetabs = document.querySelector('.lb-timetabs');
    if(timetabs) timetabs.classList.toggle('visible', s==='leaderboard');
    if(s==='leaderboard') lbRenderLeaderboard();
    if(s==='dex') lbRenderDex();
    if(s==='recent') lbRenderRecent();
    if(s==='newanglers') lbRenderNewAnglers();
    if(s==='achievements') lbRenderAchievements();
    window.scrollTo(0,_sy);
  };
  function lbRenderBanner(periodLabel, periodSub, periodEyebrow){
    var _banner=document.getElementById('lb-comp-banner');
    if(!_banner) return;
    var m={label:periodLabel||'Competition', sub:periodSub||''};
    var data=lbGetData();
    var tg=data.reduce(function(a,p){return a+p.g},0);
    var tc=data.reduce(function(a,p){return a+p.c},0);
    _banner.innerHTML=
      '<div class="lb-comp-banner">'+
        '<div>'+
          '<div class="lb-comp-eyebrow">'+(periodEyebrow||'Competition Window')+'</div>'+
          '<div class="lb-comp-title">'+m.label+'</div>'+
          '<div class="lb-comp-sub">'+m.sub+'</div>'+
        '</div>'+
        '<div class="lb-comp-stats">'+
          '<div><div class="lb-comp-stat-val">'+tg.toLocaleString()+'</div><div class="lb-comp-stat-label">Gold Earned</div></div>'+
          '<div><div class="lb-comp-stat-val">'+tc.toLocaleString()+'</div><div class="lb-comp-stat-label">Casts</div></div>'+
          '<div><div class="lb-comp-stat-val">'+data.length+'</div><div class="lb-comp-stat-label">Anglers</div></div>'+
        '</div>'+
      '</div>';
  }
  function lbRenderStats(){
    var m = LB_DB.meta || {};
    var at = LB_DB.leaderboards.alltime || [];
    var top = at[0] || {};
    function set(id, val){ var el=document.getElementById(id); if(el) el.textContent=val; }
    set('lb-stat-catches', (m.total_catches||0).toLocaleString());
    set('lb-stat-anglers', (m.total_players||0).toLocaleString());
    set('lb-stat-dex', m.dex_total||0);
    set('lb-stat-gold', (top.g||0).toLocaleString());
    set('lb-stat-custom', m.custom_catch_count||0);
    var lbl=document.getElementById('lb-stat-gold-label');
    if(lbl) lbl.textContent='Top Gold' + (top.n ? ' \u00b7 ' + top.n : '');
  }
  function lbRenderLeaderboard(){
    lbKeepScroll(function(){
    // Period nav
    var nav=document.getElementById('lb-period-nav');
    var prevBtn=document.getElementById('lb-period-prev');
    var nextBtn=document.getElementById('lb-period-next');
    var periodLabel=document.getElementById('lb-period-label');
    var showNav=(lbCurTime==='daily'||lbCurTime==='weekly'||lbCurTime==='monthly');
    if(nav) nav.style.display=showNav?'flex':'none';
    var label='', periodSub='', periodEyebrow='Competition Window';
    if(showNav){
      var maxIdx=0;
      if(lbCurTime==='daily'){
        var dh=LB_DB.daily_history||[];
        maxIdx=dh.length;
        if(lbDailyIdx===0){
          label=(LB_DB.competition_meta&&LB_DB.competition_meta.daily&&LB_DB.competition_meta.daily.label)||'Today';
          periodSub=(LB_DB.competition_meta&&LB_DB.competition_meta.daily&&LB_DB.competition_meta.daily.sub)||"Today's Competition";
          periodEyebrow='Competition Window';
        } else { var dp=dh[lbDailyIdx-1]; label=dp?dp.label:''; periodSub='Completed'; periodEyebrow='Daily Results'; }
      } else if(lbCurTime==='weekly'){
        var wh=LB_DB.weekly_history||[];
        maxIdx=wh.length;
        if(lbWeeklyIdx===0){
          label=(LB_DB.competition_meta&&LB_DB.competition_meta.weekly&&LB_DB.competition_meta.weekly.label)||'This Week';
          periodSub=(LB_DB.competition_meta&&LB_DB.competition_meta.weekly&&LB_DB.competition_meta.weekly.sub)||'Weekly Competition';
          periodEyebrow='Competition Window';
        } else { var wp=wh[lbWeeklyIdx-1]; label=wp?wp.label:''; periodSub='Completed'; periodEyebrow='Weekly Results'; }
      } else {
        var mh=LB_DB.monthly_history||[];
        maxIdx=mh.length;
        if(lbMonthlyIdx===0){
          label=(LB_DB.competition_meta&&LB_DB.competition_meta.monthly&&LB_DB.competition_meta.monthly.label)||'This Month';
          periodSub=(LB_DB.competition_meta&&LB_DB.competition_meta.monthly&&LB_DB.competition_meta.monthly.sub)||'Monthly Competition';
          periodEyebrow='Competition Window';
        } else { var mp=mh[lbMonthlyIdx-1]; label=mp?mp.label:''; periodSub='Completed'; periodEyebrow='Monthly Results'; }
      }
      var curIdx=(lbCurTime==='daily'?lbDailyIdx:lbCurTime==='weekly'?lbWeeklyIdx:lbMonthlyIdx);
      if(periodLabel) periodLabel.textContent=label;
      if(prevBtn) prevBtn.disabled=(curIdx>=maxIdx);
      if(nextBtn) nextBtn.disabled=(curIdx<=0);
    } else {
      var _cm=(LB_DB.competition_meta&&LB_DB.competition_meta.alltime)||{};
      label=_cm.label||'All Time'; periodSub=_cm.sub||''; periodEyebrow='Competition Window';
    }
    // Update sec label for subtab
    var secLbl=document.querySelector('#lb-panel-leaderboard .lb-sec-label');
    if(secLbl) secLbl.textContent=lbCurSub==='bestcatch'?'Best Single Catch':'Gold Rankings';
    lbRenderBanner(label, periodSub, periodEyebrow);
    var data=lbGetData();
    var isAllTime = lbCurTime==='alltime';
    var tools=document.getElementById('lb-alltime-tools');
    var meta=document.getElementById('lb-alltime-meta');
    var loadWrap=document.getElementById('lb-loadmore-wrap');
    var filtered=data;
    if(isAllTime && lbAlltimeSearch){
      filtered=data.filter(function(p){ var n=(p.n||p.u||'').toLowerCase(); return n.indexOf(lbAlltimeSearch)!==-1; });
    }
    var visible = filtered;
    if(isAllTime && !lbAlltimeSearch){
      visible = filtered.slice(0, lbAlltimeVisible);
    }
    if(tools) tools.style.display=isAllTime?'flex':'none';
    if(meta){
      if(!isAllTime) meta.textContent='';
      else if(lbAlltimeSearch) meta.textContent='Showing '+visible.length.toLocaleString()+' matching anglers';
      else meta.textContent='Showing '+visible.length.toLocaleString()+' of '+filtered.length.toLocaleString()+' anglers';
    }
    if(loadWrap){
      loadWrap.style.display=(isAllTime && !lbAlltimeSearch && visible.length < filtered.length)?'flex':'none';
    }
    var maxG = filtered[0]?filtered[0].g:1;
    if(visible.length===0){
      var _ldrBody=document.getElementById('lb-ldr-body'); if(_ldrBody) _ldrBody.innerHTML='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(200,200,255,.2);padding:40px 20px;text-align:center">No catches for this period</div>';
      if(loadWrap) loadWrap.style.display='none';
      return;
    }
    var _ldrBody2=document.getElementById('lb-ldr-body'); if(_ldrBody2) _ldrBody2.innerHTML=visible.map(function(p,i){
      var rank=i+1;
      var col, sz, bg;
      if(rank===1){col='#FF8000';sz='36px';bg='linear-gradient(90deg,rgba(255,128,0,0.08) 0%,transparent 60%)';}
      else if(rank===2){col='#A335EE';sz='28px';bg='linear-gradient(90deg,rgba(163,53,238,0.06) 0%,transparent 60%)';}
      else if(rank===3){col='#A335EE';sz='28px';bg='linear-gradient(90deg,rgba(0,112,221,0.06) 0%,transparent 60%)';}
      else if(rank<=5){col='#A335EE';sz='28px';bg='';}
      else if(rank<=10){col='#0070DD';sz='26px';bg='';}
      else if(rank<=20){col='#1EFF00';sz='24px';bg='';}
      else{col='#FFF';sz='24px';bg='';}
      var you=(p.n||'').toLowerCase()==='juicedracing'?' lb-ldr-you':'';
      var barW = maxG ? Math.round((p.g/maxG)*100) : 0;
      return '<div class="lb-ldr-row'+you+'" style="background:'+bg+';cursor:pointer" data-lb-player="'+(p.n||p.u||'')+'">'+
        '<div class="lb-ldr-rank" style="color:'+col+';font-size:'+sz+'">'+rank+'</div>'+
        '<div class="lb-ldr-name-col">'+
          '<div class="lb-ldr-name" style="color:'+col+'">'+(p.n||p.u||'Unknown')+'</div>'+
          '<div class="lb-ldr-bar"><div class="lb-ldr-bar-fill" style="width:'+barW+'%;background:'+col+'"></div></div>'+
        '</div>'+
        '<div class="lb-ldr-gold" style="color:'+(lbCurSub==='bestcatch'?(RC[p.r]||col):col)+'">'+Number(p.g||p.v||0).toLocaleString()+(lbCurSub==='bestcatch'?'g':'')+'</div>'+
        '<div class="lb-ldr-casts" style="'+(lbCurSub==='bestcatch'?'color:'+(RC[p.r]||'#888')+';font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase':'')+'">'+( lbCurSub==='bestcatch'?(p.r||''):Number(p.c||0).toLocaleString()+' casts')+'</div>'+
        '<div class="lb-ldr-date">'+(p.l||'')+'</div>'+
      '</div>';
    }).join('');
    });
  }
  function lbRenderRecords(){
    var ar = LB_DB.angler_records || {};
    function card(label, angler, val, sub){
      if(!angler) return '';
      return '<div class="lb-ar-card">'+
        '<div class="lb-ar-accent"></div>'+
        '<div class="lb-ar-label">'+label+'</div>'+
        '<div class="lb-ar-angler">'+angler+'</div>'+
        '<div class="lb-ar-val">'+val+'</div>'+
        (sub?'<div class="lb-ar-sub">'+sub+'</div>':'')+
      '</div>';
    }
    function fmt(n){ return Number(n).toLocaleString(); }
    var html = '';
    html += card('Most Catches — All Time', ar.alltime_catches&&ar.alltime_catches.u, fmt(ar.alltime_catches&&ar.alltime_catches.n)+' catches', '');
    html += card('Most Gold — All Time', ar.alltime_gold&&ar.alltime_gold.u, fmt(ar.alltime_gold&&ar.alltime_gold.n)+' g', '');
    html += card('Most Legendaries — All Time', ar.alltime_legendaries&&ar.alltime_legendaries.u, fmt(ar.alltime_legendaries&&ar.alltime_legendaries.n)+' legendaries', '');
    html += card('Widest Dex — All Time', ar.alltime_unique&&ar.alltime_unique.u, fmt(ar.alltime_unique&&ar.alltime_unique.n)+' unique items', '');
    html += card('Most Catches — Single Day', ar.best_day_catches&&ar.best_day_catches.u, fmt(ar.best_day_catches&&ar.best_day_catches.n)+' catches', ar.best_day_catches&&ar.best_day_catches.period);
    html += card('Most Catches — Single Week', ar.best_week_catches&&ar.best_week_catches.u, fmt(ar.best_week_catches&&ar.best_week_catches.n)+' catches', 'Week of '+(ar.best_week_catches&&ar.best_week_catches.period));
    html += card('Most Catches — Single Month', ar.best_month_catches&&ar.best_month_catches.u, fmt(ar.best_month_catches&&ar.best_month_catches.n)+' catches', ar.best_month_catches&&ar.best_month_catches.period);
    html += card('Most Gold — Single Day', ar.best_day_gold&&ar.best_day_gold.u, fmt(ar.best_day_gold&&ar.best_day_gold.n)+' g', ar.best_day_gold&&ar.best_day_gold.period);
    html += card('Most Gold — Single Week', ar.best_week_gold&&ar.best_week_gold.u, fmt(ar.best_week_gold&&ar.best_week_gold.n)+' g', 'Week of '+(ar.best_week_gold&&ar.best_week_gold.period));
    html += card('Most Gold — Single Month', ar.best_month_gold&&ar.best_month_gold.u, fmt(ar.best_month_gold&&ar.best_month_gold.n)+' g', ar.best_month_gold&&ar.best_month_gold.period);
    var _arGrid=document.getElementById('lb-ar-grid'); if(_arGrid) _arGrid.innerHTML = html || '<div style="color:rgba(200,200,255,.2);font-family:\'Barlow Condensed\',sans-serif;padding:40px;letter-spacing:2px;text-transform:uppercase;font-size:12px">No data yet</div>';
  }
  window.lbFilterDex=function(r,btn){
    lbDexFilter=r;
    document.querySelectorAll('.lb-dex-filter').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
    lbRenderDex();
  };
  function lbRenderDex(){
    lbKeepScroll(function(){
    var all=(LB_DB.dex||[]).filter(function(d){return d.r!=='Junk'});
    // Update counts on all filter buttons
    var rarities=['All','Common','Uncommon','Rare','Epic','Legendary'];
    rarities.forEach(function(r){
      var el=document.getElementById('dex-count-'+r);
      if(!el) return;
      var n = r==='All' ? all.length : all.filter(function(d){return d.r===r}).length;
      el.textContent = n;
    });
    var items=all.slice();
    if(lbDexFilter!=='All') items=items.filter(function(d){return d.r===lbDexFilter});
    items.sort(function(a,b){
      var ra=RARITY_ORDER.indexOf(a.r),rb=RARITY_ORDER.indexOf(b.r);
      return ra!==rb?ra-rb:a.n.localeCompare(b.n);
    });
    var _dexGrid=document.getElementById('lb-dex-grid'); if(_dexGrid) _dexGrid.innerHTML=items.map(function(d){
      var col=RC[d.r]||'#888';
      var img=lbThumb(d.n,d.custom);
      return '<div class="lb-dex-card">'+
        '<div class="lb-dex-img">'+
          '<div class="lb-dex-img-bg"></div>'+
          '<img src="'+img+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">'+
          '<div class="lb-dex-rpip" style="background:'+col+'22;color:'+col+';border:1px solid '+col+'44">'+d.r+'</div>'+
          (d.custom?'<div class="lb-dex-cpip">custom</div>':'')+
        '</div>'+
        '<div class="lb-dex-body">'+
          '<div class="lb-dex-name">'+d.n+'</div>'+
          (d.desc?'<div class="lb-dex-desc">"'+d.desc+'"</div>':'<div class="lb-dex-desc"></div>')+
          '<div class="lb-dex-footer">'+
            '<div class="lb-dex-catches">Caught <span>'+d.c+'x</span></div>'+
            '<div style="display:flex;gap:8px;align-items:center">'+
            (d.v?'<div class="lb-dex-gold">&#11042; '+d.v+'</div>':'')+
            '<div class="lb-dex-record">'+d.rec+'</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }).join('');
    });
  }
  function lbRenderRecent(){
    var _recentFeed=document.getElementById('lb-recent-feed'); if(_recentFeed) _recentFeed.innerHTML=(LB_DB.recent||[]).map(function(r){
      var col=RC[r.r]||'#888';
      return '<div class="lb-recent-row">'+
        '<div class="lb-recent-dot" style="background:'+col+';box-shadow:0 0 6px '+col+'66"></div>'+
        '<div class="lb-recent-user">'+r.u+'</div>'+
        '<div class="lb-recent-item">'+r.i+'</div>'+
        '<div class="lb-recent-wt">'+r.w.toFixed(2)+' lb</div>'+
        '<div class="lb-recent-val">'+r.v+' g</div>'+
        '<div class="lb-recent-rarity" style="color:'+col+'">'+r.r+'</div>'+
      '</div>';
    }).join('');
  }
  function lbRenderNewAnglers(){
    var anglers = LB_DB.new_anglers || [];
    var _newFeed=document.getElementById('lb-newanglers-feed'); if(_newFeed) _newFeed.innerHTML = anglers.length === 0
      ? '<div style="color:rgba(200,200,255,.2);font-family:\'Barlow Condensed\',sans-serif;padding:40px;letter-spacing:2px;text-transform:uppercase;font-size:12px">No new anglers this week</div>'
      : anglers.map(function(a){
          var col = RC[a.best_r] || '#888';
          return '<div class="lb-recent-row">'+
            '<div class="lb-recent-dot" style="background:#00c8ff;box-shadow:0 0 6px rgba(0,200,255,.5)"></div>'+
            '<div class="lb-recent-user">'+a.u+'</div>'+
            '<div class="lb-recent-item">'+a.best_n+'</div>'+
            '<div class="lb-recent-wt">'+a.c+' casts</div>'+
            '<div class="lb-recent-val">'+a.g+' g</div>'+
            '<div class="lb-recent-rarity" style="color:'+col+'">'+a.best_r+'</div>'+
          '</div>';
        }).join('');
  }
  lbLoadData();

  // ── Player Modal — event delegation, blackjack pattern ───────────────────
  (function(){
    var page = document.getElementById('page-lurkbait');
    if(page) page.addEventListener('click', function(e){
      var el = e.target.closest('[data-lb-player]');
      if(el) lbModalOpen(el.getAttribute('data-lb-player'));
    });
  })();

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') lbModalClose();
  });

  function lbAtRankColor(rank){
    if(rank===1)   return '#FF8000';
    if(rank<=5)    return '#A335EE';
    if(rank<=10)   return '#0070DD';
    if(rank<=20)   return '#1EFF00';
    return '#ffffff';
  }

  window.lbModalOpen = function(username){
    if(!username || typeof username !== 'string') return;
    var u = username.toLowerCase();

    var overlay = document.getElementById('lb-player-modal-overlay');
    var modal   = document.getElementById('lb-player-modal');
    if(!overlay || !modal) return;

    // All-time rank + entry
    var at = LB_DB.leaderboards.alltime || [];
    var atIdx = -1, atEntry = null;
    for(var i=0;i<at.length;i++){
      if((at[i].n||at[i].u||'').toLowerCase()===u){ atIdx=i; atEntry=at[i]; break; }
    }
    var atRank = atIdx >= 0 ? atIdx+1 : null;
    var rankColor = atRank ? lbAtRankColor(atRank) : '#ffffff';

    // Header accent
    var header = document.getElementById('lb-player-modal-header');
    if(header) header.style.borderTopColor = rankColor;

    // Name + rank
    var nameEl  = document.getElementById('lb-player-modal-name');
    var rankEl  = document.getElementById('lb-player-modal-atrank');
    var isNew   = (LB_DB.new_anglers||[]).some(function(a){ return (a.u||'').toLowerCase()===u; });
    if(nameEl){
      nameEl.textContent = atEntry ? (atEntry.n||atEntry.u) : username;
      nameEl.style.color = rankColor;
      if(isNew) nameEl.innerHTML += ' <span class="lb-pm-new-badge">NEW</span>';
    }
    if(rankEl){
      rankEl.textContent = atRank ? '#'+atRank+' All Time' : 'Unranked';
      rankEl.style.color = rankColor+'88';
    }

    // Period rank pills
    function findInList(list){ for(var j=0;j<list.length;j++){ if((list[j].n||list[j].u||'').toLowerCase()===u) return j+1; } return null; }
    var dailyRank   = findInList(LB_DB.leaderboards.daily   || []);
    var weeklyRank  = findInList(LB_DB.leaderboards.weekly  || []);
    var monthlyRank = findInList(LB_DB.leaderboards.monthly || []);
    var pillsEl = document.getElementById('lb-player-modal-pills');
    if(pillsEl){
      var pills = '';
      function pill(rank, label){
        if(!rank) return '';
        var c = lbAtRankColor(rank);
        return '<div class="lb-pm-period-pill" style="border-color:'+c+'44;color:'+c+'">'+
          '<span class="lb-pm-period-label">'+label+'</span>'+
          '<span class="lb-pm-period-rank">#'+rank+'</span>'+
        '</div>';
      }
      pills += pill(dailyRank,'Today') + pill(weeklyRank,'This Week') + pill(monthlyRank,'This Month');
      pillsEl.innerHTML = pills;
      pillsEl.style.display = pills ? 'flex' : 'none';
    }

    // Stat tiles
    var gold   = atEntry ? atEntry.g : 0;
    var casts  = atEntry ? atEntry.c : 0;
    var last   = atEntry ? atEntry.l : '';
    var gpc    = casts > 0 ? (gold/casts).toFixed(1) : '—';

    // Achievement counts
    var pdata = (LB_DB.achievements && LB_DB.achievements.players) || {};
    var pKey  = Object.keys(pdata).find(function(k){ return k.toLowerCase()===u; }) || '';
    var playerAchs = pdata[pKey] || {};
    var earnedIds  = Object.keys(playerAchs);
    var achG=0, achS=0, achB=0;
    earnedIds.forEach(function(id){
      var def = LB_ACH_DEFS.find(function(a){return a.id===id;});
      if(!def) return;
      if(def.t==='gold') achG++; else if(def.t==='silver') achS++; else achB++;
    });

    var statsEl = document.getElementById('lb-player-modal-stats');
    if(statsEl) statsEl.innerHTML = [
      {val: gold.toLocaleString(),  label:'All-Time Gold',  col:'#D4A017'},
      {val: casts.toLocaleString(), label:'Total Casts',    col:'#00c8ff'},
      {val: gpc,                    label:'Gold / Cast',    col:'#ffffff'},
      {val: '<span style="color:#FF8000">'+achG+'</span><span style="color:rgba(255,255,255,.15);font-size:14px;margin:0 4px">/</span><span style="color:#A335EE">'+achS+'</span><span style="color:rgba(255,255,255,.15);font-size:14px;margin:0 4px">/</span><span style="color:#0070DD">'+achB+'</span>', label:'Achievements G/S/B', col:''},
      (last ? {val: last, label:'Last Seen', col:'rgba(200,200,255,.5)'} : null)
    ].filter(Boolean).map(function(s){
      return '<div class="lb-pm-stat">'+
        '<div class="lb-pm-stat-val"'+(s.col?' style="color:'+s.col+'"':'')+'>'+s.val+'</div>'+
        '<div class="lb-pm-stat-label">'+s.label+'</div>'+
      '</div>';
    }).join('');

    // Records held
    var ar = LB_DB.angler_records || {};
    var recordChecks = [
      {key:'alltime_catches',    label:'Most Catches — All Time'},
      {key:'alltime_gold',       label:'Most Gold — All Time'},
      {key:'alltime_legendaries',label:'Most Legendaries — All Time'},
      {key:'alltime_unique',     label:'Widest Dex — All Time'},
      {key:'best_day_catches',   label:'Most Catches — Single Day'},
      {key:'best_week_catches',  label:'Most Catches — Single Week'},
      {key:'best_month_catches', label:'Most Catches — Single Month'},
      {key:'best_day_gold',      label:'Most Gold — Single Day'},
      {key:'best_week_gold',     label:'Most Gold — Single Week'},
      {key:'best_month_gold',    label:'Most Gold — Single Month'}
    ];
    var recordsHeld = [];
    recordChecks.forEach(function(rc){
      var r = ar[rc.key];
      if(r && (r.u||'').toLowerCase()===u) recordsHeld.push({label:rc.label, val:r.n, period:r.period||''});
    });
    var bc = LB_DB.best_catch || {};
    ['alltime','monthly','weekly','daily'].forEach(function(period){
      var list = bc[period] || [];
      if(list.length && (list[0].n||'').toLowerCase()===u)
        recordsHeld.push({label:'Best Single Catch — '+period.charAt(0).toUpperCase()+period.slice(1), val:list[0].v+'g', period:list[0].i||''});
    });
    var recsEl = document.getElementById('lb-player-modal-records');
    if(recsEl){
      if(recordsHeld.length){
        recsEl.innerHTML =
          '<div class="lb-pm-section-label">Stream Records Held</div>'+
          '<div class="lb-pm-records">'+
          recordsHeld.map(function(rec){
            return '<div class="lb-pm-record-row">'+
              '<div class="lb-pm-record-icon">&#127942;</div>'+
              '<div style="flex:1">'+
                '<div class="lb-pm-record-label">'+rec.label+'</div>'+
                (rec.period?'<div class="lb-pm-record-period">'+rec.period+'</div>':'')+
              '</div>'+
              '<div class="lb-pm-record-val">'+Number(rec.val).toLocaleString()+'</div>'+
            '</div>';
          }).join('')+
          '</div>';
      } else {
        recsEl.innerHTML = '';
      }
    }

    // Achievement strip — gold first, then silver, then bronze
    var achsEl = document.getElementById('lb-player-modal-achs');
    if(achsEl){
      if(earnedIds.length){
        var tierOrder = ['gold','silver','bronze'];
        var ACH_TC = {gold:'#FF8000',silver:'#A335EE',bronze:'#0070DD'};
        var sortedAchs = earnedIds
          .map(function(id){ return LB_ACH_DEFS.find(function(a){return a.id===id;}); })
          .filter(Boolean)
          .sort(function(a,b){ return tierOrder.indexOf(a.t)-tierOrder.indexOf(b.t); });
        achsEl.innerHTML =
          '<div class="lb-pm-section-label">Achievements ('+earnedIds.length+')</div>'+
          '<div class="lb-pm-ach-strip">'+
          sortedAchs.map(function(a){
            var tc = ACH_TC[a.t]||'#888';
            var date = playerAchs[a.id]||'';
            var tipText = a.n + (date ? ' · ' + date : '');
            return '<div class="lb-pm-ach-pip" style="background:'+tc+'18;border-color:'+tc+'44;--pip-col:'+tc+'" data-tip-name="'+a.n+'" data-tip-date="'+(date||'')+'" data-tip-cond="'+a.c.replace(/"/g,'&quot;')+'">'+
              '<span>'+a.i+'</span>'+
              '<div class="lb-pm-ach-tip">'+
                '<div class="lb-pm-ach-tip-name" style="color:'+tc+'">'+a.n+'</div>'+
                (date?'<div class="lb-pm-ach-tip-date">'+date+'</div>':'')+
                '<div class="lb-pm-ach-tip-cond">'+a.c+'</div>'+
              '</div>'+
            '</div>';
          }).join('')+
          '</div>';
      } else {
        achsEl.innerHTML = '';
      }
    }

    // Recent catches filtered to this player
    var recentCatches = (LB_DB.recent||[]).filter(function(r){ return (r.u||'').toLowerCase()===u; });
    var catchesEl = document.getElementById('lb-player-modal-catches');
    if(catchesEl){
      if(!recentCatches.length){
        catchesEl.innerHTML = '<div class="lb-pm-empty">No recent catches in feed</div>';
      } else {
        catchesEl.innerHTML = recentCatches.map(function(r){
          var col = RC[r.r]||'#888';
          return '<div class="lb-pm-catch-row">'+
            '<div class="lb-pm-catch-dot" style="background:'+col+';box-shadow:0 0 5px '+col+'66"></div>'+
            '<div class="lb-pm-catch-item">'+r.i+'</div>'+
            '<div class="lb-pm-catch-rarity" style="color:'+col+'">'+r.r+'</div>'+
            '<div class="lb-pm-catch-wt">'+r.w.toFixed(2)+' lb</div>'+
            '<div class="lb-pm-catch-val">'+r.v+'g</div>'+
            '<div class="lb-pm-catch-date">'+r.d+'</div>'+
          '</div>';
        }).join('');
      }
    }

    overlay.style.display = 'block';
    modal.style.display   = 'block';
    document.body.style.overflow = 'hidden';
  };

  window.lbModalClose = function(){
    var overlay = document.getElementById('lb-player-modal-overlay');
    var modal   = document.getElementById('lb-player-modal');
    if(overlay) overlay.style.display = 'none';
    if(modal)   modal.style.display   = 'none';
    document.body.style.overflow = '';
  };
  // ── End Player Modal ──────────────────────────────────────────────────────

  var _initTimetabs = document.querySelector('.lb-timetabs');
  if(_initTimetabs) _initTimetabs.classList.add('visible');
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) return;
    if(lbPageActive()) lbLoadData();
  });
  window.lurkbaitPageChange = function(name){
    if(name==='lurkbait'){
      lbLoadData();
      if(lbRefreshTimer) clearInterval(lbRefreshTimer);
      lbRefreshTimer = setInterval(function(){
        if(lbPageActive() && !document.hidden) lbLoadData();
      }, 300000);
    } else if(lbRefreshTimer){
      clearInterval(lbRefreshTimer);
      lbRefreshTimer = null;
    }
  };
  if(lbPageActive()){
    window.lurkbaitPageChange('lurkbait');
  }
  // Handle case where page loaded directly on #lurkbait hash
  // setPage runs before this script so lurkbaitPageChange wasn't defined yet
  if(!lbPageActive() && window.location.hash === '#lurkbait'){
    setPage('lurkbait');
  }
  var LB_ACH_DEFS=[
    {id:'golden_cast',t:'gold',cat:'milestone',i:'💰',n:'Golden Cast',c:'Single catch worth 500g or more'},
    {id:'jackpot',t:'gold',cat:'milestone',i:'🎰',n:'Jackpot',c:'Single catch worth 1,000g or more'},
    {id:'legend_hunter',t:'gold',cat:'collection',i:'🏆',n:'Legend Hunter',c:'Catch your first Legendary'},
    {id:'legend_collector',t:'gold',cat:'collection',i:'👑',n:'Legend Collector',c:'Catch 10 Legendaries all time'},
    {id:'perfect_storm',t:'gold',cat:'milestone',i:'⚡',n:'Perfect Storm',c:'Perfect cast (rating 3) on a Legendary'},
    {id:'fifty_day',t:'gold',cat:'daily',i:'🔥',n:'50 in a Day',c:'50 catches in a single day'},
    {id:'two_legs_day',t:'gold',cat:'daily',i:'🎯',n:'2 Legendaries in a Day',c:'2 Legendaries in one day'},
    {id:'three_legs_day',t:'gold',cat:'daily',i:'🌟',n:'3 Legendaries in a Day',c:'3 Legendaries in one day'},
    {id:'shark_week',t:'gold',cat:'collection',i:'🦈',n:'Shark Week',c:'Catch all 5 shark species'},
    {id:'licensed',t:'gold',cat:'collection',i:'📋',n:'Licensed to Fish',c:'Catch all 5 iRacing licenses'},
    {id:'win_week',t:'gold',cat:'leaderboard',i:'🥇',n:'Win the Week',c:'Finish #1 on any weekly leaderboard'},
    {id:'win_month',t:'gold',cat:'leaderboard',i:'📅',n:'Win the Month',c:'Finish #1 on any monthly leaderboard'},
    {id:'the_market',t:'gold',cat:'weight',i:'🏪',n:'The Market',c:'50,000 lbs hauled — Go home. You\'ve done enough.'},
    {id:'grinder',t:'silver',cat:'milestone',i:'⚙',n:'Grinder',c:'500 total casts'},
    {id:'k_casts',t:'silver',cat:'milestone',i:'🎣',n:'1,000 Casts',c:'1,000 total casts'},
    {id:'century',t:'silver',cat:'milestone',i:'💯',n:'Century',c:'100 total casts'},
    {id:'dex_hunter',t:'silver',cat:'collection',i:'📖',n:'Dex Hunter',c:'50 unique items caught'},
    {id:'completionist',t:'silver',cat:'collection',i:'✅',n:'Completionist',c:'100 unique items caught'},
    {id:'full_spectrum',t:'silver',cat:'collection',i:'🌈',n:'Full Spectrum',c:'Catch all 5 non-Junk rarities all time'},
    {id:'custom_club',t:'silver',cat:'collection',i:'🎨',n:'Custom Club',c:'10 unique custom stream items'},
    {id:'gold_hoarder',t:'silver',cat:'milestone',i:'🏦',n:'Gold Hoarder',c:'10,000g total gold accumulated'},
    {id:'streak_7',t:'silver',cat:'streak',i:'📆',n:'Streak Angler',c:'Fish on 7 consecutive stream days'},
    {id:'streak_14',t:'silver',cat:'streak',i:'🗓',n:'Two Week Streak',c:'Fish on 14 consecutive stream days'},
    {id:'same_again',t:'silver',cat:'collection',i:'🔁',n:'Same Again',c:'Catch the same item 5x all time'},
    {id:'dedicated',t:'silver',cat:'daily',i:'💎',n:'Dedicated',c:'2,500g earned in a single day'},
    {id:'twenty_day',t:'silver',cat:'daily',i:'📊',n:'20 in a Day',c:'20 catches in a single day'},
    {id:'triple_crown',t:'silver',cat:'daily',i:'👑',n:'Triple Crown',c:'Legendary, Epic, and Rare in the same day'},
    {id:'legend_complete',t:'silver',cat:'collection',i:'📜',n:'Legend Complete',c:'Catch all 46 unique Legendaries'},
    {id:'epic_collector',t:'silver',cat:'collection',i:'🔮',n:'Epic Collector',c:'25 Epics all time'},
    {id:'leg_epic_day',t:'silver',cat:'daily',i:'✨',n:'Legendary + Epic Day',c:'Legendary and Epic in the same day'},
    {id:'all5_day',t:'silver',cat:'daily',i:'🎲',n:'All 5 Rarities in a Day',c:'All 5 non-Junk rarities in one session'},
    {id:'hat_trick',t:'silver',cat:'daily',i:'🎩',n:'Hat Trick',c:'Same item 3x in a single day'},
    {id:'two_k_day',t:'silver',cat:'daily',i:'💸',n:'2,000g in a Day',c:'2,000g earned in a single day'},
    {id:'supplier',t:'silver',cat:'weight',i:'🚛',n:'Supplier',c:'25,000 lbs hauled — We don\'t open until you show up.'},
    {id:'wholesale',t:'silver',cat:'weight',i:'📦',n:'Wholesale Account',c:'10,000 lbs hauled — You got your own parking spot now.'},
    {id:'broke_in',t:'bronze',cat:'milestone',i:'🐟',n:'Broke In',c:'First ever catch'},
    {id:'first_cast',t:'bronze',cat:'daily',i:'🌅',n:'First Cast',c:'First catch of the day after 3AM reset'},
    {id:'catch_of_day',t:'bronze',cat:'leaderboard',i:'⭐',n:'Catch of the Day',c:'Highest value single catch on any given day'},
    {id:'win_day',t:'bronze',cat:'leaderboard',i:'🏅',n:'Win the Day',c:'Finish #1 on any daily leaderboard'},
    {id:'double_down',t:'bronze',cat:'daily',i:'🔂',n:'Double Down',c:'Catch the same item twice in one day'},
    {id:'junk_master',t:'bronze',cat:'collection',i:'🗑',n:'Junk Master',c:'10 Junk catches all time'},
    {id:'custom_catch',t:'bronze',cat:'collection',i:'🎭',n:'Custom Catch',c:'Catch your first custom stream item'},
    {id:'heavy_hauler',t:'bronze',cat:'milestone',i:'🏋',n:'Heavy Hauler',c:'Single catch over 1,000 lbs'},
    {id:'monster_haul',t:'bronze',cat:'milestone',i:'🐋',n:'Monster Haul',c:'Single catch over 10,000 lbs'},
    {id:'perfect_cast',t:'bronze',cat:'milestone',i:'🎯',n:'Perfect Cast',c:'Land a perfect rating=3 cast'},
    {id:'gold_rush',t:'bronze',cat:'daily',i:'⛏',n:'Gold Rush',c:'1,000g earned in a single day'},
    {id:'the_regulars',t:'bronze',cat:'collection',i:'👥',n:'The Regulars',c:'Catch 5 unique iRacer community member items'},
    {id:'walk_in',t:'bronze',cat:'weight',i:'🚶',n:'Walk-In',c:'500 lbs hauled — Take a number, we\'ll get to you.'},
    {id:'regular_weight',t:'bronze',cat:'weight',i:'☕',n:'Regular',c:'2,500 lbs hauled — Hey, look who\'s back.'},
    {id:'nascar_pass',t:'bronze',cat:'collection',i:'🏁',n:'NASCAR Season Pass',c:'Catch 5 unique track items'},
  ];
  var LB_ACH_TC={gold:'#FF8000',silver:'#A335EE',bronze:'#0070DD'};
  var lbAchCurCat='all', lbAchCurTier='all', lbAchCurUser='';

  // Init category counts
  (function(){
    var cats=['daily','streak','collection','milestone','leaderboard','weight'];
    cats.forEach(function(c){
      var cnt=LB_ACH_DEFS.filter(function(a){return a.cat===c;}).length;
      var el=document.getElementById('lb-ach-cnt-'+c);
      if(el) el.textContent=cnt;
    });
  })();

  window.lbAchSetCat=function(cat){
    lbAchCurCat=cat;
    document.querySelectorAll('.lb-ach-catbtn').forEach(function(b){b.classList.remove('active');});
    var btn=document.getElementById('lb-ach-cat-'+cat);
    if(btn) btn.classList.add('active');
    var labels={all:'All Achievements',daily:'Daily Achievements',streak:'Streak Achievements',collection:'Collection Achievements',milestone:'Milestone Achievements',leaderboard:'Leaderboard Achievements',weight:'Fish Market Achievements'};
    var lbl=document.getElementById('lb-ach-wall-label'); if(lbl) lbl.textContent=labels[cat]||'Achievements';
    lbRenderAchWall();
  };
  window.lbAchSetTier=function(tier){
    lbAchCurTier=tier;
    ['all','gold','silver','bronze'].forEach(function(t){
      var btn=document.getElementById('lb-ach-tier-'+t);
      if(btn) btn.className='lb-ach-tierbtn t-'+t+(t===tier?' active':'');
    });
    lbRenderAchWall();
  };
  window.lbAchSearch=function(v){
    var q=(v||'').trim().toLowerCase();
    var result=document.getElementById('lb-ach-search-result');
    var playerList=document.getElementById('lb-ach-player-list');
    var pdata=(LB_DB.achievements&&LB_DB.achievements.players)||{};
    if(!q){
      lbAchCurUser='';
      if(result) result.textContent='';
      if(playerList){ playerList.style.display='none'; playerList.innerHTML=''; }
      lbRenderAchWall();
      return;
    }
    var matches=Object.keys(pdata).filter(function(u){ return u.toLowerCase().indexOf(q)!==-1; });
    if(result) result.textContent=matches.length+' ANGLER'+(matches.length!==1?'S':'');
    if(playerList){
      if(matches.length===0){
        playerList.style.display='none';
        playerList.innerHTML='';
      } else {
        playerList.style.display='flex';
        playerList.className='lb-ach-player-list';
        playerList.innerHTML=matches.slice(0,20).map(function(u){
          var earned=Object.keys(pdata[u]);
          var g=earned.filter(function(id){return LB_ACH_DEFS.find(function(a){return a.id===id&&a.t==='gold';});}).length;
          var sv=earned.filter(function(id){return LB_ACH_DEFS.find(function(a){return a.id===id&&a.t==='silver';});}).length;
          var b=earned.filter(function(id){return LB_ACH_DEFS.find(function(a){return a.id===id&&a.t==='bronze';});}).length;
          return '<div class="lb-ach-player-row" onclick="lbAchSelectPlayer(\''+u+'\')">'+            '<div class="lb-ach-player-name">'+u+'</div>'+            '<div class="lb-ach-player-counts"><span class="pg">'+g+'g</span> <span class="ps">'+sv+'s</span> <span class="pb">'+b+'b</span></div>'+          '</div>';
        }).join('');
      }
    }
    // If exactly one match auto-select
    if(matches.length===1){
      lbAchCurUser=matches[0];
    } else {
      lbAchCurUser='';
    }
    lbRenderAchWall();
  };
  window.lbAchSelectPlayer=function(u){
    lbAchCurUser=u;
    var input=document.getElementById('lb-ach-search');
    if(input) input.value=u;
    var result=document.getElementById('lb-ach-search-result');
    var pdata=(LB_DB.achievements&&LB_DB.achievements.players)||{};
    var earned=Object.keys(pdata[u]||{});
    var g=earned.filter(function(id){return LB_ACH_DEFS.find(function(a){return a.id===id&&a.t==='gold';});}).length;
    var sv=earned.filter(function(id){return LB_ACH_DEFS.find(function(a){return a.id===id&&a.t==='silver';});}).length;
    var b=earned.filter(function(id){return LB_ACH_DEFS.find(function(a){return a.id===id&&a.t==='bronze';});}).length;
    // Get actual gold from alltime leaderboard
    var atPlayer=(LB_DB.leaderboards.alltime||[]).find(function(p){return (p.n||p.u||'').toLowerCase()===u.toLowerCase();});
    var goldTotal=atPlayer?atPlayer.g:0;
    if(result) result.innerHTML='<span style="color:#fff;font-weight:800">'+u+'</span>'      +' — <span style="color:#D4A017">'+goldTotal.toLocaleString()+'g</span>'      +' &middot; <span style="color:#FF8000">'+g+' &#9733; Gold</span>'      +' <span style="color:#A335EE">'+sv+' Silver</span>'      +' <span style="color:#0070DD">'+b+' Bronze</span>'      +' <span style="color:rgba(200,200,200,.3)">('+earned.length+' achievements)</span>';
    var playerList=document.getElementById('lb-ach-player-list');
    if(playerList){ playerList.style.display='none'; playerList.innerHTML=''; }
    lbRenderAchWall();
  };

  function lbRenderAchWall(){
    var wall=document.getElementById('lb-ach-wall');
    if(!wall) return;
    var stream=(LB_DB.achievements&&LB_DB.achievements.stream)||{};
    var pdata=(LB_DB.achievements&&LB_DB.achievements.players)||{};
    var player=pdata[lbAchCurUser]||null;
    var isPersonal=!!player;
    var list=LB_ACH_DEFS.filter(function(a){
      if(lbAchCurCat!=='all'&&a.cat!==lbAchCurCat) return false;
      if(lbAchCurTier!=='all'&&a.t!==lbAchCurTier) return false;
      return true;
    });
    if(isPersonal){
      list=list.slice().sort(function(a,b){
        var ae=!!player[a.id],be=!!player[b.id];
        if(ae&&!be) return -1; if(!ae&&be) return 1;
        return 0;
      });
    }
    var tc=LB_ACH_TC;
    wall.innerHTML=list.map(function(a){
      var sd=stream[a.id]||{total:0,holders:[],latest:{u:'—',d:'—'}};
      var isEarned=isPersonal&&!!player[a.id];
      var isDim=isPersonal&&!isEarned;
      var cls='lb-ach-card'+(isDim?' dim':'')+(isEarned?' earned':'');
      var badge=isEarned?'<span class="lb-ach-badge lb-ach-badge-earned">✓ Earned</span>':'';
      var bottom='';
      if(isPersonal&&isEarned){
        bottom='<div class="lb-ach-bottom"><div class="lb-ach-earn-date">'+player[a.id]+'</div><div class="lb-ach-earn-lbl">Date earned</div></div>';
      } else if(!isPersonal){
        var shown=sd.holders.slice(0,3);
        var hHtml=shown.length?shown.map(function(h){return '<b>'+h+'</b>';}).join(' · ')+(sd.holders.length>3?' <span style="opacity:.25">+' + (sd.holders.length-3) +'</span>':''):'<span style="opacity:.2">Be first</span>';
        bottom='<div class="lb-ach-bottom"><div class="lb-ach-holders">'+hHtml+'</div></div>';
      }
      return '<div class="'+cls+'">' +
        '<div class="lb-ach-stripe '+a.t+'"></div>' +
        '<div class="lb-ach-icon">'+a.i+'</div>' +
        '<div class="lb-ach-body">' +
          '<div class="lb-ach-name">'+a.n+' '+badge+'</div>' +
          '<div class="lb-ach-cond">'+a.c+'</div>' +
          bottom +
        '</div>' +
        '<div class="lb-ach-meta">' +
          '<div><div class="lb-ach-count">'+sd.total+'</div><div class="lb-ach-count-lbl">earned</div></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function lbRenderAchSidebar(){
    var stream=(LB_DB.achievements&&LB_DB.achievements.stream)||{};
    // Most decorated: count by player
    var pdata=(LB_DB.achievements&&LB_DB.achievements.players)||{};
    var totals={}; var golds={};
    Object.keys(pdata).forEach(function(u){
      var achs=Object.keys(pdata[u]);
      totals[u]=achs.length;
      golds[u]=achs.filter(function(id){return LB_ACH_DEFS.find(function(a){return a.id===id&&a.t==='gold';});}).length;
    });
    var topTotal=Object.keys(totals).sort(function(a,b){return totals[b]-totals[a];})[0];
    var topGold=Object.keys(golds).sort(function(a,b){return golds[b]-golds[a];})[0];
    var tc=document.getElementById('lb-ach-top-total');
    var tg=document.getElementById('lb-ach-top-gold');
    if(tc&&topTotal) tc.innerHTML='<div class="lb-ach-top-lbl">Most achievements earned</div><div class="lb-ach-top-name">'+topTotal+'</div><div class="lb-ach-top-sub">'+totals[topTotal]+' achievements</div>';
    if(tg&&topGold) tg.innerHTML='<div class="lb-ach-top-lbl">Most gold achievements</div><div class="lb-ach-top-name">'+topGold+'</div><div class="lb-ach-top-sub" style="color:#FF8000">'+golds[topGold]+' Gold Achievements</div>';
    // Recent unlocks
    var unlocks=(LB_DB.achievements&&LB_DB.achievements.recent_unlocks)||[];
    var feed=document.getElementById('lb-ach-recent');
    if(!feed) return;
    feed.innerHTML=unlocks.slice(0,15).map(function(r){
      var def=LB_ACH_DEFS.find(function(a){return a.id===r.id;})||{t:'bronze',i:'🎣',n:r.id};
      return '<div class="lb-ach-unlock">' +
        '<div class="lb-ach-u-icon '+def.t+'">'+def.i+'</div>' +
        '<div>' +
          '<div class="lb-ach-u-user">'+r.u+'</div>' +
          '<div class="lb-ach-u-name">'+def.n+'</div>' +
          '<div><span class="lb-ach-u-pip '+def.t+'">'+def.t+'</span><span class="lb-ach-u-time">'+r.d+'</span></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function lbRenderAchievements(){
    lbRenderAchWall();
    lbRenderAchSidebar();
  }

})();

