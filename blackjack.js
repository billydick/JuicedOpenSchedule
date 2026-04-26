
(function(){

  function bjKeepScroll(fn){
    var y=window.scrollY||window.pageYOffset;
    fn();
    window.scrollTo(0,y);
  }

  // ── Data store ────────────────────────────────────────────────
  var BJ_DB={
    meta:{},
    competition_meta:{
      alltime:{label:'All Time',sub:'Historical leaderboard'},
      monthly:{label:'This Month',sub:'Monthly Competition'},
      weekly:{label:'This Week',sub:'Weekly Competition'},
      daily:{label:'Today',sub:"Today's Competition"}
    },
    leaderboards:{alltime:[],monthly:[],weekly:[],daily:[]},
    daily_history:[],
    weekly_history:[],
    monthly_history:[],
    achievements:{stream:{},players:{},recent_unlocks:[]},
    catalog:[],
    recent_hands:[]
  };

  var bjCurTime       = 'daily';
  var bjDailyIdx      = 0;
  var bjWeeklyIdx     = 0;
  var bjMonthlyIdx    = 0;
  var bjAlltimeSearch = '';
  var bjAlltimeVisible= 50;
  var bjAlltimeStep   = 50;
  var bjAchCurCat     = 'all';
  var bjAchCurTier    = 'all';
  var bjAchCurUser    = '';
  var bjRefreshTimer  = null;

  var CAT_ICONS={
    naturals:'🂡', streaks:'🔥', betting:'💰', balance:'🏦',
    volume:'📅', situational:'🎯', poker:'♠'
  };

  // ── Card image helpers ────────────────────────────────────────
  var RANK_NAMES={
    'A':'ace','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7',
    '8':'8','9':'9','10':'10','J':'jack','Q':'queen','K':'king'
  };
  var SUIT_NAMES={'♠':'spades','♥':'hearts','♦':'diamonds','♣':'clubs'};

  function bjCardFile(card){
    if(!card) return null;
    var suit=card.slice(-1);
    var rank=card.slice(0,-1);
    var suitName=SUIT_NAMES[suit];
    var rankName=RANK_NAMES[rank];
    if(!suitName||!rankName) return null;
    return 'SVG/'+rankName+'_of_'+suitName+'.svg';
  }

  function bjCardHtml(card,size){
    size=size||48;
    var src=bjCardFile(card);
    if(!src) return '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px">'+card+'</span>';
    return '<img src="'+src+'" alt="'+card+'" style="height:'+size+'px;width:auto;box-shadow:1px 2px 6px rgba(0,0,0,.6)" onerror="this.outerHTML=\'<span>'+card+'</span>\'">';
  }

  function bjHandHtml(cards,size){
    if(!cards||!cards.length) return '—';
    return cards.map(function(c){ return bjCardHtml(c,size); }).join(' ');
  }

  // ── Utilities ─────────────────────────────────────────────────
  function fmt(n){ return n!=null?Number(n).toLocaleString():'—'; }
  function tierPip(chips){
    if(chips>=100000) return {cls:'pip-whale',label:'WHALE'};
    if(chips>=25000)  return {cls:'pip-shark', label:'SHARK'};
    return                   {cls:'pip-fish',  label:'FISH'};
  }

  // ── Data load ─────────────────────────────────────────────────
  async function bjLoadData(){
    try{
      var res=await fetch('/blackjack_data.json?ts='+Date.now(),{cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      var data=await res.json();
      BJ_DB.meta            =data.meta            ||{};
      BJ_DB.competition_meta=data.competition_meta||BJ_DB.competition_meta;
      BJ_DB.leaderboards    =data.leaderboards     ||{alltime:[],monthly:[],weekly:[],daily:[]};
      BJ_DB.daily_history   =data.daily_history    ||[];
      BJ_DB.weekly_history  =data.weekly_history   ||[];
      BJ_DB.monthly_history =data.monthly_history  ||[];
      BJ_DB.achievements    =data.achievements     ||{stream:{},players:{},recent_unlocks:[]};
      BJ_DB.catalog         =data.catalog          ||[];
      BJ_DB.recent_hands    =data.recent_hands     ||[];
      bjRenderStats();
      bjRenderLeaderboard();
      bjRenderAchievements();
      bjRenderRecent();
      var tt=document.querySelector('.bj-timetabs');
      if(tt) tt.classList.add('visible');
    }catch(err){
      console.warn('[blackjack] data load failed',err);
    }
  }

  function bjPageActive(){
    var p=document.getElementById('page-blackjack');
    return !!(p&&p.classList.contains('active'));
  }

  // ── Stats bar ─────────────────────────────────────────────────
  function bjRenderStats(){
    var m  =BJ_DB.meta||{};
    var at =BJ_DB.leaderboards.alltime||[];
    var top=at[0]||{};
    function set(id,val){ var el=document.getElementById(id); if(el) el.textContent=val; }
    set('bj-stat-hands',  (m.total_hands  ||0).toLocaleString());
    set('bj-stat-players',(m.total_players||0).toLocaleString());
    set('bj-stat-chips',  top.chips?top.chips.toLocaleString():'—');
    var lbl=document.getElementById('bj-stat-chips-label');
    if(lbl) lbl.textContent='Top Chips'+(top.u?' · '+top.u:'');
    set('bj-stat-ach',BJ_DB.catalog.length||'—');
  }

  // ── Period data selector — direct lurkbait port ───────────────
  function bjGetData(){
    if(bjCurTime==='daily'){
      var dh=BJ_DB.daily_history||[];
      if(bjDailyIdx===0) return BJ_DB.leaderboards.daily||[];
      var dp=dh[bjDailyIdx-1]; return dp?dp.leaderboard||[]:[];
    }
    if(bjCurTime==='weekly'){
      var wh=BJ_DB.weekly_history||[];
      if(bjWeeklyIdx===0) return BJ_DB.leaderboards.weekly||[];
      var wp=wh[bjWeeklyIdx-1]; return wp?wp.leaderboard||[]:[];
    }
    if(bjCurTime==='monthly'){
      var mh=BJ_DB.monthly_history||[];
      if(bjMonthlyIdx===0) return BJ_DB.leaderboards.monthly||[];
      var mp=mh[bjMonthlyIdx-1]; return mp?mp.leaderboard||[]:[];
    }
    return BJ_DB.leaderboards.alltime||[];
  }

  // ── Time tabs ─────────────────────────────────────────────────
  window.bjSetTime=function(t,btn){
    bjCurTime=t;
    bjDailyIdx=0; bjWeeklyIdx=0; bjMonthlyIdx=0;
    bjAlltimeSearch='';
    var s=document.getElementById('bj-alltime-search'); if(s) s.value='';
    document.querySelectorAll('.bj-timetab').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');
    bjRenderLeaderboard();
  };

  // ── Period nav — clamp to length (not length-1), matching lurkbait exactly
  window.bjPeriodPrev=function(){
    if(bjCurTime==='daily')   bjDailyIdx  =Math.min(bjDailyIdx+1,  (BJ_DB.daily_history  ||[]).length);
    if(bjCurTime==='weekly')  bjWeeklyIdx =Math.min(bjWeeklyIdx+1, (BJ_DB.weekly_history ||[]).length);
    if(bjCurTime==='monthly') bjMonthlyIdx=Math.min(bjMonthlyIdx+1,(BJ_DB.monthly_history||[]).length);
    bjRenderLeaderboard();
  };

  window.bjPeriodNext=function(){
    if(bjCurTime==='daily')   bjDailyIdx  =Math.max(bjDailyIdx-1,  0);
    if(bjCurTime==='weekly')  bjWeeklyIdx =Math.max(bjWeeklyIdx-1, 0);
    if(bjCurTime==='monthly') bjMonthlyIdx=Math.max(bjMonthlyIdx-1,0);
    bjRenderLeaderboard();
  };

  window.bjAlltimeSearchChanged=function(v){
    bjAlltimeSearch=(v||'').toLowerCase().trim();
    bjRenderLeaderboard();
  };

  window.bjLoadMore=function(){
    bjAlltimeVisible+=bjAlltimeStep;
    bjRenderLeaderboard();
  };

  // ── Section tabs ──────────────────────────────────────────────
  window.bjSetSec=function(s,btn){
    var _sy=window.scrollY||window.pageYOffset;
    document.querySelectorAll('.bj-sectab').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('#page-blackjack .bj-panel').forEach(function(p){p.classList.remove('active');});
    btn.classList.add('active');
    var panel=document.getElementById('bj-panel-'+s);
    if(panel) panel.classList.add('active');
    var tt=document.querySelector('.bj-timetabs');
    if(tt) tt.classList.toggle('visible',s==='leaderboard');
    if(s==='leaderboard')  bjRenderLeaderboard();
    if(s==='achievements') bjRenderAchievements();
    if(s==='recent')       bjRenderRecent();
    window.scrollTo(0,_sy);
  };

  // ── Leaderboard ───────────────────────────────────────────────
  function bjRenderLeaderboard(){
    bjKeepScroll(function(){
      var isAllTime=bjCurTime==='alltime';
      var tools   =document.getElementById('bj-alltime-tools');
      var meta    =document.getElementById('bj-alltime-meta');
      var loadWrap=document.getElementById('bj-loadmore-wrap');
      var hcell   =document.getElementById('bj-ldr-hcell-val');

      // Period nav
      var nav        =document.getElementById('bj-period-nav');
      var prevBtn    =document.getElementById('bj-period-prev');
      var nextBtn    =document.getElementById('bj-period-next');
      var periodLabel=document.getElementById('bj-period-label');
      var showNav=(bjCurTime==='daily'||bjCurTime==='weekly'||bjCurTime==='monthly');
      if(nav) nav.style.display=showNav?'flex':'none';
      if(showNav){
        var label='',maxIdx=0,curIdx=0;
        if(bjCurTime==='daily'){
          var dh=BJ_DB.daily_history||[]; maxIdx=dh.length; curIdx=bjDailyIdx;
          if(bjDailyIdx===0){ label=(BJ_DB.competition_meta&&BJ_DB.competition_meta.daily&&BJ_DB.competition_meta.daily.label)||'Today'; }
          else{ var dp=dh[bjDailyIdx-1]; label=dp?dp.label:''; }
        } else if(bjCurTime==='weekly'){
          var wh=BJ_DB.weekly_history||[]; maxIdx=wh.length; curIdx=bjWeeklyIdx;
          if(bjWeeklyIdx===0){ label=(BJ_DB.competition_meta&&BJ_DB.competition_meta.weekly&&BJ_DB.competition_meta.weekly.label)||'This Week'; }
          else{ var wp=wh[bjWeeklyIdx-1]; label=wp?wp.label:''; }
        } else {
          var mh=BJ_DB.monthly_history||[]; maxIdx=mh.length; curIdx=bjMonthlyIdx;
          if(bjMonthlyIdx===0){ label=(BJ_DB.competition_meta&&BJ_DB.competition_meta.monthly&&BJ_DB.competition_meta.monthly.label)||'This Month'; }
          else{ var mp=mh[bjMonthlyIdx-1]; label=mp?mp.label:''; }
        }
        if(periodLabel) periodLabel.textContent=label;
        if(prevBtn) prevBtn.disabled=(curIdx>=maxIdx);
        if(nextBtn) nextBtn.disabled=(curIdx<=0);
      }

      if(tools) tools.style.display=isAllTime?'flex':'none';
      if(hcell) hcell.textContent=isAllTime?'Chips':'Net Chips';

      var data    =bjGetData();
      var filtered=data;
      if(isAllTime&&bjAlltimeSearch){
        filtered=data.filter(function(p){ return (p.u||'').toLowerCase().indexOf(bjAlltimeSearch)!==-1; });
      }
      var visible=isAllTime&&!bjAlltimeSearch?filtered.slice(0,bjAlltimeVisible):filtered;

      if(meta){
        if(!isAllTime) meta.textContent='';
        else if(bjAlltimeSearch) meta.textContent='Showing '+visible.length.toLocaleString()+' matching players';
        else meta.textContent='Showing '+visible.length.toLocaleString()+' of '+filtered.length.toLocaleString()+' players';
      }
      if(loadWrap){
        loadWrap.style.display=(isAllTime&&!bjAlltimeSearch&&visible.length<filtered.length)?'flex':'none';
      }

      if(!visible.length){
        var body=document.getElementById('bj-ldr-body');
        if(body) body.innerHTML='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(200,200,200,.2);padding:40px 20px;text-align:center">No hands played this period</div>';
        return;
      }

      var maxVal=visible[0]?(isAllTime?visible[0].chips:Math.max(1,visible[0].net||0)):1;
      var minVal=isAllTime?0:(visible.length?visible[visible.length-1].net||0:0);
      var rangeVal=Math.max(1,maxVal-minVal);

      var html=visible.map(function(p,i){
        var rank=i+1;
        var col,sz,bg;
        if(rank===1){col='#FF8000';sz='36px';bg='linear-gradient(90deg,rgba(255,128,0,.08) 0%,transparent 60%)';}
        else if(rank===2){col='#A335EE';sz='28px';bg='linear-gradient(90deg,rgba(163,53,238,.06) 0%,transparent 60%)';}
        else if(rank===3){col='#0070DD';sz='28px';bg='linear-gradient(90deg,rgba(0,112,221,.06) 0%,transparent 60%)';}
        else if(rank<=5){col='#A335EE';sz='26px';bg='';}
        else if(rank<=10){col='#0070DD';sz='24px';bg='';}
        else if(rank<=20){col='#1EFF00';sz='22px';bg='';}
        else{col='var(--white)';sz='22px';bg='';}

        var val   =isAllTime?p.chips:p.net;
        var valStr=isAllTime?fmt(p.chips):((p.net||0)>=0?'+':'')+fmt(p.net);
        var valCol=isAllTime?col:(p.net||0)>=0?'#40dd80':'#e05555';
        var barW  =Math.round(((val||0)-minVal)/rangeVal*100);
        var tp    =tierPip(p.chips||0);
        var hands =p.hands>0?fmt(p.hands):'<span style="color:rgba(200,200,200,.2)">—</span>';

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

      var body=document.getElementById('bj-ldr-body');
      if(body) body.innerHTML=html;
    });
  }

  // ── Achievements ──────────────────────────────────────────────
  function bjInitCatCounts(){
    var catalog=BJ_DB.catalog||[];
    var el=document.getElementById('bj-ach-cnt-all');
    if(el) el.textContent=catalog.length;
    ['naturals','streaks','betting','balance','volume','situational','poker'].forEach(function(c){
      var el2=document.getElementById('bj-ach-cnt-'+c);
      if(el2) el2.textContent=catalog.filter(function(a){return a.cat===c;}).length;
    });
    ['gold','silver','bronze'].forEach(function(t){
      var el3=document.getElementById('bj-ach-tier-cnt-'+t);
      if(el3) el3.textContent=catalog.filter(function(a){return a.tier===t;}).length;
    });
  }

  window.bjAchSetCat=function(cat,btn){
    bjAchCurCat=cat;
    document.querySelectorAll('.bj-ach-catbtn').forEach(function(b){b.classList.remove('active');});
    var b=btn||document.getElementById('bj-ach-cat-'+cat);
    if(b) b.classList.add('active');
    var labels={all:'All Achievements',naturals:'Naturals',streaks:'Streaks',betting:'Betting',balance:'Balance',volume:'Volume',situational:'Situational',poker:'Poker'};
    var lbl=document.getElementById('bj-ach-wall-label');
    if(lbl) lbl.textContent=labels[cat]||'Achievements';
    bjRenderAchWall();
  };

  window.bjAchSetTier=function(tier,btn){
    bjAchCurTier=tier;
    ['all','gold','silver','bronze'].forEach(function(t){
      var b=document.getElementById('bj-ach-tier-'+t);
      if(b) b.className='bj-ach-tierbtn t-'+t+(t===tier?' active':'');
    });
    bjRenderAchWall();
  };

  window.bjAchSearch=function(v){
    var q=(v||'').trim().toLowerCase();
    var result    =document.getElementById('bj-ach-search-result');
    var playerList=document.getElementById('bj-ach-player-list');
    var pdata=(BJ_DB.achievements&&BJ_DB.achievements.players)||{};
    if(!q){
      bjAchCurUser='';
      if(result) result.textContent='';
      if(playerList){playerList.style.display='none';playerList.innerHTML='';}
      bjRenderAchWall();
      return;
    }
    var matches=Object.keys(pdata).filter(function(u){return u.toLowerCase().indexOf(q)!==-1;});
    if(result) result.textContent=matches.length+' PLAYER'+(matches.length!==1?'S':'');
    if(playerList){
      if(!matches.length){playerList.style.display='none';playerList.innerHTML='';}
      else{
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
    bjAchCurUser=matches.length===1?matches[0]:'';
    bjRenderAchWall();
  };

  window.bjAchSelectPlayer=function(u){
    bjAchCurUser=u;
    var input=document.getElementById('bj-ach-search');
    if(input) input.value=u;
    var result=document.getElementById('bj-ach-search-result');
    var pdata =(BJ_DB.achievements&&BJ_DB.achievements.players)||{};
    var earned=Object.keys(pdata[u]||{});
    var g =earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='gold';}).length;
    var sv=earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='silver';}).length;
    var b =earned.filter(function(id){var c=BJ_DB.catalog.find(function(a){return a.id===id;});return c&&c.tier==='bronze';}).length;
    var atPlayer=(BJ_DB.leaderboards.alltime||[]).find(function(p){return (p.u||'').toLowerCase()===u.toLowerCase();});
    var chipsTotal=atPlayer?atPlayer.chips:0;
    if(result) result.innerHTML=
      '<span style="color:#fff;font-weight:800">'+u+'</span>'+
      ' — <span style="color:#D4A017">'+chipsTotal.toLocaleString()+' chips</span>'+
      ' &middot; <span style="color:#FF8000">'+g+' &#9733; Gold</span>'+
      ' <span style="color:#A335EE">'+sv+' Silver</span>'+
      ' <span style="color:#0070DD">'+b+' Bronze</span>'+
      ' <span style="color:rgba(200,200,200,.3)">('+earned.length+' achievements)</span>';
    var playerList=document.getElementById('bj-ach-player-list');
    if(playerList){playerList.style.display='none';playerList.innerHTML='';}
    bjRenderAchWall();
  };

  function bjRenderAchWall(){
    var wall=document.getElementById('bj-ach-wall');
    if(!wall) return;
    var stream=(BJ_DB.achievements&&BJ_DB.achievements.stream)||{};
    var pdata =(BJ_DB.achievements&&BJ_DB.achievements.players)||{};
    var player=bjAchCurUser?(pdata[bjAchCurUser]||null):null;
    var isPersonal=!!(bjAchCurUser&&player);

    var list=(BJ_DB.catalog||[]).filter(function(a){
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
      var isDim   =isPersonal&&!isEarned;
      var cls='bj-ach-card'+(isDim?' dim':'')+(isEarned?' earned':'');
      var badge=isEarned?'<span class="bj-ach-badge bj-ach-badge-earned">&#10003; Earned</span>':'';
      var icon=CAT_ICONS[a.cat]||'★';
      var bottom='';
      if(isPersonal&&isEarned){
        bottom='<div class="bj-ach-bottom"><div class="bj-ach-earn-date">'+(player[a.id]||'earned')+'</div><div class="bj-ach-earn-lbl">Date earned</div></div>';
      } else if(!isPersonal){
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
        '<div class="bj-ach-meta">'+
          '<div><div class="bj-ach-count">'+sd.total+'</div><div class="bj-ach-count-lbl">earned</div></div>'+
        '</div>'+
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
    if(tg&&topGold)  tg.innerHTML='<div class="bj-ach-top-lbl">Most gold achievements</div><div class="bj-ach-top-name">'+topGold+'</div><div class="bj-ach-top-sub" style="color:#FF8000">'+golds[topGold]+' Gold Achievements</div>';
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
      var delta =h.net_delta||0;
      var dSign =delta>0?'+':'';
      var dCls  =delta>0?'pos':delta<0?'neg':'zero';
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

  // ── Page lifecycle ────────────────────────────────────────────
  window.blackjackPageChange=function(name){
    if(name==='blackjack'){
      bjLoadData();
      if(bjRefreshTimer) clearInterval(bjRefreshTimer);
      bjRefreshTimer=setInterval(function(){
        if(bjPageActive()&&!document.hidden) bjLoadData();
      },60000);
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
