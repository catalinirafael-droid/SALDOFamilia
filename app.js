
const SUPABASE_URL = 'https://pfiscvnuusojocwnzmtv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8mWT2rrEnxPWjWbgk3Cvow_boFZfon_';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let currentUser = null;
let currentFamily = null;
let currentMembership = null;
let authMode = 'login';
let userSettings = {theme:'light', notifications_enabled:true, onboarding_done:false, font_scale:'normal', reduced_motion:false};
let selectedMonth = new Date().toISOString().slice(0,7);

let state = {
  categories: [],
  transactions: [],
  goals: [],
  accounts: [],
  cards: [],
  bills: [],
  recurring: [],
  budgets: [],
  notifications: [],
  activity: []
};

const defaultCategories = [
  {name:'Salário', type:'income', emoji:'💼'},
  {name:'Freelance', type:'income', emoji:'💻'},
  {name:'Alimentação', type:'expense', emoji:'🛒'},
  {name:'Moradia', type:'expense', emoji:'🏠'},
  {name:'Transporte', type:'expense', emoji:'🚗'},
  {name:'Saúde', type:'expense', emoji:'💊'},
  {name:'Lazer', type:'expense', emoji:'🎮'},
  {name:'Outros', type:'expense', emoji:'📦'}
];

const brl = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
function today(offset=0){ const d = new Date(); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10); }
function formatDate(s){ if(!s) return ''; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function catName(id){ return state.categories.find(c=>c.id===id)?.name || 'Sem categoria'; }

function setAuthMode(mode){
  authMode = mode;
  loginTab.classList.toggle('active', mode==='login');
  signupTab.classList.toggle('active', mode==='signup');
  nameField.classList.toggle('hidden', mode==='login');
  authSubmit.textContent = mode==='login' ? 'Entrar' : 'Criar conta';
  authMessage.textContent = '';
  authMessage.className = 'auth-message';
}

loginTab.onclick = ()=>setAuthMode('login');
signupTab.onclick = ()=>setAuthMode('signup');

authForm.onsubmit = async e=>{
  e.preventDefault();
  authSubmit.disabled = true;
  authMessage.textContent = authMode==='login' ? 'Entrando...' : 'Criando conta...';
  authMessage.className = 'auth-message';

  const email = authEmail.value.trim();
  const password = authPassword.value;
  if(authMode==='signup' && !passwordLooksStrong(password)){ authSubmit.disabled=false; authMessage.textContent='Use pelo menos 8 caracteres, incluindo letras e números.'; return; }
  let result;

  if(authMode==='signup'){
    result = await sb.auth.signUp({
      email, password,
      options:{ data:{ name: authName.value.trim() || email.split('@')[0] } }
    });
  } else {
    result = await sb.auth.signInWithPassword({email,password});
  }

  authSubmit.disabled = false;

  if(result.error){
    authMessage.textContent = friendlyAuthError(result.error.message);
    return;
  }

  if(authMode==='signup' && !result.data.session){
    authMessage.textContent = 'Conta criada. Verifique seu e-mail para confirmar o cadastro e depois entre.';
    authMessage.className = 'auth-message success';
    setAuthMode('login');
    return;
  }

  if(result.data.session){
    await bootForSession(result.data.session);
  }
};


forgotPasswordBtn.onclick = async ()=>{
  const email = authEmail.value.trim();
  if(!email) return showToast('Digite seu e-mail primeiro.');
  const redirectTo = window.location.origin + window.location.pathname;
  const {error} = await sb.auth.resetPasswordForEmail(email,{redirectTo});
  if(error) return showToast('Erro ao enviar recuperação: '+error.message);
  authMessage.textContent = 'Enviamos um link de recuperação para o seu e-mail.';
  authMessage.className = 'auth-message success';
};

function passwordLooksStrong(value){
  const v=String(value||'');
  return v.length>=8 && /[A-Za-z]/.test(v) && /\d/.test(v);
}

function friendlyAuthError(msg){
  const m = String(msg).toLowerCase();
  if(m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if(m.includes('user already registered')) return 'Este e-mail já está cadastrado.';
  if(m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if(m.includes('password')) return 'Use uma senha com pelo menos 8 caracteres.';
  return msg;
}

async function bootForSession(session){
  currentUser = session.user;
  authScreen.classList.add('hidden');
  logoutBtn.classList.remove('hidden');
  userBadge.classList.remove('hidden');
  userBadge.textContent = currentUser.user_metadata?.name || currentUser.email;
  await refreshFamilyContext();
  await loadUserSettings();
  populateSettingsUI();
  if(userSettings.notifications_enabled) scheduleLocalDueAlerts();
  if(!userSettings.onboarding_done) setTimeout(()=>openOnboarding(),350);
}



async function loadUserSettings(){
  const {data,error}=await sb.rpc('ensure_user_settings');
  if(error){ console.error(error); return; }
  if(data) userSettings=data;
  applyTheme(userSettings.theme || 'light');
  applyAccessibilityPreferences();
  if(userSettings.dashboard_month){
    selectedMonth=String(userSettings.dashboard_month).slice(0,7);
  }
  if(document.getElementById('dashboardMonth')) dashboardMonth.value=selectedMonth;
}

function applyTheme(theme){
  let dark = theme==='dark';
  if(theme==='system') dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark', dark);
}

function populateSettingsUI(){
  if(!currentUser) return;
  if(document.getElementById('profileName')) profileName.value=currentUser.user_metadata?.name || '';
  if(document.getElementById('profileEmail')) profileEmail.value=currentUser.email || '';
  if(document.getElementById('themeSelect')) themeSelect.value=userSettings.theme || 'light';
  if(document.getElementById('notificationsEnabled')) notificationsEnabled.checked=userSettings.notifications_enabled !== false;
  if(document.getElementById('fontScaleSelect')) fontScaleSelect.value=userSettings.font_scale || 'normal';
  if(document.getElementById('reducedMotionEnabled')) reducedMotionEnabled.checked=!!userSettings.reduced_motion;
}

function monthBounds(month){
  const [y,m]=month.split('-').map(Number);
  const first=`${y}-${String(m).padStart(2,'0')}-01`;
  const end=new Date(y,m,0);
  const last=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
  return {first,last};
}

function filteredTransactionsForMonth(){
  const {first,last}=monthBounds(selectedMonth);
  return state.transactions.filter(t=>t.date>=first && t.date<=last);
}

function showToast(message){
  const old=document.querySelector('.toast'); if(old) old.remove();
  const el=document.createElement('div'); el.className='toast'; el.textContent=message;
  document.body.appendChild(el); setTimeout(()=>el.remove(),3500);
}

function downloadText(filename,text,type='application/json'){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function csvEscape(v){
  const s=String(v??'').replace(/"/g,'""');
  return `"${s}"`;
}


function applyAccessibilityPreferences(){document.body.classList.toggle('font-large',userSettings.font_scale==='large');document.body.classList.toggle('reduce-motion',!!userSettings.reduced_motion);}
const onboardingState={step:0,goal:'organize',income:'',accountName:'Carteira'};
const onboardingSteps=[
{title:'Bem-vindo ao SALDOFamília',html:()=>`<div class="onboarding-hero"><div class="big-icon">💜</div><h2>Organize sua vida financeira em família</h2><p>Vamos configurar o essencial em poucos passos. Seus dados ficam protegidos por autenticação, permissões familiares e regras de acesso no banco.</p></div>`},
{title:'Qual é sua prioridade?',html:()=>`<p class="muted">Isso ajuda o app a destacar os recursos mais úteis para você.</p><div class="onboarding-choice-grid">${[['organize','🧾','Organizar gastos','Entender para onde o dinheiro vai'],['save','🎯','Economizar','Criar metas e guardar mais'],['bills','📅','Não esquecer contas','Acompanhar vencimentos'],['family','👨‍👩‍👧‍👦','Organizar em família','Compartilhar o orçamento']].map(x=>`<button type="button" class="onboarding-choice ${onboardingState.goal===x[0]?'selected':''}" data-onboarding-goal="${x[0]}"><strong>${x[1]} ${x[2]}</strong><small style="display:block;margin-top:5px;color:var(--muted)">${x[3]}</small></button>`).join('')}</div>`},
{title:'Comece com uma conta',html:()=>`<p class="muted">Você pode criar uma conta simples agora. É opcional e pode ser alterada depois.</p><label>Nome da conta<input id="onboardingAccountName" value="${escapeHtml(onboardingState.accountName)}" placeholder="Ex.: Carteira, Banco do Brasil" /></label><label>Saldo inicial<input id="onboardingIncome" type="number" step="0.01" min="0" value="${escapeHtml(onboardingState.income)}" placeholder="0,00" /></label>`},
{title:'Tudo pronto',html:()=>`<div class="onboarding-hero"><div class="big-icon">✅</div><h2>Seu SALDOFamília está pronto</h2><p>Você pode começar registrando uma receita ou despesa. O tour guiado continua disponível no menu.</p></div><div class="setup-summary"><div class="setup-summary-row"><span>Prioridade</span><b>${({organize:'Organizar gastos',save:'Economizar',bills:'Contas e vencimentos',family:'Finanças em família'})[onboardingState.goal]}</b></div><div class="setup-summary-row"><span>Segurança</span><b>Proteção em múltiplas camadas</b></div></div>`}
];
function renderOnboarding(){const s=onboardingSteps[onboardingState.step];onboardingTitle.textContent=s.title;onboardingStepLabel.textContent=`Passo ${onboardingState.step+1} de ${onboardingSteps.length}`;onboardingProgressBar.style.width=`${((onboardingState.step+1)/onboardingSteps.length)*100}%`;onboardingContent.innerHTML=s.html();onboardingBackBtn.disabled=onboardingState.step===0;onboardingNextBtn.textContent=onboardingState.step===onboardingSteps.length-1?'Começar a usar':'Continuar';document.querySelectorAll('[data-onboarding-goal]').forEach(b=>b.onclick=()=>{onboardingState.goal=b.dataset.onboardingGoal;renderOnboarding();});}
function openOnboarding(){onboardingState.step=0;onboardingModal.classList.remove('hidden');renderOnboarding();}
async function finishOnboarding(){const n=(onboardingState.accountName||'').trim(),initial=Number(onboardingState.income||0);if(n&&currentUser&&currentFamily&&state.accounts.length===0&&currentMembership?.role!=='viewer'){const {error}=await sb.from('accounts').insert({family_id:currentFamily.id,user_id:currentUser.id,name:n,type:'checking',initial_balance:initial});if(!error)await logActivity('Conta inicial criada','account',null,n);}const {error}=await sb.from('user_settings').upsert({user_id:currentUser.id,onboarding_done:true,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(!error)userSettings.onboarding_done=true;onboardingModal.classList.add('hidden');await loadCloudData();showToast('Configuração concluída. Bem-vindo ao SALDOFamília!');}
const tourSlides=[['🛡️','Segurança em primeiro lugar','Autenticação, RLS e permissões familiares ajudam a manter cada família isolada das demais.'],['🏠','Dashboard mensal','Veja saldo, receitas, despesas, saúde financeira e próximos compromissos em um só lugar.'],['💳','Registre movimentações','Cadastre receitas, despesas, contas, cartões e compras parceladas.'],['🧭','Planeje melhor','Defina orçamentos por categoria, metas e acompanhe projeções até o fim do mês.'],['👨‍👩‍👧‍👦','Compartilhe com controle','Convide familiares e escolha permissões de administrador, membro ou somente leitura.'],['💾','Seus dados, suas opções','Exporte backup JSON e CSV, use tema escuro e instale o app como PWA no celular.']];let tourStep=0;
function renderTour(){const s=tourSlides[tourStep];tourStepLabel.textContent=`${tourStep+1} de ${tourSlides.length}`;tourTitle.textContent=s[1];tourContent.innerHTML=`<div class="tour-slide"><div class="tour-icon">${s[0]}</div><h2>${s[1]}</h2><p>${s[2]}</p></div>`;tourBackBtn.disabled=tourStep===0;tourNextBtn.textContent=tourStep===tourSlides.length-1?'Concluir':'Próximo';}
function openTour(){tourStep=0;tourModal.classList.remove('hidden');renderTour();}

async function ensureFamily(){
  const {data: memberships, error: memberError} = await sb
    .from('family_members')
    .select('id,family_id,user_id,role,created_at')
    .eq('user_id', currentUser.id)
    .order('created_at',{ascending:true})
    .limit(1);

  if(memberError){ console.error(memberError); return false; }

  if(!memberships || memberships.length===0){
    const displayName = currentUser.user_metadata?.name || 'Minha família';
    const {data: familyId, error} = await sb.rpc('create_my_family', {family_name: `${displayName} - Família`});
    if(error){ console.error(error); return false; }
    currentMembership = {family_id: familyId, user_id: currentUser.id, role:'owner'};
  } else {
    currentMembership = memberships[0];
  }

  const {data: fam, error: famError} = await sb
    .from('families')
    .select('*')
    .eq('id', currentMembership.family_id)
    .single();

  if(famError){ console.error(famError); return false; }
  currentFamily = fam;
  return true;
}

async function renderFamily(){if(!currentFamily)return;familyName.textContent=currentFamily.name;const {data:rows,error}=await sb.rpc('get_family_members',{fid:currentFamily.id});if(error){familyMembers.innerHTML='<p>Não foi possível carregar os membros.</p>';return;}familyMembers.innerHTML=(rows||[]).map(m=>{const me=m.user_id===currentUser.id;const can=currentMembership?.role==='owner'&&!me&&m.role!=='owner';return `<div class="member-row"><div class="member-main"><div class="member-avatar">${escapeHtml((m.name||'?')[0].toUpperCase())}</div><div><strong>${escapeHtml(m.name||'Membro')}</strong><div class="member-role">${me?'Você • ':''}${m.role==='owner'?'Administrador':m.role==='viewer'?'Somente leitura':'Membro'}</div></div></div>${can?`<div class="member-actions"><select onchange="changeMemberRole('${m.user_id}',this.value)"><option value="member" ${m.role==='member'?'selected':''}>Membro</option><option value="viewer" ${m.role==='viewer'?'selected':''}>Somente leitura</option></select><button class="secondary small" onclick="transferOwnership('${m.user_id}')">Tornar admin</button><button class="delete-btn" onclick="removeMember('${m.user_id}')">Remover</button></div>`:''}</div>`;}).join('');createInviteBtn.classList.toggle('hidden',currentMembership?.role!=='owner');leaveFamilyBtn.classList.toggle('hidden',currentMembership?.role==='owner');}

async function refreshFamilyContext(){
  const ok = await ensureFamily();
  if(!ok) return;
  await refreshFamilyContext();
  await renderFamily();
}

async function ensureDefaultCategories(){
  const {data, error} = await sb.from('categories').select('id').eq('family_id', currentFamily.id).limit(1);
  if(error){ console.error(error); return; }
  if(data.length) return;

  const rows = defaultCategories.map(c=>({...c,user_id:currentUser.id,family_id:currentFamily.id}));
  const {error:insertError} = await sb.from('categories').insert(rows);
  if(insertError) console.error(insertError);
}

async function loadCloudData(){
  if(!currentFamily) return;
  await sb.rpc('seed_due_notifications',{fid:currentFamily.id}).catch(()=>{});
  const [cats, txs, goals, accounts, cards, bills, recurring, budgets, notifications, activity] = await Promise.all([
    sb.from('categories').select('*').eq('family_id',currentFamily.id).order('created_at',{ascending:true}),
    sb.from('transactions').select('*').eq('family_id',currentFamily.id).order('date',{ascending:false}).order('created_at',{ascending:false}),
    sb.from('goals').select('*').eq('family_id',currentFamily.id).order('created_at',{ascending:true}),
    sb.from('accounts').select('*').eq('family_id',currentFamily.id).order('created_at',{ascending:true}),
    sb.from('credit_cards').select('*').eq('family_id',currentFamily.id).order('created_at',{ascending:true}),
    sb.from('bills').select('*').eq('family_id',currentFamily.id).order('due_date',{ascending:true}),
    sb.from('recurring_rules').select('*').eq('family_id',currentFamily.id).order('next_date',{ascending:true}),
    sb.from('budgets').select('*').eq('family_id',currentFamily.id).order('month',{ascending:false}),
    sb.from('notifications').select('*').eq('family_id',currentFamily.id).order('created_at',{ascending:false}).limit(100),
    sb.from('family_activity').select('*').eq('family_id',currentFamily.id).order('created_at',{ascending:false}).limit(100)
  ]);

  const results=[cats,txs,goals,accounts,cards,bills,recurring,budgets,notifications,activity];
  const anyError=results.find(x=>x.error);
  if(anyError){
    console.error(anyError.error);
    showToast('Alguns dados não puderam ser sincronizados.');
  }

  state.categories = cats.data || [];
  state.transactions = (txs.data || []).map(x=>({...x, category:x.category_id}));
  state.goals = goals.data || [];
  state.accounts = accounts.data || [];
  state.cards = cards.data || [];
  state.bills = bills.data || [];
  state.recurring = recurring.data || [];
  state.budgets = budgets.data || [];
  state.notifications = notifications.data || [];
  state.activity = activity.data || [];
  renderAll();
}

logoutBtn.onclick = async ()=>{
  await sb.auth.signOut();
  currentUser = null;
  currentFamily = null;
  currentMembership = null;
  state = {categories:[],transactions:[],goals:[],accounts:[],cards:[],bills:[],recurring:[],budgets:[],notifications:[],activity:[]};
  authScreen.classList.remove('hidden');
  logoutBtn.classList.add('hidden');
  userBadge.classList.add('hidden');
  authForm.reset();
  setAuthMode('login');
};

function totals(){
  const monthTx = filteredTransactionsForMonth();
  const income = monthTx.filter(t=>t.type==='income').reduce((a,b)=>a+Number(b.amount),0);
  const expense = monthTx.filter(t=>t.type==='expense').reduce((a,b)=>a+Number(b.amount),0);
  return {income, expense, balance: income-expense, savings: income ? ((income-expense)/income)*100 : 0};
}

function renderDashboard(){
  const t = totals();
  balance.textContent = brl(t.balance);
  incomeTotal.textContent = brl(t.income);
  expenseTotal.textContent = brl(t.expense);
  savingsRate.textContent = `${Math.round(t.savings)}%`;
  incomeCard.textContent = brl(t.income);
  expenseCard.textContent = brl(t.expense);
  goalsCount.textContent = state.goals.length;

  const recent = [...filteredTransactionsForMonth()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  recentTransactions.innerHTML = recent.length ? recent.map(x=>`
    <div class="transaction-row">
      <div><strong>${escapeHtml(x.description)}</strong><br><small>${catName(x.category)} • ${formatDate(x.date)}</small></div>
      <b class="${x.type==='income'?'positive':'negative'}">${x.type==='income'?'+':'-'}${brl(x.amount)}</b>
    </div>`).join('') : '<p>Nenhuma movimentação.</p>';

  const expenseByCat = {};
  filteredTransactionsForMonth().filter(x=>x.type==='expense').forEach(x=>expenseByCat[x.category]=(expenseByCat[x.category]||0)+Number(x.amount));
  const max = Math.max(...Object.values(expenseByCat),1);
  categoryBars.innerHTML = Object.entries(expenseByCat).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([cat,val])=>`
    <div class="bar-line">
      <span>${catName(cat)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(val/max)*100}%"></div></div>
      <b>${brl(val)}</b>
    </div>`).join('') || '<p>Nenhuma despesa registrada.</p>';
}

function renderTransactions(){
  const type = typeFilter?.value || 'all';
  const q = (searchTransaction?.value || '').toLowerCase();
  const from = transactionFrom?.value || '';
  const to = transactionTo?.value || '';
  const rows = [...state.transactions].filter(x=>
    (type==='all'||x.type===type) &&
    x.description.toLowerCase().includes(q) &&
    (!from || x.date>=from) &&
    (!to || x.date<=to)
  ).sort((a,b)=>b.date.localeCompare(a.date));
  transactionTable.innerHTML = rows.map(x=>`
    <tr>
      <td>${formatDate(x.date)}</td>
      <td><strong>${escapeHtml(x.description)}</strong></td>
      <td>${catName(x.category)}</td>
      <td><span class="badge ${x.type}">${x.type==='income'?'Receita':'Despesa'}</span></td>
      <td class="${x.type==='income'?'positive':'negative'}"><strong>${x.type==='income'?'+':'-'}${brl(x.amount)}</strong></td>
      <td><button class="delete-btn" onclick="deleteTransaction('${x.id}')">Excluir</button></td>
    </tr>`).join('') || '<tr><td colspan="6">Nenhuma transação encontrada.</td></tr>';
}

function renderCategories(){
  categoryGrid.innerHTML = state.categories.map(c=>`
    <article class="card category-card">
      <div class="emoji">${c.emoji}</div>
      <h4>${escapeHtml(c.name)}</h4>
      <p>${c.type==='income'?'Receita':'Despesa'}</p>
    </article>`).join('');
  transactionCategory.innerHTML = state.categories.map(c=>`<option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('');
}

function renderGoals(){
  goalGrid.innerHTML = state.goals.map(g=>{
    const pct = Math.min(100, Math.round((Number(g.current)/Number(g.target))*100));
    return `<article class="card">
      <h3>${escapeHtml(g.name)}</h3>
      <div class="goal-progress"><span style="width:${pct}%"></span></div>
      <div class="goal-values"><span>${brl(g.current)} de ${brl(g.target)}</span><b>${pct}%</b></div>
      <button class="secondary small" style="margin-top:14px" onclick="advanceGoal('${g.id}')">+ Adicionar valor</button>
    </article>`;
  }).join('') || '<article class="card">Nenhuma meta cadastrada.</article>';
}

function renderReports(){
  const t = totals();
  reportSummary.innerHTML = `
    <div class="report-box"><span>Receitas</span><strong class="positive">${brl(t.income)}</strong></div>
    <div class="report-box"><span>Despesas</span><strong class="negative">${brl(t.expense)}</strong></div>
    <div class="report-box"><span>Saldo</span><strong>${brl(t.balance)}</strong></div>
    <div class="report-box"><span>Economia</span><strong>${Math.round(t.savings)}%</strong></div>`;
  const expenseByCat = {};
  filteredTransactionsForMonth().filter(x=>x.type==='expense').forEach(x=>expenseByCat[x.category]=(expenseByCat[x.category]||0)+Number(x.amount));
  const totalExpense = Object.values(expenseByCat).reduce((a,b)=>a+b,0)||1;
  reportCategories.innerHTML = Object.entries(expenseByCat).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>`
    <div class="transaction-row"><span>${catName(cat)}</span><b>${brl(val)} • ${Math.round(val/totalExpense*100)}%</b></div>`).join('') || '<p>Nenhuma despesa registrada.</p>';
}

function generateInsights(){
  const t = totals();
  const expenses = state.transactions.filter(x=>x.type==='expense');
  const catTotals = {};
  expenses.forEach(x=>catTotals[x.category]=(catTotals[x.category]||0)+Number(x.amount));
  const largest = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  const insights = [];

  if (t.income === 0) {
    insights.push(['⚠️','Cadastre suas receitas','Ainda não há receitas registradas. Cadastre uma entrada para calcular sua taxa de economia.']);
  } else {
    const commitment = (t.expense/t.income)*100;
    insights.push(['📌','Comprometimento da renda',`Suas despesas representam ${Math.round(commitment)}% das receitas registradas.`]);
    if (t.savings >= 20) insights.push(['✅','Boa margem de economia',`Sua taxa de economia está em ${Math.round(t.savings)}%. Você está guardando uma parte relevante da renda.`]);
    else if (t.savings > 0) insights.push(['💡','Espaço para economizar',`Sua taxa de economia está em ${Math.round(t.savings)}%. Tente definir uma meta mensal de economia.`]);
    else insights.push(['🚨','Atenção ao saldo',`As despesas estão iguais ou acima das receitas. Revise gastos e prioridades.`]);
  }
  if (largest) insights.push(['📊','Maior categoria de gasto',`${catName(largest[0])} é sua maior categoria de despesa, com ${brl(largest[1])}.`]);
  const overdueBills = state.bills.filter(b=>billStatus(b)==='overdue');
  if(overdueBills.length) insights.push(['⏰','Contas vencidas',`Existem ${overdueBills.length} compromisso(s) vencido(s), somando ${brl(overdueBills.reduce((s,b)=>s+Number(b.amount),0))}.`]);

  if(state.cards.length){
    const cardSpend={}; state.transactions.filter(t=>t.type==='expense'&&t.credit_card_id).forEach(t=>cardSpend[t.credit_card_id]=(cardSpend[t.credit_card_id]||0)+Number(t.amount));
    const risk=state.cards.map(c=>({c,rate:Number(c.limit_amount)?(cardSpend[c.id]||0)/Number(c.limit_amount):0})).sort((a,b)=>b.rate-a.rate)[0];
    if(risk && risk.rate>=.8) insights.push(['💳','Atenção ao limite',`${risk.c.name} está com aproximadamente ${Math.round(risk.rate*100)}% do limite comprometido pelos lançamentos registrados.`]);
  }

  if (state.goals.length) {
    const avg = state.goals.reduce((s,g)=>s+Math.min(100,(Number(g.current)/Number(g.target))*100),0)/state.goals.length;
    insights.push(['🎯','Progresso das metas',`O progresso médio das suas metas é de ${Math.round(avg)}%.`]);
  }
  aiInsights.innerHTML = insights.map(i=>`<article class="card ai-card"><div class="ai-icon">${i[0]}</div><h4>${i[1]}</h4><p>${i[2]}</p></article>`).join('');
}


function accountName(id){ return state.accounts.find(a=>a.id===id)?.name || 'Sem conta'; }
function cardName(id){ return state.cards.find(a=>a.id===id)?.name || 'Sem cartão'; }

function renderAccounts(){
  if(!document.getElementById('accountGrid')) return;
  const txByAcc = {};
  state.transactions.forEach(t=>{
    if(!t.account_id) return;
    txByAcc[t.account_id] = (txByAcc[t.account_id]||0) + (t.type==='income'?Number(t.amount):-Number(t.amount));
  });
  accountGrid.innerHTML = state.accounts.map(a=>{
    const bal = Number(a.initial_balance) + (txByAcc[a.id]||0);
    return `<article class="card"><div class="emoji">🏦</div><h3>${escapeHtml(a.name)}</h3><p class="muted">${accountTypeLabel(a.type)}</p><div class="metric">${brl(bal)}</div><small class="muted">Saldo calculado</small></article>`;
  }).join('') || '<article class="card">Nenhuma conta cadastrada.</article>';
}

function accountTypeLabel(t){
  return ({checking:'Conta corrente',savings:'Poupança',cash:'Dinheiro',investment:'Investimento',other:'Outra'})[t]||t;
}

function renderCards(){
  if(!document.getElementById('cardGrid')) return;
  const spentByCard = {};
  state.transactions.filter(t=>t.type==='expense' && t.credit_card_id).forEach(t=>spentByCard[t.credit_card_id]=(spentByCard[t.credit_card_id]||0)+Number(t.amount));
  cardGrid.innerHTML = state.cards.map(c=>{
    const spent=spentByCard[c.id]||0, available=Math.max(0,Number(c.limit_amount)-spent), pct=Number(c.limit_amount)?Math.min(100,spent/Number(c.limit_amount)*100):0;
    return `<article class="card"><div class="emoji">💳</div><h3>${escapeHtml(c.name)}</h3><p class="muted">Fecha dia ${c.closing_day} • vence dia ${c.due_day}</p><div class="goal-progress"><span style="width:${pct}%"></span></div><div class="goal-values"><span>Usado ${brl(spent)}</span><b>Disponível ${brl(available)}</b></div></article>`;
  }).join('') || '<article class="card">Nenhum cartão cadastrado.</article>';
}

function billStatus(b){
  if(b.status==='pending' && b.due_date < today()) return 'overdue';
  return b.status;
}
function billStatusLabel(s){ return ({pending:'Pendente',paid:'Pago',received:'Recebido',overdue:'Vencido',cancelled:'Cancelado'})[s]||s; }

function renderCalendar(){
  if(!document.getElementById('billTable')) return;
  const pending=state.bills.filter(b=>billStatus(b)==='pending').reduce((s,b)=>s+Number(b.amount),0);
  const overdue=state.bills.filter(b=>billStatus(b)==='overdue').reduce((s,b)=>s+Number(b.amount),0);
  const receivable=state.bills.filter(b=>b.type==='income' && ['pending','overdue'].includes(billStatus(b))).reduce((s,b)=>s+Number(b.amount),0);
  calendarSummary.innerHTML = `
    <article class="card"><div class="card-title">A pagar</div><div class="metric negative">${brl(pending)}</div></article>
    <article class="card"><div class="card-title">Vencido</div><div class="metric negative">${brl(overdue)}</div></article>
    <article class="card"><div class="card-title">A receber</div><div class="metric positive">${brl(receivable)}</div></article>`;
  const filter = billStatusFilter?.value || 'all';
  const rows=state.bills.filter(b=>filter==='all'||billStatus(b)===filter);
  billTable.innerHTML = rows.map(b=>{
    const st=billStatus(b);
    const done=['paid','received','cancelled'].includes(st);
    return `<tr><td>${formatDate(b.due_date)}</td><td><strong>${escapeHtml(b.description)}</strong></td><td>${b.type==='income'?'Receber':'Pagar'}</td><td>${brl(b.amount)}</td><td><span class="badge ${st==='overdue'?'expense':(st==='paid'||st==='received')?'income':''}">${billStatusLabel(st)}</span></td><td>${done?'':`<button class="secondary small" onclick="settleBill('${b.id}')">${b.type==='income'?'Receber':'Pagar'}</button>`}</td></tr>`;
  }).join('') || '<tr><td colspan="6">Nenhum compromisso encontrado.</td></tr>';
}

function renderRecurring(){
  if(!document.getElementById('recurringGrid')) return;
  recurringGrid.innerHTML=state.recurring.map(r=>`<article class="card"><div class="emoji">🔁</div><h3>${escapeHtml(r.description)}</h3><div class="metric ${r.type==='income'?'positive':'negative'}">${brl(r.amount)}</div><p class="muted">${({weekly:'Semanal',monthly:'Mensal',yearly:'Anual'})[r.frequency]} • próxima: ${formatDate(r.next_date)}</p><span class="badge ${r.active?'income':''}">${r.active?'Ativa':'Pausada'}</span></article>`).join('') || '<article class="card">Nenhuma recorrência cadastrada.</article>';
}

function fillFinanceSelects(){
  const cats = state.categories.map(c=>`<option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('');
  const budgetEl=document.getElementById('budgetCategory'); if(budgetEl) budgetEl.innerHTML=state.categories.filter(c=>c.type==='expense').map(c=>`<option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('');
  ['billCategory','recurringCategory'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=cats;});
  const acc='<option value="">Sem conta</option>'+state.accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  ['transactionAccount','billAccount','recurringAccount'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=acc;});
  const cards='<option value="">Sem cartão</option>'+state.cards.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  ['transactionCard','billCard','recurringCard'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=cards;});
}


async function logActivity(action,entityType=null,entityId=null,description=null){
  if(!currentFamily) return;
  await sb.rpc('log_family_activity',{fid:currentFamily.id,act:action,etype:entityType,eid:entityId,descr:description}).catch(()=>{});
}

function renderBudgets(){
  if(!document.getElementById('budgetGrid')) return;
  const monthStart=selectedMonth+'-01';
  const monthBudgets=state.budgets.filter(b=>String(b.month).slice(0,7)===selectedMonth);
  const expenses=filteredTransactionsForMonth().filter(t=>t.type==='expense');
  const spentByCat={};
  expenses.forEach(t=>spentByCat[t.category]=(spentByCat[t.category]||0)+Number(t.amount));

  const totalBudget=monthBudgets.reduce((s,b)=>s+Number(b.amount),0);
  const spentOnBudget=monthBudgets.reduce((s,b)=>s+(spentByCat[b.category_id]||0),0);
  const remaining=totalBudget-spentOnBudget;

  budgetSummary.innerHTML=`
    <article class="card"><div class="card-title">Orçamento total</div><div class="metric">${brl(totalBudget)}</div></article>
    <article class="card"><div class="card-title">Gasto nas categorias</div><div class="metric negative">${brl(spentOnBudget)}</div></article>
    <article class="card"><div class="card-title">Restante</div><div class="metric ${remaining<0?'negative':'positive'}">${brl(remaining)}</div></article>`;

  budgetGrid.innerHTML=monthBudgets.map(b=>{
    const spent=spentByCat[b.category_id]||0;
    const limit=Number(b.amount)||0;
    const pct=limit?Math.round(spent/limit*100):0;
    const cls=pct>100?'over':pct>=80?'warn':'ok';
    return `<article class="card budget-card">
      <div class="budget-head"><div><h3>${escapeHtml(catName(b.category_id))}</h3><small class="muted">${selectedMonth}</small></div><span class="budget-status ${cls}">${pct}%</span></div>
      <div class="progress-track"><div class="progress-fill ${pct>100?'over':''}" style="width:${Math.min(100,pct)}%"></div></div>
      <div class="goal-values"><span>Gasto ${brl(spent)}</span><b>Limite ${brl(limit)}</b></div>
      <button class="delete-btn" style="margin-top:12px" onclick="deleteBudget('${b.id}')">Excluir</button>
    </article>`;
  }).join('') || '<article class="card">Nenhum orçamento definido para este mês.</article>';

  budgetCategory.innerHTML=state.categories.filter(c=>c.type==='expense').map(c=>`<option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('');
  budgetMonth.value=selectedMonth;
}

function renderForecast(){
  if(!document.getElementById('forecastCards')) return;
  const tx=filteredTransactionsForMonth();
  const income=tx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  const now=new Date();
  const currentYM=now.toISOString().slice(0,7);
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const day=currentYM===selectedMonth?now.getDate():daysInMonth;
  const projectedExpense=day>0 ? expense/day*daysInMonth : expense;
  const projectedBalance=income-projectedExpense;

  const futureBills=state.bills.filter(b=>billStatus(b)==='pending' && b.due_date>=today()).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const futureIncome=futureBills.filter(b=>b.type==='income').reduce((s,b)=>s+Number(b.amount),0);
  const futureExpense=futureBills.filter(b=>b.type==='expense').reduce((s,b)=>s+Number(b.amount),0);
  const currentBalance=totals().balance;
  const futureBalance=currentBalance+futureIncome-futureExpense;

  forecastCards.innerHTML=`
    <article class="card"><div class="card-title">Despesa projetada no mês</div><div class="forecast-big">${brl(projectedExpense)}</div><div class="forecast-sub">Com base no ritmo atual</div></article>
    <article class="card"><div class="card-title">Saldo projetado do mês</div><div class="forecast-big ${projectedBalance<0?'negative':'positive'}">${brl(projectedBalance)}</div><div class="forecast-sub">Receitas atuais menos despesas projetadas</div></article>
    <article class="card"><div class="card-title">Saldo após compromissos futuros</div><div class="forecast-big ${futureBalance<0?'negative':'positive'}">${brl(futureBalance)}</div><div class="forecast-sub">Inclui contas pendentes cadastradas</div></article>`;

  cashflowTimeline.innerHTML=futureBills.slice(0,12).map(b=>`
    <div class="timeline-row"><span>${formatDate(b.due_date)}</span><div><strong>${escapeHtml(b.description)}</strong><small class="muted" style="display:block">${b.type==='income'?'Entrada prevista':'Saída prevista'}</small></div><b class="${b.type==='income'?'positive':'negative'}">${b.type==='income'?'+':'-'}${brl(b.amount)}</b></div>
  `).join('') || '<p class="muted">Nenhum compromisso futuro cadastrado.</p>';

  const alerts=[];
  if(projectedBalance<0) alerts.push(['🚨','A projeção indica saldo negativo no fim do mês.']);
  if(projectedExpense>expense*1.2 && day<daysInMonth) alerts.push(['📈','O ritmo atual de gastos pode elevar bastante a despesa até o fim do mês.']);
  const overBudgets=state.budgets.filter(b=>String(b.month).slice(0,7)===selectedMonth).filter(b=>{
    const spent=tx.filter(t=>t.type==='expense'&&t.category===b.category_id).reduce((s,t)=>s+Number(t.amount),0);
    return spent>Number(b.amount);
  });
  if(overBudgets.length) alerts.push(['🧭',`${overBudgets.length} orçamento(s) por categoria já ultrapassaram o limite.`]);
  if(futureBalance<0) alerts.push(['⏳','Os compromissos futuros cadastrados podem deixar o saldo negativo.']);
  if(!alerts.length) alerts.push(['✅','Nenhum alerta crítico detectado na projeção atual.']);
  forecastInsights.innerHTML=alerts.map(a=>`<div class="transaction-row"><span>${a[0]}</span><div style="flex:1;margin-left:10px">${a[1]}</div></div>`).join('');
}

function renderNotifications(){
  if(!document.getElementById('notificationList')) return;
  const unread=state.notifications.filter(n=>!n.read_at);
  notificationCount.textContent=unread.length;
  notificationCount.classList.toggle('hidden',unread.length===0);
  notificationStatus.textContent=`${unread.length} não lida(s)`;

  notificationList.innerHTML=state.notifications.map(n=>`
    <div class="notification-item">
      <span class="notification-dot ${n.kind}"></span>
      <div class="notification-body"><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.message)}</p><small>${new Date(n.created_at).toLocaleString('pt-BR')}</small></div>
      ${n.read_at?'':'<button class="secondary small" onclick="markNotificationRead(\''+n.id+'\')">Lida</button>'}
    </div>`).join('') || '<p class="muted">Nenhuma notificação.</p>';
}

function activityIcon(a){
  if(a.includes('trans')) return '💳';
  if(a.includes('meta')) return '🎯';
  if(a.includes('conta')) return '🏦';
  if(a.includes('cart')) return '💳';
  if(a.includes('orçamento')) return '🧭';
  return '🕘';
}

function renderActivity(){
  if(!document.getElementById('activityList')) return;
  activityList.innerHTML=state.activity.map(a=>`
    <div class="activity-row"><div class="activity-icon">${activityIcon(a.action||'')}</div><div class="activity-content"><strong>${escapeHtml(a.action)}</strong><p>${escapeHtml(a.description||a.entity_type||'')}</p><small>${new Date(a.created_at).toLocaleString('pt-BR')}</small></div></div>
  `).join('') || '<p class="muted">Nenhuma atividade registrada ainda.</p>';
}

function performGlobalSearch(q){
  const query=q.trim().toLowerCase();
  if(query.length<2){globalSearchResults.classList.add('hidden');globalSearchResults.innerHTML='';return;}
  const results=[];
  state.transactions.filter(x=>x.description.toLowerCase().includes(query)).slice(0,5).forEach(x=>results.push({view:'transactions',title:x.description,meta:`Transação • ${brl(x.amount)} • ${formatDate(x.date)}`}));
  state.goals.filter(x=>x.name.toLowerCase().includes(query)).slice(0,4).forEach(x=>results.push({view:'goals',title:x.name,meta:`Meta • ${brl(x.current)} de ${brl(x.target)}`}));
  state.bills.filter(x=>x.description.toLowerCase().includes(query)).slice(0,4).forEach(x=>results.push({view:'calendar',title:x.description,meta:`Compromisso • ${brl(x.amount)} • ${formatDate(x.due_date)}`}));
  state.accounts.filter(x=>x.name.toLowerCase().includes(query)).slice(0,3).forEach(x=>results.push({view:'accounts',title:x.name,meta:'Conta'}));
  state.cards.filter(x=>x.name.toLowerCase().includes(query)).slice(0,3).forEach(x=>results.push({view:'cards',title:x.name,meta:'Cartão'}));
  globalSearchResults.innerHTML=results.slice(0,12).map((r,i)=>`<div class="search-result" data-view="${r.view}"><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.meta)}</small></div>`).join('') || '<div class="search-result">Nada encontrado.</div>';
  globalSearchResults.classList.remove('hidden');
  globalSearchResults.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{showView(el.dataset.view);globalSearch.value='';globalSearchResults.classList.add('hidden');});
}


function previousMonthKey(month){const [y,m]=month.split('-').map(Number);const d=new Date(y,m-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function txForMonth(month){const {first,last}=monthBounds(month);return state.transactions.filter(t=>t.date>=first&&t.date<=last);}
function renderFinancialHealth(){if(!document.getElementById('healthScore'))return;const current=filteredTransactionsForMonth();const income=current.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);const expense=current.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);const savings=income?Math.max(-1,(income-expense)/income):0;const overdue=state.bills.filter(b=>billStatus(b)==='overdue').reduce((s,b)=>s+Number(b.amount),0);let score=50;if(income>0){score+=Math.max(-30,Math.min(30,savings*100));if(expense<=income)score+=10}else score-=10;if(overdue>0)score-=20;score=Math.max(0,Math.min(100,Math.round(score)));healthScore.textContent=score;healthLabel.textContent=score>=80?'Excelente':score>=65?'Boa':score>=45?'Atenção':score>=25?'Frágil':'Crítica';const prev=txForMonth(previousMonthKey(selectedMonth));const pi=prev.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);const pe=prev.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);const id=pi?((income-pi)/pi*100):null;const ed=pe?((expense-pe)/pe*100):null;monthComparison.innerHTML=`<div class="comparison-row"><span>Receitas</span><b>${id===null?'—':`${id>=0?'+':''}${Math.round(id)}%`}</b></div><div class="comparison-row"><span>Despesas</span><b>${ed===null?'—':`${ed>=0?'+':''}${Math.round(ed)}%`}</b></div>`;const end=new Date();end.setDate(end.getDate()+7);const endStr=end.toISOString().slice(0,10);const next=state.bills.filter(b=>billStatus(b)==='pending'&&b.due_date>=today()&&b.due_date<=endStr).sort((a,b)=>a.due_date.localeCompare(b.due_date));next7Days.innerHTML=next.slice(0,4).map(b=>`<div class="next-day-row"><span>${escapeHtml(b.description)}<small class="muted" style="display:block">${formatDate(b.due_date)}</small></span><b>${brl(b.amount)}</b></div>`).join('')||'<p class="muted">Nenhum compromisso próximo.</p>';}
async function renderSecurityCenter(){if(!document.getElementById('securityChecklist')||!currentUser)return;const checks=[[!!currentUser.email_confirmed_at,'E-mail confirmado'],[!!currentUser.user_metadata?.name,'Perfil identificado'],[!!currentFamily,'Família protegida'],[navigator.onLine,'Conexão ativa']];securityChecklist.innerHTML=checks.map(c=>`<div class="security-item"><span class="security-status ${c[0]?'ok':'warn'}">${c[0]?'✓':'!'}</span><div><strong>${c[1]}</strong></div></div>`).join('');sessionDetails.innerHTML=`<div class="session-line"><span>Usuário</span><b>${escapeHtml(currentUser.email||'')}</b></div><div class="session-line"><span>Família</span><b>${escapeHtml(currentFamily?.name||'—')}</b></div><div class="session-line"><span>Permissão</span><b>${currentMembership?.role==='owner'?'Administrador':currentMembership?.role==='viewer'?'Somente leitura':'Membro'}</b></div>`;}
function applyRolePermissions(){const viewer=currentMembership?.role==='viewer';['openTransactionModal','openGoalModal','addCategoryBtn','openAccountModal','openCardModal','openBillModal','openRecurringModal','openBudgetModal','processRecurringBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=viewer;});}

function renderAll(){ applyRolePermissions(); renderDashboard(); renderFinancialHealth(); renderTransactions(); renderCategories(); renderGoals(); renderReports(); renderAccounts(); renderCards(); renderCalendar(); renderRecurring(); renderBudgets(); renderForecast(); renderNotifications(); renderActivity(); renderSecurityCenter(); fillFinanceSelects(); generateInsights(); if(currentFamily) renderFamily(); }

window.deleteTransaction = async id => {
  if(!confirm('Excluir esta transação?')) return;
  const {error} = await sb.from('transactions').delete().eq('id',id);
  if(error) return alert('Erro ao excluir: '+error.message);
  await loadCloudData();
};

window.advanceGoal = async id => {
  const g = state.goals.find(x=>x.id===id);
  const value = Number(prompt(`Quanto deseja adicionar à meta "${g.name}"?`, '100'));
  if(!(value>0)) return;
  const newValue = Math.min(Number(g.target), Number(g.current)+value);
  const {error} = await sb.from('goals').update({current:newValue}).eq('id',id);
  if(error) return alert('Erro ao atualizar meta: '+error.message);
  await loadCloudData();
};

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.go)));

function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===id));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('[data-mobile-view]').forEach(x=>x.classList.toggle('active',x.dataset.mobileView===id));
  const titles = {dashboard:['Visão geral','Acompanhe as finanças da família'],transactions:['Transações','Registre receitas e despesas'],categories:['Categorias','Organize seus lançamentos'],goals:['Metas','Acompanhe seus objetivos'],reports:['Relatórios','Veja o desempenho financeiro'],budgets:['Orçamentos','Limites mensais por categoria'],forecast:['Projeção','Fluxo de caixa e estimativas'],family:['Família','Compartilhamento e colaboração'],accounts:['Contas','Saldos e contas bancárias'],cards:['Cartões','Limites e vencimentos'],calendar:['Calendário','Contas a pagar e receber'],recurring:['Recorrências','Lançamentos automáticos'],ai:['Análise com IA','Insights automáticos sem custo'],activity:['Atividades','Histórico da família'],security:['Segurança','Proteção da conta e sessão'],settings:['Configurações','Conta, backup e privacidade']};
  pageTitle.textContent = titles[id][0]; pageSubtitle.textContent=titles[id][1];
}

openTransactionModal.onclick = mobileAdd.onclick = ()=> {
  transactionModal.classList.remove('hidden');
  transactionForm.elements.date.value = today();
};
openGoalModal.onclick = ()=>goalModal.classList.remove('hidden');
openAccountModal.onclick = ()=>accountModal.classList.remove('hidden');
openCardModal.onclick = ()=>cardModal.classList.remove('hidden');
openBillModal.onclick = ()=>{ billModal.classList.remove('hidden'); billForm.elements.due_date.value=today(); };
openRecurringModal.onclick = ()=>{ recurringModal.classList.remove('hidden'); recurringForm.elements.next_date.value=today(); };
openBudgetModal.onclick = ()=>{ budgetModal.classList.remove('hidden'); budgetMonth.value=selectedMonth; };
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).classList.add('hidden'));

transactionForm.onsubmit = async e=>{
  e.preventDefault();
  const f = new FormData(e.target);
  const total = Math.max(1, Number(f.get('installments')||1));
  const amount = Number(f.get('amount'));
  const groupId = total>1 ? crypto.randomUUID() : null;
  const rows = [];
  for(let i=1;i<=total;i++){
    const d = new Date(f.get('date')+'T12:00:00');
    if(i>1) d.setMonth(d.getMonth()+i-1);
    rows.push({
      user_id: currentUser.id,
      family_id: currentFamily.id,
      type:f.get('type'),
      description: total>1 ? `${f.get('description').trim()} (${i}/${total})` : f.get('description').trim(),
      amount: total>1 ? Number((amount/total).toFixed(2)) : amount,
      category_id:f.get('category') || null,
      account_id:f.get('account_id') || null,
      credit_card_id:f.get('credit_card_id') || null,
      installment_group:groupId,
      installment_number:total>1?i:null,
      installment_total:total>1?total:null,
      date:d.toISOString().slice(0,10)
    });
  }
  const {error} = await sb.from('transactions').insert(rows);
  if(error) return alert('Erro ao salvar transação: '+error.message);
  e.target.reset(); transactionModal.classList.add('hidden'); await logActivity('Transação adicionada','transaction',null,`${rows.length} lançamento(s) • ${f.get('description')}`); await loadCloudData();
};

goalForm.onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  const {error} = await sb.from('goals').insert({
    user_id:currentUser.id,
    family_id:currentFamily.id,
    name:f.get('name').trim(),
    target:Number(f.get('target')),
    current:Number(f.get('current'))
  });
  if(error) return alert('Erro ao salvar meta: '+error.message);
  e.target.reset();
  goalModal.classList.add('hidden');
  await loadCloudData();
};

addCategoryBtn.onclick=async ()=>{
  const name=prompt('Nome da nova categoria:');
  if(!name) return;
  const type=confirm('Clique OK para Receita. Cancelar para Despesa.')?'income':'expense';
  const {error} = await sb.from('categories').insert({
    user_id:currentUser.id, family_id:currentFamily.id, name:name.trim(), type, emoji:type==='income'?'💰':'🏷️'
  });
  if(error) return alert('Erro ao criar categoria: '+error.message);
  await loadCloudData();
};


createInviteBtn.onclick = async ()=>{
  if(!currentFamily || currentMembership?.role !== 'owner') return;
  createInviteBtn.disabled = true;
  createInviteBtn.textContent = 'Gerando...';
  const {data, error} = await sb.rpc('create_family_invite',{fid:currentFamily.id});
  createInviteBtn.disabled = false;
  createInviteBtn.textContent = 'Gerar convite';
  if(error) return alert('Erro ao gerar convite: '+error.message);
  inviteResult.classList.remove('hidden');
  inviteResult.innerHTML = `<strong>Código de convite</strong><div class="invite-code">${escapeHtml(data)}</div><small>Válido por 7 dias e para uma única utilização.</small>`;
};

joinFamilyBtn.onclick = async ()=>{
  const code = inviteCodeInput.value.trim().toUpperCase();
  if(!code) return alert('Digite o código do convite.');
  const {error} = await sb.rpc('join_family_by_code',{invite_code:code});
  if(error) return alert('Não foi possível entrar: '+error.message);
  inviteCodeInput.value='';
  await refreshFamilyContext();
  alert('Você entrou na família com sucesso.');
};



accountForm.onsubmit=async e=>{
  e.preventDefault(); const f=new FormData(e.target);
  const {error}=await sb.from('accounts').insert({family_id:currentFamily.id,user_id:currentUser.id,name:f.get('name').trim(),type:f.get('type'),initial_balance:Number(f.get('initial_balance')||0)});
  if(error)return alert('Erro ao salvar conta: '+error.message);
  e.target.reset(); accountModal.classList.add('hidden'); await logActivity('Conta criada','account',null,f.get('name').trim()); await loadCloudData();
};

cardForm.onsubmit=async e=>{
  e.preventDefault(); const f=new FormData(e.target);
  const {error}=await sb.from('credit_cards').insert({family_id:currentFamily.id,user_id:currentUser.id,name:f.get('name').trim(),limit_amount:Number(f.get('limit_amount')),closing_day:Number(f.get('closing_day')),due_day:Number(f.get('due_day'))});
  if(error)return alert('Erro ao salvar cartão: '+error.message);
  e.target.reset(); cardModal.classList.add('hidden'); await logActivity('Cartão criado','credit_card',null,f.get('name').trim()); await loadCloudData();
};

billForm.onsubmit=async e=>{
  e.preventDefault(); const f=new FormData(e.target);
  const {error}=await sb.from('bills').insert({family_id:currentFamily.id,user_id:currentUser.id,type:f.get('type'),description:f.get('description').trim(),amount:Number(f.get('amount')),due_date:f.get('due_date'),category_id:f.get('category_id')||null,account_id:f.get('account_id')||null,credit_card_id:f.get('credit_card_id')||null});
  if(error)return alert('Erro ao salvar compromisso: '+error.message);
  e.target.reset(); billModal.classList.add('hidden'); await logActivity('Compromisso criado','bill',null,f.get('description').trim()); await loadCloudData();
};

recurringForm.onsubmit=async e=>{
  e.preventDefault(); const f=new FormData(e.target);
  const {error}=await sb.from('recurring_rules').insert({family_id:currentFamily.id,user_id:currentUser.id,type:f.get('type'),description:f.get('description').trim(),amount:Number(f.get('amount')),frequency:f.get('frequency'),next_date:f.get('next_date'),category_id:f.get('category_id')||null,account_id:f.get('account_id')||null,credit_card_id:f.get('credit_card_id')||null});
  if(error)return alert('Erro ao salvar recorrência: '+error.message);
  e.target.reset(); recurringModal.classList.add('hidden'); await logActivity('Recorrência criada','recurring',null,f.get('description').trim()); await loadCloudData();
};

window.settleBill=async id=>{
  const {error}=await sb.rpc('post_bill_as_transaction',{bid:id});
  if(error)return alert('Erro: '+error.message);
  await loadCloudData();
};

processRecurringBtn.onclick=async ()=>{
  const {data,error}=await sb.rpc('generate_recurring_due');
  if(error)return alert('Erro ao processar recorrências: '+error.message);
  alert(`${data||0} lançamento(s) recorrente(s) criado(s).`);
  await loadCloudData();
};
billStatusFilter.onchange=renderCalendar;



budgetForm.onsubmit=async e=>{
  e.preventDefault(); const f=new FormData(e.target);
  const month=f.get('month')+'-01';
  const payload={family_id:currentFamily.id,user_id:currentUser.id,category_id:f.get('category_id'),month,amount:Number(f.get('amount')),updated_at:new Date().toISOString()};
  const {data,error}=await sb.from('budgets').upsert(payload,{onConflict:'family_id,category_id,month'}).select('id').single();
  if(error)return showToast('Erro ao salvar orçamento: '+error.message);
  await logActivity('Orçamento atualizado','budget',data?.id,`${catName(payload.category_id)} • ${brl(payload.amount)}`);
  budgetModal.classList.add('hidden'); await loadCloudData(); showToast('Orçamento salvo.');
};

window.deleteBudget=async id=>{
  if(!confirm('Excluir este orçamento?')) return;
  const {error}=await sb.from('budgets').delete().eq('id',id);
  if(error)return showToast('Erro ao excluir orçamento.');
  await logActivity('Orçamento excluído','budget',id,'Orçamento mensal removido');
  await loadCloudData();
};

notificationsBtn.onclick=()=>{notificationsModal.classList.remove('hidden');renderNotifications();};
window.markNotificationRead=async id=>{
  await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);
  await loadCloudData();
};
markAllReadBtn.onclick=async ()=>{
  const ids=state.notifications.filter(n=>!n.read_at).map(n=>n.id);
  if(!ids.length)return;
  await sb.from('notifications').update({read_at:new Date().toISOString()}).in('id',ids);
  await loadCloudData();
};
refreshActivityBtn.onclick=()=>loadCloudData();
globalSearch.oninput=()=>performGlobalSearch(globalSearch.value);
document.addEventListener('click',e=>{if(!e.target.closest('.global-search-wrap'))globalSearchResults.classList.add('hidden');});



window.changeMemberRole=async(userId,role)=>{const {error}=await sb.rpc('update_family_member_role',{fid:currentFamily.id,target_user:userId,new_role:role});if(error)return showToast(error.message);await loadCloudData();};
window.removeMember=async userId=>{if(!confirm('Remover este membro da família?'))return;const {error}=await sb.rpc('remove_family_member',{fid:currentFamily.id,target_user:userId});if(error)return showToast(error.message);await loadCloudData();};
window.transferOwnership=async userId=>{if(!confirm('Transferir a administração para este membro?'))return;const {error}=await sb.rpc('transfer_family_ownership',{fid:currentFamily.id,new_owner:userId});if(error)return showToast(error.message);await refreshFamilyContext();};
leaveFamilyBtn.onclick=async()=>{if(!confirm('Sair desta família?'))return;const {error}=await sb.rpc('leave_current_family');if(error)return showToast(error.message);currentFamily=null;currentMembership=null;await refreshFamilyContext();showToast('Você saiu da família.');};
deleteAccountBtn.onclick=()=>deleteAccountModal.classList.remove('hidden');
deleteAccountForm.onsubmit=async e=>{e.preventDefault();if(deleteAccountConfirm.value.trim()!=='EXCLUIR')return showToast('Digite EXCLUIR para confirmar.');if(!confirm('Excluir permanentemente sua conta?'))return;const {error}=await sb.rpc('delete_my_account');if(error)return showToast(error.message);try{await sb.auth.signOut()}catch{};deleteAccountModal.classList.add('hidden');authScreen.classList.remove('hidden');showToast('Conta excluída.');};
securityRefreshBtn.onclick=()=>renderSecurityCenter();

analyzeBtn.onclick=()=>generateInsights();
typeFilter.onchange=renderTransactions;
searchTransaction.oninput=renderTransactions;
transactionFrom.onchange=renderTransactions;
transactionTo.onchange=renderTransactions;
clearTransactionFilters.onclick=()=>{typeFilter.value='all';searchTransaction.value='';transactionFrom.value='';transactionTo.value='';renderTransactions();};
dashboardMonth.value=selectedMonth;
dashboardMonth.onchange=async ()=>{
  selectedMonth=dashboardMonth.value || new Date().toISOString().slice(0,7);
  renderAll();
  if(currentUser){
    const first=selectedMonth+'-01';
    await sb.from('user_settings').upsert({user_id:currentUser.id,dashboard_month:first},{onConflict:'user_id'});
  }
};


profileForm.onsubmit=async e=>{
  e.preventDefault();
  const name=profileName.value.trim();
  if(!name) return;
  const {error}=await sb.auth.updateUser({data:{name}});
  if(error) return showToast('Erro ao atualizar perfil: '+error.message);
  await sb.from('profiles').upsert({id:currentUser.id,name},{onConflict:'id'});
  currentUser.user_metadata={...(currentUser.user_metadata||{}),name};
  userBadge.textContent=name;
  showToast('Nome atualizado.');
};

preferencesForm.onsubmit=async e=>{
  e.preventDefault();
  const payload={user_id:currentUser.id,theme:themeSelect.value,notifications_enabled:notificationsEnabled.checked,font_scale:fontScaleSelect.value,reduced_motion:reducedMotionEnabled.checked,updated_at:new Date().toISOString()};
  const {error}=await sb.from('user_settings').upsert(payload,{onConflict:'user_id'});
  if(error) return showToast('Erro ao salvar preferências: '+error.message);
  userSettings={...userSettings,...payload};
  applyTheme(payload.theme);
  applyAccessibilityPreferences();
  showToast('Preferências salvas.');
  if(payload.notifications_enabled) scheduleLocalDueAlerts();
};

changePasswordBtn.onclick=()=>passwordModal.classList.remove('hidden');
passwordForm.onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target), p1=f.get('password'), p2=f.get('password2');
  if(p1!==p2) return showToast('As senhas não coincidem.');
  if(!passwordLooksStrong(p1)) return showToast('Use pelo menos 8 caracteres, incluindo letras e números.');
  const {error}=await sb.auth.updateUser({password:p1});
  if(error) return showToast('Erro ao alterar senha: '+error.message);
  e.target.reset(); passwordModal.classList.add('hidden'); showToast('Senha alterada com sucesso.');
};

exportBackupBtn.onclick=()=>{
  const backup={
    app:'SALDOFamília',version:9,exported_at:new Date().toISOString(),
    family:{id:currentFamily?.id,name:currentFamily?.name},
    data:{
      categories:state.categories,transactions:state.transactions,goals:state.goals,
      accounts:state.accounts,cards:state.cards,bills:state.bills,recurring:state.recurring,budgets:state.budgets
    }
  };
  downloadText(`saldofamilia-backup-${today()}.json`,JSON.stringify(backup,null,2));
};

exportCsvBtn.onclick=()=>{
  const headers=['data','tipo','descricao','categoria','conta','cartao','valor'];
  const lines=[headers.map(csvEscape).join(';')];
  state.transactions.forEach(t=>lines.push([
    t.date,t.type==='income'?'Receita':'Despesa',t.description,catName(t.category_id||t.category),
    accountName(t.account_id),cardName(t.credit_card_id),Number(t.amount).toFixed(2).replace('.',',')
  ].map(csvEscape).join(';')));
  downloadText(`saldofamilia-transacoes-${today()}.csv`,lines.join('\n'),'text/csv;charset=utf-8');
};

importBackupInput.onchange=async e=>{
  const file=e.target.files?.[0]; if(!file) return;
  if(!confirm('Importar este backup adicionará os registros à família atual. Continuar?')){e.target.value='';return;}
  try{
    const backup=JSON.parse(await file.text());
    if(backup.app!=='SALDOFamília' || !backup.data) throw new Error('Arquivo não reconhecido');
    const d=backup.data;
    const categoryMap={};
    for(const c of d.categories||[]){
      const {data,error}=await sb.from('categories').insert({family_id:currentFamily.id,user_id:currentUser.id,name:c.name,type:c.type,emoji:c.emoji||'🏷️'}).select('id').single();
      if(!error && data) categoryMap[c.id]=data.id;
    }
    const accountMap={};
    for(const a of d.accounts||[]){
      const {data,error}=await sb.from('accounts').insert({family_id:currentFamily.id,user_id:currentUser.id,name:a.name,type:a.type,initial_balance:a.initial_balance||0}).select('id').single();
      if(!error&&data) accountMap[a.id]=data.id;
    }
    const cardMap={};
    for(const c of d.cards||[]){
      const {data,error}=await sb.from('credit_cards').insert({family_id:currentFamily.id,user_id:currentUser.id,name:c.name,limit_amount:c.limit_amount||0,closing_day:c.closing_day||1,due_day:c.due_day||10}).select('id').single();
      if(!error&&data) cardMap[c.id]=data.id;
    }
    for(const g of d.goals||[]) await sb.from('goals').insert({family_id:currentFamily.id,user_id:currentUser.id,name:g.name,target:g.target,current:g.current||0});
    for(const t of d.transactions||[]) await sb.from('transactions').insert({
      family_id:currentFamily.id,user_id:currentUser.id,type:t.type,description:t.description,amount:t.amount,date:t.date,
      category_id:categoryMap[t.category_id||t.category]||null,account_id:accountMap[t.account_id]||null,credit_card_id:cardMap[t.credit_card_id]||null
    });
    for(const b of d.bills||[]) await sb.from('bills').insert({
      family_id:currentFamily.id,user_id:currentUser.id,type:b.type,description:b.description,amount:b.amount,due_date:b.due_date,status:b.status||'pending',
      category_id:categoryMap[b.category_id]||null,account_id:accountMap[b.account_id]||null,credit_card_id:cardMap[b.credit_card_id]||null
    });
    for(const b of d.budgets||[]) await sb.from('budgets').insert({family_id:currentFamily.id,user_id:currentUser.id,category_id:categoryMap[b.category_id]||null,month:b.month,amount:b.amount}).catch(()=>{});
    for(const r of d.recurring||[]) await sb.from('recurring_rules').insert({
      family_id:currentFamily.id,user_id:currentUser.id,type:r.type,description:r.description,amount:r.amount,frequency:r.frequency,next_date:r.next_date,active:r.active!==false,
      category_id:categoryMap[r.category_id]||null,account_id:accountMap[r.account_id]||null,credit_card_id:cardMap[r.credit_card_id]||null
    });
    await loadCloudData(); showToast('Backup importado.');
  }catch(err){showToast('Falha ao importar: '+err.message);}
  e.target.value='';
};

async function scheduleLocalDueAlerts(){
  if(!('Notification' in window)) return;
  let permission=Notification.permission;
  if(permission==='default') permission=await Notification.requestPermission();
  if(permission!=='granted') return;
  const soon=new Date(); soon.setDate(soon.getDate()+3);
  const soonStr=soon.toISOString().slice(0,10);
  const due=state.bills.filter(b=>billStatus(b)==='pending' && b.due_date<=soonStr);
  if(due.length){
    new Notification('SALDOFamília',{body:`Você tem ${due.length} conta(s) vencendo nos próximos 3 dias.`});
  }
}

function updateConnectionBadge(){
  const online=navigator.onLine;
  connectionBadge.textContent=online?'● Online':'● Offline';
  connectionBadge.classList.toggle('offline',!online);
}
window.addEventListener('online',updateConnectionBadge);
window.addEventListener('offline',updateConnectionBadge);
updateConnectionBadge();



openPublicTourBtn.onclick=()=>openTour();startTourBtn.onclick=()=>openTour();settingsTourBtn.onclick=()=>openTour();startSetupBtn.onclick=()=>openOnboarding();restartOnboardingBtn.onclick=()=>openOnboarding();closeOnboardingBtn.onclick=()=>onboardingModal.classList.add('hidden');closeTourBtn.onclick=()=>tourModal.classList.add('hidden');
onboardingBackBtn.onclick=()=>{if(onboardingState.step>0){onboardingState.step--;renderOnboarding();}};
onboardingNextBtn.onclick=async()=>{if(onboardingState.step===2){onboardingState.accountName=document.getElementById('onboardingAccountName')?.value||'';onboardingState.income=document.getElementById('onboardingIncome')?.value||'';}if(onboardingState.step<onboardingSteps.length-1){onboardingState.step++;renderOnboarding();}else await finishOnboarding();};
tourBackBtn.onclick=()=>{if(tourStep>0){tourStep--;renderTour();}};tourNextBtn.onclick=()=>{if(tourStep<tourSlides.length-1){tourStep++;renderTour();}else tourModal.classList.add('hidden');};
document.querySelectorAll('[data-mobile-view]').forEach(btn=>btn.onclick=()=>{showView(btn.dataset.mobileView);document.querySelectorAll('[data-mobile-view]').forEach(x=>x.classList.toggle('active',x===btn));document.getElementById('mainContent')?.focus({preventScroll:true});});mobileDockAdd.onclick=()=>openTransactionModal.click();

let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); deferredPrompt=e; installBtn.classList.remove('hidden');});
installBtn.onclick=async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.classList.add('hidden'); } };

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
}

sb.auth.onAuthStateChange(async (event, session)=>{
  if(event==='PASSWORD_RECOVERY'){
    passwordModal.classList.remove('hidden');
  }
  if(session && (!currentUser || currentUser.id !== session.user.id)){
    await bootForSession(session);
  }
  if(!session && event === 'SIGNED_OUT'){
    authScreen.classList.remove('hidden');
  }
});

(async function init(){
  setAuthMode('login');
  const {data:{session}} = await sb.auth.getSession();
  if(session) await bootForSession(session);
  else authScreen.classList.remove('hidden');
})();
