
(function(){

  // ── Keep scroll position across tab switches (direct lurkbait port) ──
  function bjKeepScroll(fn){
    var y = window.scrollY || window.pageYOffset;
    fn();
    window.scrollTo(0, y);
  }

  // ── Data store (mirrors LB_DB shape) ─────────────────────────
  var BJ_DB = {
    meta:         {},
    leaderboards: {alltime:[], monthly:[], weekly:[], daily:[]},
    achievements: {stream:{}, players:{}, recent_unlocks:[]},
    catalog:      [],
    recent_hands: [],
  };

  var bjCurTime        = 'daily';
  var bjAlltimeSearch  = '';
  var bjAlltimeVisible = 50;
  var bjAlltimeStep    = 50;
  var bjAchCurCat      = 'all';
  var bjAchCurTier     = 'all';
  var bjAchCurUser     = '';
  var bjRefreshTimer   = null;

  var CAT_ICONS = {
    naturals:'🂡', streaks:'🔥', betting:'💰', balance:'🏦',
    volume:'📅', situational:'🎯', poker:'♠'
  };

  // ── Card image helpers ────────────────────────────────────────
  var RANK_NAMES = {
    'A':'ace','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7',
    '8':'8','9':'9','10':'10','J':'jack','Q':'queen','K':'king'
  };
  var SUIT_NAMES = {'♠':'spades','♥':'hearts','♦':'diamonds','♣':'clubs'};

  function bjCardFile(card){
    if(!card) return null;
    var suit = card.slice(-1);
    var rank = card.slice(0, -1);
    var suitName = SUIT_NAMES[suit];
    var rankName = RANK_NAMES[rank];
    if(!suitName || !rankName) return null;
    return 'SVG/' + rankName + '_of_' + suitName + '.svg';
  }

  function bjCardHtml(card, size){
    size = size || 48;
    var src = bjCardFile(card);
    if(!src) return '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px">'+card+'</span>';
    return '<img src="'+src+'" alt="'+card+'" style="height:'+size+'px;width:auto;box-shadow:1px 2px 6px rgba(0,0,0,.6)" onerror="this.outerHTML=\'<span>'+card+'</span>\'">';
  }

  function bjHandHtml(cards, size){
    if(!cards || !cards.length) return '—';
    return cards.map(function(c){ return bjCardHtml(c, size); }).join(' ');
  }

  // ── Utilities ─────────────────────────────────────────────────
  function fmt(n){ return n != null ? Number(n).toLocaleString() : '—'; }
  function fmtNet(n){
    if(!n) return '<span style="color:rgba(200,200,200,.2)">—</span>';
    if(n > 0) return '<span style="color:#40dd80">+'+fmt(n)+'</span>';
    return '<span style="color:#e05555">'+fmt(n)+'</span>';
  }
  function tierPip(chips){
    if(chips >= 100000) return {cls:'pip-whale', label:'WHALE'};
    if(chips >= 25000)  return {cls:'pip-shark',  label:'SHARK'};
    return                     {cls:'pip-fish',   label:'FISH'};
  }

  // ── Data load ─────────────────────────────────────────────────
  async function bjLoadData(){
    try{
      var res = await fetch('/blackjack_data.json?ts=' + Date.now(), {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      BJ_DB.meta         = data.meta         || {};
      BJ_DB.leaderboards = data.leaderboards  || {alltime:[],monthly:[],weekly:[],daily:[]};
      BJ_DB.achievements = data.achievements  || {stream:{},players:{},recent_unlocks:[]};
      BJ_DB.catalog      = data.catalog       || [];
      BJ_DB.recent_hands = data.recent_hands  || [];
      bjRenderStats();
      bjRenderLeaderboard();
      bjRenderAchievements();
      bjRenderRecent();
      var tt = document.querySelector('.bj-timetabs');
      if(tt) tt.classList.add('visible');
    } catch(err){
      console.warn('[blackjack] data load failed', err);
    }
  }

  function bjPageActive(){
    var p = document.getElementById('page-blackjack');
    return !!(p && p.classList.contains('active'));
  }

  // ── Stats bar ─────────────────────────────────────────────────
  function bjRenderStats(){
    var m   = BJ_DB.meta || {};
    var at  = BJ_DB.leaderboards.alltime || [];
    var top = at[0] || {};
    function set(id, val){ var el=document.getElementById(id); if(el) el.textContent=val; }
    set('bj-stat-hands',   (m.total_hands||0).toLocaleString());
    set('bj-stat-players', (m.total_players||0).toLocaleString());
    set('bj-stat-chips',   top.chips ? top.chips.toLocaleString() : '—');
    var lbl = document.getElementById('bj-stat-chips-label');
    if(lbl) lbl.textContent = 'Top Chips' + (top.u ? ' · ' + top.u : '');
    set('bj-stat-ach', BJ_DB.catalog.length || '—');
  }

  // ── Time tabs (direct lurkbait port) ─────────────────────────
  window.bjSetTime = function(t, btn){
    bjCurTime = t;
    bjAlltimeSearch = '';
    var s = document.getElementById('bj-alltime-search');
    if(s) s.value = '';
    document.querySelectorAll('.bj-timetab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    bjRenderLeaderboard();
  };

  window.bjAlltimeSearchChanged = function(v){
    bjAlltimeSearch = (v||'').toLowerCase().trim();
    bjRenderLeaderboard();
  };

  window.bjLoadMore = function(){
    bjAlltimeVisible += bjAlltimeStep;
    bjRenderLeaderboard();
  };

  // ── Section tabs (direct lurkbait port) ──────────────────────
  window.bjSetSec = function(s, btn){
    var _sy = window.scrollY || window.pageYOffset;
    document.querySelectorAll('.bj-sectab').forEach(function(b){ b.classList.remove('active'); });
    document.querySelectorAll('#page-blackjack .bj-panel').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = document.getElementById('bj-panel-'+s);
    if(panel) panel.classList.add('active');
    var tt = document.querySelector('.bj-timetabs');
    if(tt) tt.classList.toggle('visible', s==='leaderboard');
    if(s==='leaderboard')  bjRenderLeaderboard();
    if(s==='achievements') bjRenderAchievements();
    if(s==='recent')       bjRenderRecent();
    window.scrollTo(0, _sy);
  };

  // ── Leaderboard (direct lurkbait port) ───────────────────────
  function bjGetData(){
    return BJ_DB.leaderboards[bjCurTime] || [];
  }

  function bjRenderLeaderboard(){
    bjKeepScroll(function(){
      var isAllTime = bjCurTime === 'alltime';
      var tools    = document.getElementById('bj-alltime-tools');
      var meta     = document.getElementById('bj-alltime-meta');
      var loadWrap = document.getElementById('bj-loadmore-wrap');
      var hcell    = document.getElementById('bj-ldr-hcell-val');

      if(tools) tools.style.display = isAllTime ? 'flex' : 'none';
      if(hcell) hcell.textContent   = isAllTime ? 'Chips' : 'Net Chips';

      var data     = bjGetData();
      var filtered = data;
      if(isAllTime && bjAlltimeSearch){
        filtered = data.filter(function(p){ return (p.u||'').toLowerCase().indexOf(bjAlltimeSearch) !== -1; });
      }
      var visible = isAllTime && !bjAlltimeSearch ? filtered.slice(0, bjAlltimeVisible) : filtered;

      if(meta){
        if(!isAllTime) meta.textContent = '';
        else if(bjAlltimeSearch) meta.textContent = 'Showing '+visible.length.toLocaleString()+' matching players';
        else meta.textContent = 'Showing '+visible.length.toLocaleString()+' of '+filtered.length.toLocaleString()+' players';
      }
      if(loadWrap){
        loadWrap.style.display = (isAllTime && !bjAlltimeSearch && visible.length < filtered.length) ? 'flex' : 'none';
      }

      var maxVal = visible[0] ? (isAllTime ? visible[0].chips : Math.max(1, Math.abs(visible[0].net))) : 1;

      if(!visible.length){
        var body = document.getElementById('bj-ldr-body');
        if(body) body.innerHTML = '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(200,200,200,.2);padding:40px 20px;text-align:center">No hands played this period</div>';
        return;
      }

      var html = visible.map(function(p, i){
        var rank = i + 1;
        var col, sz, bg;
        if(rank===1){col='#FF8000';sz='36px';bg='linear-gradient(90deg,rgba(255,128,0,.08) 0%,transparent 60%)';}
        else if(rank===2){col='#A335EE';sz='28px';bg='linear-gradient(90deg,rgba(163,53,238,.06) 0%,transparent 60%)';}
        else if(rank===3){col='#0070DD';sz='28px';bg='linear-gradient(90deg,rgba(0,112,221,.06) 0%,transparent 60%)';}
        else if(rank<=5){col='#A335EE';sz='26px';bg='';}
        else if(rank<=10){col='#0070DD';sz='24px';bg='';}
        else{col='var(--white)';sz='22px';bg='';}

        var val    = isAllTime ? p.chips : p.net;
        var valStr = isAllTime ? fmt(p.chips) : ((p.net||0)>=0?'+':'')+fmt(p.net);
        var valCol = isAllTime ? col : (p.net||0)>=0 ? '#40dd80' : '#e05555';
        var barW   = maxVal ? Math.round((Math.abs(val||0)/maxVal)*100) : 0;
        var tp     = tierPip(p.chips||0);
        var hands  = p.hands > 0 ? fmt(p.hands) : '<span style="color:rgba(200,200,200,.2)">—</span>';

        return '<div class="bj-ldr-row" style="background:'+bg+'">'+
          '<div class="bj-ldr-rank" style="color:'+col+';font-size:'+sz+'">'+rank+'</div>'+
          '<div class="bj-ldr-name-col">'+
            '<div class="bj-ldr-name" style="color:'+col+'">'+p.u+'</div>'+
            '<div class="bj-ldr-bar"><div class="bj-ldr-bar-fill" style="width:'+barW+'%;background:'+col+'"></div></div>'+
            '<div class="bj-tier-pip '+tp.cls+'">'+tp.label+'</div>'+
          '</div>'+
          '<div class="bj-ldr-chips" style="color:'+valCol+'">'+valStr+'</div>'+
          '<div class="bj-ldr-hands">'+hands+'</div>'+
          '</div>';
      }).join('');

      var body = document.getElementById('bj-ldr-body');
      if(body) body.innerHTML = html;
    });
  }

  // ── Achievements (direct lurkbait port) ──────────────────────
  function bjInitCatCounts(){
    var catalog = BJ_DB.catalog || [];
    var el = document.getElementById('bj-ach-cnt-all');
    if(el) el.textContent = catalog.length;
    ['naturals','streaks','betting','balance','volume','situational','poker'].forEach(function(c){
      var el2 = document.getElementById('bj-ach-cnt-'+c);
      if(el2) el2.textContent = catalog.filter(function(a){ return a.cat===c; }).length;
    });
    ['gold','silver','bronze'].forEach(function(t){
      var el3 = document.getElementById('bj-ach-tier-cnt-'+t);
      if(el3) el3.textContent = catalog.filter(function(a){ return a.tier===t; }).length;
    });
  }

  window.bjAchSetCat = function(cat, btn){
    bjAchCurCat = cat;
    document.querySelectorAll('.bj-ach-catbtn').forEach(function(b){ b.classList.remove('active'); });
    var b = btn || document.getElementById('bj-ach-cat-'+cat);
    if(b) b.classList.add('active');
    var labels = {all:'All Achievements',naturals:'Naturals',streaks:'Streaks',betting:'Betting',balance:'Balance',volume:'Volume',situational:'Situational',poker:'Poker'};
    var lbl = document.getElementById('bj-ach-wall-label');
    if(lbl) lbl.textContent = labels[cat] || 'Achievements';
    bjRenderAchWall();
  };

  window.bjAchSetTier = function(tier, btn){
    bjAchCurTier = tier;
    ['all','gold','silver','bronze'].forEach(function(t){
      var b = document.getElementById('bj-ach-tier-'+t);
      if(b) b.className = 'bj-ach-tierbtn t-'+t+(t===tier?' active':'');
    });
    bjRenderAchWall();
  };

  window.bjAchSearch = function(v){
    var q = (v||'').trim().toLowerCase();
    var result     = document.getElementById('bj-ach-search-result');
    var playerList = document.getElementById('bj-ach-player-list');
    var pdata = (BJ_DB.achievements&&BJ_DB.achievements.players)||{};
    if(!q){
      bjAchCurUser = '';
      if(result) result.textContent = '';
      if(playerList){ playerList.style.display='none'; playerList.innerHTML=''; }
      bjRenderAchWall();
      return;
    }
    var matches = Object.keys(pdata).filter(function(u){ return u.toLowerCase().indexOf(q)!==-1; });
    if(result) result.textContent = matches.length+' PLAYER'+(matches.length!==1?'S':'');
    if(playerList){
      if(!matches.length){ playerList.style.display='none'; playerList.innerHTML=''; }
      else {
        playerList.style.display='flex';
        playerList.style.flexDirection='column';
        playerList.className='bj-ach-player-list';
        playerList.innerHTML=matches.slice(0,20).map(function(u){
          var earned=Object.keys(pdata[u]||{});
          var g =earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='gold';}).length;
          var sv=earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='silver';}).length;
          var b =earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='bronze';}).length;
          return '<div class="bj-ach-player-row" onclick="bjAchSelectPlayer(\''+u+'\')">'+
            '<div class="bj-ach-player-name">'+u+'</div>'+
            '<div class="bj-ach-player-counts"><span class="pg">'+g+'g</span> <span class="ps">'+sv+'s</span> <span class="pb">'+b+'b</span></div>'+
            '</div>';
        }).join('');
      }
    }
    bjAchCurUser = matches.length===1 ? matches[0] : '';
    bjRenderAchWall();
  };

  window.bjAchSelectPlayer = function(u){
    bjAchCurUser = u;
    var input = document.getElementById('bj-ach-search');
    if(input) input.value = u;
    var result = document.getElementById('bj-ach-search-result');
    var pdata  = (BJ_DB.achievements&&BJ_DB.achievements.players)||{};
    var earned = Object.keys(pdata[u]||{});
    var g =earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='gold';}).length;
    var sv=earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='silver';}).length;
    var b =earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='bronze';}).length;
    if(result) result.innerHTML=
      '<span style="color:#fff;font-weight:800">'+u+'</span>'+
      ' &middot; <span style="color:#FF8000">'+g+' &#9733; Gold</span>'+
      ' <span style="color:#A335EE">'+sv+' Silver</span>'+
      ' <span style="color:#0070DD">'+b+' Bronze</span>'+
      ' <span style="color:rgba(200,200,200,.3)">('+earned.length+' total)</span>';
    var playerList=document.getElementById('bj-ach-player-list');
    if(playerList){playerList.style.display='none';playerList.innerHTML='';}
    bjRenderAchWall();
  };

  function bjRenderAchWall(){
    var wall   = document.getElementById('bj-ach-wall');
    if(!wall) return;
    var stream = (BJ_DB.achievements&&BJ_DB.achievements.stream)||{};
    var pdata  = (BJ_DB.achievements&&BJ_DB.achievements.players)||{};
    var player = bjAchCurUser ? (pdata[bjAchCurUser]||null) : null;
    var isPersonal = !!(bjAchCurUser && player);

    var list = (BJ_DB.catalog||[]).filter(function(a){
      if(bjAchCurCat!=='all'&&a.cat!==bjAchCurCat) return false;
      if(bjAchCurTier!=='all'&&a.tier!==bjAchCurTier) return false;
      return true;
    });

    if(isPersonal){
      list=list.slice().sort(function(a,b){
        var ae=!!player[a.id],be=!!player[b.id];
        if(ae&&!be) return -1; if(!ae&&be) return 1; return 0;
      });
    }

    wall.innerHTML=list.map(function(a){
      var sd=stream[a.id]||{total:0,holders:[],latest:{u:'—',d:'—'}};
      var isEarned=isPersonal&&!!player[a.id];
      var isDim=isPersonal&&!isEarned;
      var cls='bj-ach-card'+(isDim?' dim':'')+(isEarned?' earned':'');
      var badge=isEarned?'<span class="bj-ach-badge bj-ach-badge-earned">&#10003; Earned</span>':'';
      var icon=CAT_ICONS[a.cat]||'★';
      var bottom='';
      if(isPersonal&&isEarned){
        bottom='<div class="bj-ach-bottom"><div class="bj-ach-earn-date">'+(player[a.id]||'earned')+'</div><div class="bj-ach-earn-lbl">Date earned</div></div>';
      } else {
        var shown=(sd.holders||[]).slice(0,3);
        var hHtml=shown.length?shown.map(function(h){return '<b>'+h+'</b>';}).join(' · ')+(sd.holders.length>3?' <span style="opacity:.25">+'+(sd.holders.length-3)+'</span>':''):'<span style="opacity:.2">Be first</span>';
        bottom='<div class="bj-ach-bottom"><div class="bj-ach-holders">'+hHtml+'</div></div>';
      }
      return '<div class="'+cls+'">'+
        '<div class="bj-ach-stripe '+a.tier+'"></div>'+
        '<div class="bj-ach-icon">'+icon+'</div>'+
        '<div class="bj-ach-body">'+
          '<div class="bj-ach-name">'+a.title+' '+badge+'</div>'+
          '<div class="bj-ach-cond">'+a.rule+'</div>'+
          bottom+
        '</div>'+
        '<div class="bj-ach-meta"></div>'+
        '</div>';
    }).join('');
  }

  function bjRenderAchSidebar(){
    var pdata=(BJ_DB.achievements&&BJ_DB.achievements.players)||{};
    var totals={},golds={};
    Object.keys(pdata).forEach(function(u){
      var achs=Object.keys(pdata[u]);
      totals[u]=achs.length;
      golds[u]=achs.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='gold';}).length;
    });
    var topTotal=Object.keys(totals).sort(function(a,b){return totals[b]-totals[a];})[0];
    var topGold =Object.keys(golds).sort(function(a,b){return golds[b]-golds[a];})[0];
    var tc=document.getElementById('bj-ach-top-total');
    var tg=document.getElementById('bj-ach-top-gold');
    if(tc&&topTotal) tc.innerHTML='<div class="bj-ach-top-lbl">Most achievements earned</div><div class="bj-ach-top-name">'+topTotal+'</div><div class="bj-ach-top-sub">'+totals[topTotal]+' achievements</div>';
    if(tg&&topGold)  tg.innerHTML='<div class="bj-ach-top-lbl">Most gold achievements</div><div class="bj-ach-top-name">'+topGold+'</div><div class="bj-ach-top-sub" style="color:#FF8000">'+golds[topGold]+' Gold achievements</div>';
    var unlocks=(BJ_DB.achievements&&BJ_DB.achievements.recent_unlocks)||[];
    var feed=document.getElementById('bj-ach-recent');
    if(!feed) return;
    feed.innerHTML=unlocks.slice(0,15).map(function(r){
      var def=BJ_DB.catalog.find(function(a){return a.id===r.id;})||{tier:'bronze',cat:'betting',title:r.id};
      var icon=CAT_ICONS[def.cat]||'★';
      return '<div class="bj-ach-unlock">'+
        '<div class="bj-ach-u-icon '+def.tier+'">'+icon+'</div>'+
        '<div>'+
          '<div class="bj-ach-u-user">'+r.u+'</div>'+
          '<div class="bj-ach-u-name">'+def.title+'</div>'+
          '<div><span class="bj-ach-u-pip '+def.tier+'">'+def.tier+'</span><span class="bj-ach-u-time">'+r.d+'</span></div>'+
        '</div>'+
        '</div>';
    }).join('');
  }

  function bjRenderAchievements(){
    bjInitCatCounts();
    bjRenderAchWall();
    bjRenderAchSidebar();
  }

  // ── Recent Hands ──────────────────────────────────────────────
  function bjRenderRecent(){
    var hands=BJ_DB.recent_hands||[];
    var feed=document.getElementById('bj-recent-feed');
    if(!feed) return;
    if(!hands.length){
      feed.innerHTML='<div style="padding:32px;text-align:center;color:rgba(200,200,200,.2);font-family:\'Barlow Condensed\',sans-serif;font-size:14px;letter-spacing:2px;text-transform:uppercase">No hands recorded yet</div>';
      return;
    }
    var lbl=document.getElementById('bj-recent-label');
    if(lbl&&hands[0]) lbl.textContent='Recent Hands — '+(hands[0].date||'');
    feed.innerHTML=hands.slice(0,50).map(function(h){
      var result=h.result||'lose';
      var delta=h.net_delta||0;
      var dSign=delta>0?'+':'';
      var dCls=delta>0?'pos':delta<0?'neg':'zero';
      var playerCards=h.player_cards||[];
      var dealerCards=h.dealer_cards||[];
      var ptotal=h.player_total||0;
      var dtotal=h.dealer_total||0;
      var pokerHtml=h.poker_rank?'<div class="bj-recent-poker">'+h.poker_rank.replace(/_/g,' ')+(h.poker_pct?' +'+h.poker_pct+'%':'')+'</div>':'<div></div>';
      var ptCls=ptotal>21?'bust':ptotal===21?'max':'';
      var dtCls=dtotal>21?'bust':dtotal===21?'max':'';
      return '<div class="bj-recent-row">'+
        '<div class="bj-result-pip pip-'+result+'">'+result+'</div>'+
        '<div class="bj-recent-player">'+h.player+'</div>'+
        '<div class="bj-recent-cards-img">'+
          '<div style="display:flex;align-items:center;gap:3px">'+bjHandHtml(playerCards,48)+'</div>'+
          '<div class="bj-recent-total '+ptCls+'">'+ptotal+'</div>'+
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;letter-spacing:1px;color:rgba(200,200,200,.2);margin:0 6px">vs</div>'+
          '<div style="display:flex;align-items:center;gap:3px">'+bjHandHtml(dealerCards,48)+'</div>'+
          '<div class="bj-recent-total '+dtCls+'">'+dtotal+'</div>'+
        '</div>'+
        pokerHtml+
        '<div class="bj-recent-delta '+dCls+'">'+dSign+fmt(delta)+'</div>'+
        '</div>';
    }).join('');
  }

  // ── Page lifecycle (direct lurkbait port) ─────────────────────
  window.blackjackPageChange = function(name){
    if(name==='blackjack'){
      bjLoadData();
      if(bjRefreshTimer) clearInterval(bjRefreshTimer);
      bjRefreshTimer=setInterval(function(){
        if(bjPageActive()&&!document.hidden) bjLoadData();
      }, 60000);
    } else {
      if(bjRefreshTimer){clearInterval(bjRefreshTimer);bjRefreshTimer=null;}
    }
  };

  if(bjPageActive()) window.blackjackPageChange('blackjack');
  if(!bjPageActive()&&window.location.hash==='#blackjack') setPage('blackjack');
  document.addEventListener('visibilitychange',function(){
    if(document.hidden) return;
    if(bjPageActive()) bjLoadData();
  });

})();
