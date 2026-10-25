import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarCheck, CalendarDays, Check, Circle, Flag, LayoutDashboard, ListTodo, Plus, Target, TrendingUp, Trash2, Zap, LogOut, Timer, Play, Pause, RotateCcw, Gift, Trophy, Palette, UserRound, LockKeyhole, Sparkles } from 'lucide-react'

const API = import.meta.env.VITE_API_URL;
type Goal = { id:number; title:string; description?:string|null; category:string; target_date?:string|null; status:string }
type Task = { id:number; title:string; notes?:string|null; due_date:string; priority:string; estimated_minutes:number; completed:boolean; goal_id?:number|null }
type Milestone = { id:number; title:string; description?:string|null; due_date?:string|null; status:string; goal_id:number }
type User = { id:number; email:string; display_name:string }
type Reward = { id:number; period_type:'daily'|'weekly'; period_start:string; reward_text:string }
type Dashboard = { date:string; today_total:number; today_completed:number; today_completion_percent:number; active_goals:number; milestones_total:number; milestones_completed:number; overdue_tasks:number }

function todayString() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function weekStartString() { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function shiftDateString(value:string,days:number) { const d = new Date(value+'T12:00:00'); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
async function request<T>(path:string, options?:RequestInit):Promise<T> {
  const savedToken = sessionStorage.getItem('momentum_token')
  const authHeaders: Record<string,string> = { 'Content-Type':'application/json', ...(options?.headers as Record<string,string> || {}) }
  if (savedToken && path !== '/auth/login' && path !== '/auth/register') authHeaders.Authorization = `Bearer ${savedToken}`
  const response = await fetch(`${API}${path}`, { ...options, headers: authHeaders })
  if (!response.ok) { const detail = await response.text(); throw new Error(detail || `Request failed (${response.status})`) }
  if (response.status === 204) return undefined as T
  return response.json()
}

export default function App() {
  const [token,setToken] = useState(() => new URLSearchParams(window.location.search).has('reset_token') ? null : sessionStorage.getItem('momentum_token'))
  const [authMode,setAuthMode] = useState<'register'|'login'|'forgot'|'reset'>(() => new URLSearchParams(window.location.search).has('reset_token') ? 'reset' : 'register')
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token') || '')
  const [resetPassword,setResetPassword] = useState('')
  const [resetConfirm,setResetConfirm] = useState('')
  const [resetNotice,setResetNotice] = useState('')
  const [profileCurrentPassword,setProfileCurrentPassword] = useState('')
  const [profileNewPassword,setProfileNewPassword] = useState('')
  const [profileConfirmPassword,setProfileConfirmPassword] = useState('')
  const [profileNotice,setProfileNotice] = useState('')
  const [profileBusy,setProfileBusy] = useState(false)
  const [theme,setTheme] = useState(() => localStorage.getItem('aimit_theme') || 'linen')
  const [authEmail,setAuthEmail] = useState('')
  const [authPassword,setAuthPassword] = useState('')
  const [authName,setAuthName] = useState('')
  const [authBusy,setAuthBusy] = useState(false)
  const [tab,setTab] = useState('Overview')
  const [historyDate,setHistoryDate] = useState(() => { const d = new Date(); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
  const [goals,setGoals] = useState<Goal[]>([])
  const [tasks,setTasks] = useState<Task[]>([])
  const [milestones,setMilestones] = useState<Milestone[]>([])
  const [rewards,setRewards] = useState<Reward[]>([])
  const [dailyRewardText,setDailyRewardText] = useState('')
  const [weeklyRewardText,setWeeklyRewardText] = useState('')
  const [stopwatchSeconds,setStopwatchSeconds] = useState(0)
  const [stopwatchRunning,setStopwatchRunning] = useState(false)
  const [stats,setStats] = useState<Dashboard|null>(null)
  const [user,setUser] = useState<User|null>(null)
  const [editingTask,setEditingTask] = useState<Task|null>(null)
  const [error,setError] = useState('')
  const [showTask,setShowTask] = useState(false)
  const [showGoal,setShowGoal] = useState(false)
  const [showMilestone,setShowMilestone] = useState(false)
  const [taskTitle,setTaskTitle] = useState('')
  const [taskDate,setTaskDate] = useState(todayString())
  const [targetPlannerDate,setTargetPlannerDate] = useState(todayString())
  const [taskPriority,setTaskPriority] = useState('medium')
  const [taskMinutes,setTaskMinutes] = useState(30)
  const [taskGoal,setTaskGoal] = useState('')
  const [goalTitle,setGoalTitle] = useState('')
  const [goalCategory,setGoalCategory] = useState('Learning')
  const [goalDate,setGoalDate] = useState('')
  const [milestoneTitle,setMilestoneTitle] = useState('')
  const [milestoneGoal,setMilestoneGoal] = useState('')
  const [milestoneDate,setMilestoneDate] = useState('')

  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); setAuthBusy(true); setError('')
    try {
      const path = authMode === 'register' ? '/auth/register' : '/auth/login'
      const body = authMode === 'register' ? {email: authEmail, password: authPassword, display_name: authName} : {email: authEmail, password: authPassword}
      const result = await request<{access_token:string}>(path, {method:'POST', body:JSON.stringify(body)})
      sessionStorage.setItem('momentum_token', result.access_token); setToken(result.access_token)
    } catch (e:any) { setError(e.message || 'Could not authenticate') } finally { setAuthBusy(false) }
  }
  function signOut() { sessionStorage.removeItem('momentum_token'); setToken(null); setUserPlaceholder() }
  function setUserPlaceholder() { setGoals([]); setTasks([]); setMilestones([]); setRewards([]); setDailyRewardText(''); setWeeklyRewardText(''); setStopwatchRunning(false); setStopwatchSeconds(0); setStats(null); setUser(null); setEditingTask(null) }

  async function refresh() {
    try {
      const [g,t,m,s,u,r] = await Promise.all([request<Goal[]>('/goals'),request<Task[]>('/tasks'),request<Milestone[]>('/milestones'),request<Dashboard>('/dashboard'),request<User>('/auth/me'),request<Reward[]>('/rewards')])
      setGoals(g); setTasks(t); setMilestones(m); setStats(s); setUser(u); setRewards(r)
      const daily = r.find(item => item.period_type === 'daily' && item.period_start === todayString())
      const weekly = r.find(item => item.period_type === 'weekly' && item.period_start === weekStartString())
      setDailyRewardText(daily?.reward_text || ''); setWeeklyRewardText(weekly?.reward_text || ''); setError('')
    } catch { setError('Could not connect to the API. Start PostgreSQL and the FastAPI backend, then refresh this page.') }
  }
  useEffect(() => { if (token) void refresh() }, [token])
  useEffect(() => { localStorage.setItem('aimit_theme', theme) }, [theme])
  useEffect(() => { if (!stopwatchRunning) return; const timer = window.setInterval(() => setStopwatchSeconds(seconds => seconds + 1), 1000); return () => window.clearInterval(timer) }, [stopwatchRunning])
  const todaysTasks = useMemo(() => tasks.filter(t => t.due_date === todayString()), [tasks])
  const plannerTasks = useMemo(() => tasks.filter(t => t.due_date === targetPlannerDate).sort((a,b) => a.id-b.id), [tasks, targetPlannerDate])
  const plannerCompleted = plannerTasks.filter(t => t.completed).length
  const plannerCompletion = plannerTasks.length ? Math.round(plannerCompleted / plannerTasks.length * 100) : 0
  const historyTasks = useMemo(() => tasks.filter(t => t.due_date === historyDate).sort((a,b) => a.id-b.id), [tasks, historyDate])
  const historyCompleted = historyTasks.filter(t => t.completed).length
  const historyPercent = historyTasks.length ? Math.round(historyCompleted / historyTasks.length * 100) : 0
  const completedToday = todaysTasks.filter(t => t.completed).length
  const weekStart = weekStartString()
  const weekEnd = shiftDateString(weekStart, 6)
  const weeklyTasks = tasks.filter(t => t.due_date >= weekStart && t.due_date <= weekEnd)
  const weeklyCompleted = weeklyTasks.filter(t => t.completed).length
  const dailyReward = rewards.find(item => item.period_type === 'daily' && item.period_start === todayString())
  const weeklyReward = rewards.find(item => item.period_type === 'weekly' && item.period_start === weekStart)
  const dailyRewardEarned = todaysTasks.length > 0 && completedToday === todaysTasks.length
  const weeklyRewardEarned = weeklyTasks.length > 0 && weeklyCompleted === weeklyTasks.length
  const completion = todaysTasks.length ? Math.round(completedToday / todaysTasks.length * 100) : 0
  const upcoming = [...tasks].filter(t => !t.completed).sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,5)
  const goalName = (id:number) => goals.find(g=>g.id===id)?.title || 'Independent target'

  function openNewTask(goalId='') { setEditingTask(null); setTaskTitle(''); setTaskDate(tab === 'Daily targets' ? targetPlannerDate : todayString()); setTaskPriority('medium'); setTaskMinutes(30); setTaskGoal(goalId); setShowTask(true) }
  function openEditTask(task:Task) { setEditingTask(task); setTaskTitle(task.title); setTaskDate(task.due_date); setTaskPriority(task.priority); setTaskMinutes(task.estimated_minutes); setTaskGoal(task.goal_id ? String(task.goal_id) : ''); setShowTask(true) }
  async function addTask(e:React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    const body={title:taskTitle.trim(),due_date:taskDate,priority:taskPriority,estimated_minutes:taskMinutes,goal_id:taskGoal ? Number(taskGoal) : null}
    try { if(editingTask) await request(`/tasks/${editingTask.id}`,{method:'PATCH',body:JSON.stringify(body)}); else await request('/tasks',{method:'POST',body:JSON.stringify(body)}); setTaskTitle(''); setShowTask(false); setEditingTask(null); await refresh() } catch { setError('Could not save target changes. Check that the API is running and try again.') }
  }
  async function addGoal(e:React.FormEvent) {
    e.preventDefault()
    if (!goalTitle.trim()) return
    try { await request('/goals',{method:'POST',body:JSON.stringify({title:goalTitle,category:goalCategory,target_date:goalDate||null})}); setGoalTitle(''); setShowGoal(false); await refresh() } catch { setError('Could not save goal.') }
  }
  async function addMilestone(e:React.FormEvent) {
    e.preventDefault()
    if (!milestoneTitle.trim() || !milestoneGoal) return
    try { await request('/milestones',{method:'POST',body:JSON.stringify({title:milestoneTitle,goal_id:Number(milestoneGoal),due_date:milestoneDate||null})}); setMilestoneTitle(''); setShowMilestone(false); await refresh() } catch { setError('Could not save milestone. Choose a goal first.') }
  }
  async function toggleTask(id:number) { try { await request(`/tasks/${id}/toggle`,{method:'PATCH'}); await refresh() } catch { setError('Could not update task.') } }
  async function deleteTask(id:number) { if(!window.confirm('Delete this target? This cannot be undone.')) return; try { await request(`/tasks/${id}`,{method:'DELETE'}); await refresh() } catch { setError('Could not delete task.') } }
  async function deleteGoal(id:number,title:string) { if(!window.confirm(`Delete the goal “${title}”? Its milestones will also be deleted, and linked targets will become independent.`)) return; try { await request(`/goals/${id}`,{method:'DELETE'}); await refresh() } catch { setError('Could not delete goal.') } }
  async function updateMilestone(m:Milestone) { const status = m.status==='completed'?'in_progress':'completed'; try { await request(`/milestones/${m.id}`,{method:'PATCH',body:JSON.stringify({status})}); await refresh() } catch { setError('Could not update milestone.') } }
  async function saveReward(periodType:'daily'|'weekly', rewardText:string) {
    if (!rewardText.trim()) { setError('Enter a reward first, then save it.'); return }
    const periodStart = periodType === 'daily' ? todayString() : weekStartString()
    try {
      const saved = await request<Reward>(`/rewards/${periodType}/${periodStart}`, {method:'PUT', body:JSON.stringify({reward_text:rewardText.trim()})})
      setRewards(previous => [...previous.filter(item => !(item.period_type === saved.period_type && item.period_start === saved.period_start)), saved])
      if (periodType === 'daily') setDailyRewardText(saved.reward_text); else setWeeklyRewardText(saved.reward_text)
      setError('')
    } catch { setError('Could not save your reward. Please try again.') }
  }
  function formatStopwatch(total:number) { const hours = Math.floor(total/3600); const minutes = Math.floor((total%3600)/60); const seconds = total%60; return [hours,minutes,seconds].map(value => String(value).padStart(2,'0')).join(':') }
  async function requestPasswordReset(e:React.FormEvent) { e.preventDefault(); setAuthBusy(true); setError(''); setResetNotice(''); try { const result = await request<{message:string}>('/auth/forgot-password',{method:'POST',body:JSON.stringify({email:authEmail})}); setResetNotice(result.message) } catch (e:any) { setError(e.message || 'Could not send reset email.') } finally { setAuthBusy(false) } }
  async function submitPasswordReset(e:React.FormEvent) { e.preventDefault(); setError(''); setResetNotice(''); if (resetPassword !== resetConfirm) { setError('The passwords do not match.'); return } setAuthBusy(true); try { const result = await request<{message:string}>('/auth/reset-password',{method:'POST',body:JSON.stringify({token:resetToken,new_password:resetPassword})}); setResetNotice(result.message); setAuthMode('login'); setAuthPassword(''); setResetPassword(''); setResetConfirm(''); window.history.replaceState({},'',window.location.pathname) } catch (e:any) { setError(e.message || 'Could not reset password.') } finally { setAuthBusy(false) } }
  async function changeProfilePassword(e:React.FormEvent) { e.preventDefault(); setProfileNotice(''); if (profileNewPassword !== profileConfirmPassword) { setProfileNotice('The new passwords do not match.'); return } setProfileBusy(true); try { const result = await request<{message:string}>('/auth/change-password',{method:'POST',body:JSON.stringify({current_password:profileCurrentPassword,new_password:profileNewPassword})}); setProfileNotice(result.message); setProfileCurrentPassword(''); setProfileNewPassword(''); setProfileConfirmPassword('') } catch (e:any) { setProfileNotice(e.message || 'Could not change password.') } finally { setProfileBusy(false) } }


  if (!token) return <div className="auth-page"><section className="auth-visual"><div className="brand"><div className="brand-mark"><Zap size={20}/></div><div><strong>AimIt</strong><small>PROGRESS, ON PURPOSE</small></div></div><div className="auth-pitch"><span className="eyebrow lime">YOUR PROGRESS, YOUR RULES</span><h1>Make your plans<br/><em>mean something.</em></h1><p>Daily action, meaningful milestones, and progress you can actually see.</p></div><div className="auth-footer">Small steps. Real momentum.</div></section><section className="auth-form-wrap"><form className="auth-form" onSubmit={authMode==='forgot'?requestPasswordReset:authMode==='reset'?submitPasswordReset:authenticate}>
    <span className="eyebrow">{authMode==='forgot'?'ACCOUNT RECOVERY':authMode==='reset'?'CHOOSE A NEW PASSWORD':'WELCOME TO AIMIT'}</span>
    <h2>{authMode==='register'?'Create your workspace':authMode==='login'?'Welcome back':authMode==='forgot'?'Forgot your password?':'Reset your password'}</h2>
    <p>{authMode==='forgot'?'We will email a secure, one-time reset link to your registered address.':authMode==='reset'?'Choose a new password to get back to your goals.':'Your goals and targets stay private to your account.'}</p>
    {authMode==='register'&&<label>Your name<input value={authName} onChange={e=>setAuthName(e.target.value)} required maxLength={80} placeholder="Your name"/></label>}
    {(authMode==='register'||authMode==='login'||authMode==='forgot')&&<label>Email address<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} required placeholder="you@example.com"/></label>}
    {(authMode==='register'||authMode==='login')&&<label>Password<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required minLength={authMode==='register'?10:1} maxLength={128} placeholder={authMode==='register'?'At least 10 characters':'Your password'}/></label>}
    {authMode==='reset'&&<><label>New password<input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} required minLength={10} maxLength={128} placeholder="At least 10 characters"/></label><label>Confirm new password<input type="password" value={resetConfirm} onChange={e=>setResetConfirm(e.target.value)} required minLength={10} maxLength={128} placeholder="Enter it again"/></label></>}
    {error&&<div className="error-banner">{error}</div>}{resetNotice&&<div className="success-banner">{resetNotice}</div>}
    <button className="primary-button full" disabled={authBusy}>{authBusy?'Please wait…':authMode==='register'?'Create account':authMode==='login'?'Sign in':authMode==='forgot'?'Send reset link':'Update password'}</button>
    {authMode==='login'&&<button type="button" className="auth-text-link" onClick={()=>{setAuthMode('forgot');setError('');setResetNotice('')}}>Forgot password?</button>}
    <div className="auth-switch">{authMode==='register'?'Already have an account?':authMode==='login'?'New to AimIt?':'Remembered your password?'} <button type="button" onClick={()=>{setAuthMode('login');setError('');setResetNotice('')}}>{authMode==='register'?'Sign in':'Back to sign in'}</button></div>
    {authMode==='forgot'&&<button type="button" className="auth-text-link" onClick={()=>{setAuthMode('register');setError('');setResetNotice('')}}>Create a new account instead</button>}
  </form></section></div>

  return <div className={`app-shell theme-${theme}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Zap size={20} fill="currentColor"/></div><div><strong>AimIt</strong><small>PROGRESS, ON PURPOSE</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      {[['Overview',LayoutDashboard],['Daily targets',ListTodo],['Goals',Target],['Milestones',Flag],['Progress',TrendingUp],['Goal History',CalendarDays],['Profile',UserRound]].map(([name,Icon]:any)=><button key={name} className={`nav-item ${tab===name?'active':''}`} onClick={()=>setTab(name)}><Icon size={18}/><span>{name}</span>{name==='Daily targets'&&<span className="nav-count">{todaysTasks.length}</span>}</button>)}
      <div className="sidebar-bottom"><div className="focus-card"><div className="focus-icon"><Activity size={17}/></div><strong>Small steps count.</strong><p>Consistency beats intensity. Show up for today's version of you.</p></div><div className="profile"><div className="avatar">{(user?.display_name||user?.email||'U').charAt(0).toUpperCase()}</div><div><strong>{user?.display_name||'Your workspace'}</strong><small>{user?.email||'Personal dashboard'}</small></div><button className="icon-button" title="Sign out" onClick={signOut}><LogOut size={15}/></button><span className="online-dot"/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">YOUR PERSONAL COMMAND CENTER</div><h1>{tab==='Overview'?`Good progress starts today, ${user?.display_name?.trim().split(/\s+/)[0]||'there'}.`:tab==='Profile'?'Your account, your space.':tab}</h1><p className="date-line">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</p></div><button className="primary-button" onClick={()=>openNewTask()}><Plus size={17}/> Add a target</button></header>
      {error&&<div className="error-banner">{error}</div>}
      <div className="content">

        {tab==='Profile'&&<section className="profile-page">
          <article className="section-card account-card"><div className="profile-heading"><div className="profile-large-avatar">{(user?.display_name||'U').charAt(0).toUpperCase()}</div><div><div className="eyebrow">YOUR AIMIT ACCOUNT</div><h3>{user?.display_name||'Your profile'}</h3><p>{user?.email}</p></div></div><div className="account-details"><div><span>Display name</span><strong>{user?.display_name}</strong></div><div><span>Registered email</span><strong>{user?.email}</strong></div></div></article>
          <article className="section-card"><div className="section-head"><div><div className="eyebrow">KEEP YOUR ACCOUNT SECURE</div><h3><LockKeyhole size={18}/> Change password</h3></div></div><p className="tool-description">Use your current password to set a new one. At least 10 characters are required.</p><form className="profile-password-form" onSubmit={changeProfilePassword}><label>Current password<input type="password" value={profileCurrentPassword} onChange={e=>setProfileCurrentPassword(e.target.value)} minLength={1} maxLength={128} required autoComplete="current-password"/></label><label>New password<input type="password" value={profileNewPassword} onChange={e=>setProfileNewPassword(e.target.value)} minLength={10} maxLength={128} required autoComplete="new-password"/></label><label>Confirm new password<input type="password" value={profileConfirmPassword} onChange={e=>setProfileConfirmPassword(e.target.value)} minLength={10} maxLength={128} required autoComplete="new-password"/></label>{profileNotice&&<div className={profileNotice.includes('successfully')?'success-banner':'error-banner'}>{profileNotice}</div>}<button className="primary-button" disabled={profileBusy}><LockKeyhole size={15}/>{profileBusy?'Updating…':'Update password'}</button></form></article>
          <article className="section-card theme-section"><div className="section-head"><div><div className="eyebrow">MAKE THIS SPACE YOURS</div><h3><Palette size={18}/> Dashboard themes</h3></div><span className="soft-count">Saved on this device</span></div><p className="tool-description">Choose a calm color palette with gentle motion. No neon, no visual noise—just a workspace that feels like yours.</p><div className="theme-grid">
            {[{id:'linen',name:'Linen',desc:'Warm, quiet, minimal',colors:['#f6f4ef','#d9d1c3','#5f705b']},{id:'ocean',name:'Ocean mist',desc:'Cool blue, soft waves',colors:['#edf4f5','#b6d5dc','#4c7c88']},{id:'lavender',name:'Lavender hour',desc:'Gentle lilac tones',colors:['#f3f0f8','#d3c5e7','#8170a5']},{id:'sage',name:'Sage garden',desc:'Natural greens',colors:['#f0f3ed','#c5d5bb','#64805c']},{id:'terracotta',name:'Terracotta',desc:'Earthy clay and sand',colors:['#f7f0e9','#e4bca5','#a86448']},{id:'rosewater',name:'Rosewater',desc:'Muted rose and cream',colors:['#f8eff0','#e8c3ca','#ad6e7c']},{id:'midnight',name:'Midnight blue',desc:'Deep, calm contrast',colors:['#e9edf4','#aebed8','#526d98']}].map(item=><button type="button" key={item.id} className={`theme-option ${theme===item.id?'selected':''}`} onClick={()=>setTheme(item.id)} aria-pressed={theme===item.id}><span className="theme-swatches">{item.colors.map(color=><i key={color} style={{background:color}}/>)}</span><span className="theme-option-copy"><strong>{item.name}</strong><small>{item.desc}</small></span><span className="theme-selected-mark">{theme===item.id?<Check size={15}/>:null}</span></button>)}
          </div><div className="motion-note"><Sparkles size={16}/><span><strong>Subtle motion is on.</strong> The header illustration and color wash use slow, low-contrast animation. You can turn motion off in your device's reduced-motion accessibility setting.</span></div></article>
        </section>}

        {(tab==='Overview'||tab==='Progress')&&<><section className="welcome-panel"><div className="welcome-copy"><span className="pill"><Zap size={13}/> YOUR NEXT LEVEL STARTS HERE</span><h2>Make your plans<br/> <em>mean something.</em></h2><p>Progress isn't about doing everything. It's about doing the right things, consistently.</p><button className="light-button" onClick={()=>setShowGoal(true)}>Define a goal <span>↗</span></button></div><div className="orbit-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-center"><Target size={34}/></div><div className="orbit-dot dot-one"/><div className="orbit-dot dot-two"/><div className="orbit-dot dot-three"/></div><div className="panel-watermark">M.</div></section>
        <section className="stats-grid"><Stat icon={<CalendarCheck/>} label="Today's targets" value={String(todaysTasks.length)} note={`${completedToday} completed`} tone="purple"/><Stat icon={<TrendingUp/>} label="Today's progress" value={`${completion}%`} note={completion===100&&todaysTasks.length?'All targets complete':`${todaysTasks.length-completedToday} left to go`} tone="green"/><Stat icon={<Target/>} label="Active goals" value={String(goals.filter(g=>g.status==='active').length)} note="Keep the bigger picture" tone="orange"/><Stat icon={<Flag/>} label="Milestones reached" value={`${milestones.filter(m=>m.status==='completed').length}/${milestones.length}`} note="Every step moves you forward" tone="blue"/></section>
        <section className="dashboard-tools-grid">
          <article className="section-card stopwatch-card"><div className="section-head"><div><div className="eyebrow">FOCUS SESSION</div><h3><Timer size={18}/> Stopwatch</h3></div><span className="soft-count">Session timer</span></div><div className="stopwatch-display" aria-live="polite">{formatStopwatch(stopwatchSeconds)}</div><p className="tool-description">Time a study sprint, coding session, or focused break.</p><div className="stopwatch-actions"><button className="primary-button" onClick={()=>setStopwatchRunning(value=>!value)}>{stopwatchRunning?<Pause size={15}/>:<Play size={15}/>} {stopwatchRunning?'Pause':'Start'}</button><button className="cancel-button" onClick={()=>{setStopwatchRunning(false);setStopwatchSeconds(0)}}><RotateCcw size={14}/> Reset</button></div></article>
          <article className="section-card rewards-card"><div className="section-head"><div><div className="eyebrow">MAKE THE EFFORT FEEL WORTH IT</div><h3><Gift size={18}/> Personal rewards</h3></div></div><p className="tool-description">Choose something kind for yourself when you finish your targets. Your rewards are saved to your account.</p>
            <div className="reward-block"><div className="reward-block-head"><strong><CalendarCheck size={15}/> Daily reward</strong><span className={dailyRewardEarned?'reward-earned':'reward-progress'}>{dailyRewardEarned?'Earned today':`${completedToday}/${todaysTasks.length} done`}</span></div><form className="reward-form" onSubmit={e=>{e.preventDefault();void saveReward('daily',dailyRewardText)}}><input value={dailyRewardText} onChange={e=>setDailyRewardText(e.target.value)} maxLength={240} placeholder="e.g. Watch one episode guilt-free" aria-label="Your daily reward"/><button className="primary-button" type="submit">Save</button></form>{dailyRewardEarned&&dailyReward&&<p className="reward-unlocked"><Trophy size={15}/> You earned it: {dailyReward.reward_text}</p>}{!todaysTasks.length&&<p className="reward-hint">Add at least one target for today to unlock this reward.</p>}</div>
            <div className="reward-block"><div className="reward-block-head"><strong><CalendarDays size={15}/> Weekly reward</strong><small className="reward-hint">{new Date(weekStart+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})} – {new Date(weekEnd+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small><span className={weeklyRewardEarned?'reward-earned':'reward-progress'}>{weeklyRewardEarned?'Earned this week':`${weeklyCompleted}/${weeklyTasks.length} done`}</span></div><form className="reward-form" onSubmit={e=>{e.preventDefault();void saveReward('weekly',weeklyRewardText)}}><input value={weeklyRewardText} onChange={e=>setWeeklyRewardText(e.target.value)} maxLength={240} placeholder="e.g. Take a relaxed half-day off" aria-label="Your weekly reward"/><button className="primary-button" type="submit">Save</button></form>{weeklyRewardEarned&&weeklyReward&&<p className="reward-unlocked"><Trophy size={15}/> You earned it: {weeklyReward.reward_text}</p>}{!weeklyTasks.length&&<p className="reward-hint">Schedule targets this week to unlock the weekly reward.</p>}</div>
          </article>
        </section>
        </>}
        {(tab==='Overview'||tab==='Daily targets')&&<section className="section-card"><div className="section-head"><div><div className="eyebrow">{tab==='Daily targets'?'PLAN AHEAD':'ONE DAY AT A TIME'}</div><h3>{tab==='Daily targets'?(targetPlannerDate===todayString()?"Today's targets":`Targets for ${new Date(targetPlannerDate+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}`):"Today's targets"} <span className="soft-count">{tab==='Daily targets'?plannerTasks.length:todaysTasks.length}</span></h3></div>{tab==='Daily targets'&&<label className="history-date-label">Plan for date<input type="date" value={targetPlannerDate} onChange={e=>setTargetPlannerDate(e.target.value)}/></label>}<button className="text-button" onClick={()=>openNewTask()}><Plus size={16}/> New target</button></div><div className="progress-line"><div><span>{tab==='Daily targets'?'Selected-day completion':'Daily completion'}</span><strong>{tab==='Daily targets'?plannerCompletion:completion}%</strong></div><div className="track"><span style={{width:`${tab==='Daily targets'?plannerCompletion:completion}%`}}/></div></div>{(tab==='Daily targets'?plannerTasks:todaysTasks).length===0?<Empty title={tab==='Daily targets'&&targetPlannerDate!==todayString()?"A day ready for a plan.":"A fresh page."} text={tab==='Daily targets'&&targetPlannerDate!==todayString()?"Add a target for this date. It will appear here and in your upcoming plan.":"Add your first target for today and make it count."} action={()=>openNewTask()}/>:<div className="task-list">{(tab==='Daily targets'?plannerTasks:todaysTasks).map(t=><TaskRow key={t.id} task={t} goalName={t.goal_id?goalName(t.goal_id):'Independent target'} onToggle={()=>void toggleTask(t.id)} onDelete={()=>void deleteTask(t.id)} onEdit={()=>openEditTask(t)}/>)}</div>}</section>}
        {(tab==='Overview'||tab==='Goals')&&<section className="section-card"><div className="section-head"><div><div className="eyebrow">THINK BEYOND TODAY</div><h3>Your goals</h3></div><button className="text-button" onClick={()=>setShowGoal(true)}><Plus size={16}/> New goal</button></div>{goals.length===0?<Empty title="Give your effort a direction." text="Create a goal, then connect daily targets and milestones to it." action={()=>setShowGoal(true)}/>:<div className="goal-grid">{goals.map(g=>{const related=tasks.filter(t=>t.goal_id===g.id);const done=related.filter(t=>t.completed).length;const pct=related.length?Math.round(done/related.length*100):0;return <article className="goal-card" key={g.id}><div className="goal-card-top"><span className="category-tag">{g.category}</span><span className={`status-dot ${g.status}`}/></div><div className="goal-title-row"><h4>{g.title}</h4><button className="icon-button delete-button" title={`Delete goal ${g.title}`} aria-label={`Delete goal ${g.title}`} onClick={()=>void deleteGoal(g.id,g.title)}><Trash2 size={15}/></button></div><p>{g.target_date?`Target date · ${g.target_date}`:'No target date set'}</p><div className="goal-progress-label"><span>{done} of {related.length} linked targets done</span><strong>{pct}%</strong></div><div className="track"><span style={{width:`${pct}%`}}/></div><button className="subtle-button" onClick={()=>openNewTask(String(g.id))}><Plus size={14}/> Add related target</button></article>})}</div>}</section>}
        {(tab==='Overview'||tab==='Milestones')&&<section className="section-card"><div className="section-head"><div><div className="eyebrow">PROOF OF PROGRESS</div><h3>Milestones</h3></div><button className="text-button" onClick={()=>setShowMilestone(true)}><Plus size={16}/> Add milestone</button></div>{milestones.length===0?<Empty title="Big goals, smaller wins." text="Milestones turn an ambitious goal into visible checkpoints." action={()=>setShowMilestone(true)}/>:<div className="milestone-list">{milestones.map(m=><div className="milestone-row" key={m.id}><button className={`milestone-check ${m.status==='completed'?'done':''}`} onClick={()=>void updateMilestone(m)}>{m.status==='completed'?<Check size={15}/>:<Circle size={15}/>}</button><div className="milestone-info"><strong className={m.status==='completed'?'completed-text':''}>{m.title}</strong><span>{goalName(m.goal_id)}{m.due_date?` · Due ${m.due_date}`:''}</span></div><span className={`milestone-status ${m.status}`}>{m.status.replace('_',' ')}</span></div>)}</div>}</section>}
        {(tab==='Overview'||tab==='Progress')&&<section className="section-card"><div className="section-head"><div><div className="eyebrow">KEEP THE MOMENTUM</div><h3>Coming up next</h3></div><button className="text-button" onClick={()=>setTab('Daily targets')}>View all targets ↗</button></div>{upcoming.length===0?<Empty title="Nothing hanging over you." text="Add targets when you're ready to plan your next move." action={()=>setShowTask(true)}/>:<div className="task-list">{upcoming.map(t=><TaskRow key={t.id} task={t} goalName={t.goal_id?goalName(t.goal_id):'Independent target'} onToggle={()=>void toggleTask(t.id)} onDelete={()=>void deleteTask(t.id)} onEdit={()=>openEditTask(t)}/>)}</div>}</section>}
      </div>
      {tab==='Goal History'&&<section className="section-card history-card"><div className="section-head"><div><div className="eyebrow">LOOK BACK, LEARN, MOVE FORWARD</div><h3>Daily target history</h3></div><label className="history-date-label">Choose a day<input type="date" value={historyDate} max={todayString()} onChange={e=>setHistoryDate(e.target.value)}/></label></div><p className="history-description">Review the targets scheduled for any past day. Your saved targets stay here even after the day has passed.</p><div className="history-summary"><div><span>Targets planned</span><strong>{historyTasks.length}</strong></div><div><span>Currently completed</span><strong>{historyCompleted}</strong></div><div><span>Completion rate</span><strong>{historyPercent}%</strong></div></div>{historyTasks.length===0?<div className="history-empty"><CalendarDays size={25}/><strong>No targets found for this day</strong><p>Try another date. Targets are grouped by their scheduled date.</p></div>:<div className="task-list">{historyTasks.map(t=><div className={`task-row ${t.completed?'task-done':''}`} key={t.id}><span className={`history-status ${t.completed?'is-done':''}`}>{t.completed?<Check size={14}/>:<Circle size={13}/>}</span><div className="task-main"><strong>{t.title}</strong><span>{t.goal_id?goalName(t.goal_id):'Independent target'} <i>·</i> {t.estimated_minutes} min</span></div><span className={`priority ${t.priority}`}>{t.priority}</span><span className={`history-state ${t.completed?'is-done':''}`}>{t.completed?'Completed':'Not completed'}</span></div>)}</div>}<p className="history-note">Status reflects each target's current saved state, not a time-stamped snapshot of how it stood at the end of that day.</p></section>}
      <footer>Built for progress, not perfection <span>·</span> AimIt</footer>
    </main>
    {showTask&&<Modal title={editingTask?"Edit target":"Add a daily target"} close={()=>{setShowTask(false);setEditingTask(null)}}><form onSubmit={addTask} className="form-stack"><label>What do you want to accomplish?<input autoFocus value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="e.g. Solve 5 DSA problems" required/></label><div className="form-row"><label>Target date<input type="date" value={taskDate} onChange={e=>setTaskDate(e.target.value)} required/></label><label>Estimated minutes<input type="number" min="1" max="1440" value={taskMinutes} onChange={e=>setTaskMinutes(Number(e.target.value))}/></label></div><div className="form-row"><label>Priority<select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Link to goal<select value={taskGoal} onChange={e=>setTaskGoal(e.target.value)}><option value="">Independent target</option>{goals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={()=>{setShowTask(false);setEditingTask(null)}}>Cancel</button><button className="primary-button" type="submit">{editingTask?<Check size={16}/>:<Plus size={16}/>} {editingTask?"Save changes":"Save target"}</button></div></form></Modal>}
    {showGoal&&<Modal title="Create a goal" close={()=>setShowGoal(false)}><form onSubmit={addGoal} className="form-stack"><label>Goal title<input autoFocus value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} placeholder="e.g. Become confident in DSA" required/></label><div className="form-row"><label>Category<select value={goalCategory} onChange={e=>setGoalCategory(e.target.value)}>{['Learning','Career','Health','Personal','Project','Other'].map(c=><option key={c}>{c}</option>)}</select></label><label>Target date<input type="date" value={goalDate} onChange={e=>setGoalDate(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={()=>setShowGoal(false)}>Cancel</button><button className="primary-button" type="submit"><Target size={16}/> Create goal</button></div></form></Modal>}
    {showMilestone&&<Modal title="Set a milestone" close={()=>setShowMilestone(false)}><form onSubmit={addMilestone} className="form-stack"><label>Milestone title<input autoFocus value={milestoneTitle} onChange={e=>setMilestoneTitle(e.target.value)} placeholder="e.g. Finish DBMS fundamentals" required/></label><label>Belongs to goal<select value={milestoneGoal} onChange={e=>setMilestoneGoal(e.target.value)} required><option value="">Choose a goal</option>{goals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label><label>Due date<input type="date" value={milestoneDate} onChange={e=>setMilestoneDate(e.target.value)}/></label>{goals.length===0&&<p className="form-hint">Create a goal first, then add milestones to it.</p>}<div className="modal-actions"><button type="button" className="cancel-button" onClick={()=>setShowMilestone(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!goals.length}><Flag size={16}/> Save milestone</button></div></form></Modal>}
  </div>
}

function Stat({icon,label,value,note,tone}:{icon:React.ReactNode;label:string;value:string;note:string;tone:string}) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></div> }
function TaskRow({task,goalName,onToggle,onDelete,onEdit}:{task:Task;goalName:string;onToggle:()=>void;onDelete:()=>void;onEdit:()=>void}) { return <div className={`task-row ${task.completed?'task-done':''}`}><button className={`task-check ${task.completed?'checked':''}`} onClick={onToggle} aria-label={task.completed?'Reopen task':'Complete task'}>{task.completed?<Check size={15}/>:null}</button><div className="task-main"><strong>{task.title}</strong><span>{goalName} <i>·</i> {task.due_date} <i>·</i> {task.estimated_minutes} min</span></div><span className={`priority ${task.priority}`}>{task.priority}</span><button className="icon-button edit-button" title="Edit target" aria-label="Edit target" onClick={onEdit}><Activity size={15}/></button><button className="icon-button delete-button" title="Delete target" onClick={onDelete}><Trash2 size={15}/></button></div> }
function Empty({title,text,action}:{title:string;text:string;action:()=>void}) { return <div className="empty-state"><div className="empty-icon"><Target size={21}/></div><strong>{title}</strong><p>{text}</p><button className="text-button" onClick={action}><Plus size={15}/> Add one now</button></div> }
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal"><div className="modal-header"><h3>{title}</h3><button className="close-button" onClick={close}>×</button></div>{children}</div></div> }
