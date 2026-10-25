import os
import hashlib
import secrets
import json
from html import escape
from urllib.parse import quote
from urllib.request import Request as URLRequest, urlopen
from urllib.error import HTTPError, URLError
from datetime import date, datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from .database import Base, engine, get_db
from . import models, schemas
from .security import hash_password, verify_password, create_access_token, current_user
if os.getenv("JWT_SECRET", "unsafe-development-secret-change-me")=="unsafe-development-secret-change-me": print("WARNING: Set JWT_SECRET in backend/.env before using real accounts.")
Base.metadata.create_all(bind=engine)
app=FastAPI(title="Momentum API",version="0.3.0")
# Authlib uses a signed session only to protect the OAuth state/CSRF round-trip.
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET", os.getenv("JWT_SECRET", "unsafe-development-secret-change-me")), same_site="lax", https_only=os.getenv("APP_ENV", "production") == "production")
oauth=OAuth()
GOOGLE_CLIENT_ID=os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET=os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI=os.getenv("GOOGLE_REDIRECT_URI", "https://aimit-t4ce.onrender.com/auth/google/callback")
FRONTEND_URL=os.getenv("FRONTEND_URL", "https://aim-it-six.vercel.app").rstrip("/")
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:5173","http://127.0.0.1:5173","https://aim-it-six.vercel.app"],allow_credentials=True,allow_methods=["GET","POST","PUT","PATCH","DELETE"],allow_headers=["Authorization","Content-Type"])
@app.get("/auth/google/login")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(503, "Google sign-in is not configured yet.")
    return await oauth.google.authorize_redirect(request, GOOGLE_REDIRECT_URI)

@app.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(503, "Google sign-in is not configured yet.")
    try:
        token = await oauth.google.authorize_access_token(request)
        profile = token.get("userinfo")
        if not profile:
            profile = await oauth.google.parse_id_token(request, token)
        email = str(profile.get("email", "")).strip().lower()
        if not email or profile.get("email_verified") is not True:
            raise HTTPException(400, "Google did not provide a verified email address.")
        display_name = str(profile.get("name") or email.split("@")[0]).strip()[:80] or email.split("@")[0]
        user = db.scalar(select(models.User).where(models.User.email == email))
        if not user:
            # Keep the existing non-null password schema compatible with Google-only accounts.
            user = models.User(email=email, password_hash=hash_password(secrets.token_urlsafe(48)), display_name=display_name)
            db.add(user)
            try:
                db.commit()
            except Exception:
                db.rollback()
                # Handle simultaneous first-time sign-ins for the same Google email.
                user = db.scalar(select(models.User).where(models.User.email == email))
                if not user:
                    raise
            if user:
                db.refresh(user)
        access_token = create_access_token(user.id)
        return RedirectResponse(f"{FRONTEND_URL}/#oauth_token={quote(access_token)}", status_code=302)
    except HTTPException:
        raise
    except Exception:
        return RedirectResponse(f"{FRONTEND_URL}/?oauth_error=google_signin_failed", status_code=302)

@app.get("/health")
def health(): return {"status":"ok"}
@app.post("/auth/register",response_model=schemas.TokenOut,status_code=201)
def register(payload:schemas.RegisterIn,db:Session=Depends(get_db)):
    email=str(payload.email).lower()
    if db.scalar(select(models.User).where(models.User.email==email)): raise HTTPException(409,"An account with this email already exists")
    user=models.User(email=email,password_hash=hash_password(payload.password),display_name=payload.display_name.strip())
    db.add(user)
    try: db.commit()
    except Exception: db.rollback(); raise HTTPException(409,"Could not create account; check whether the email is already registered")
    db.refresh(user); return {"access_token":create_access_token(user.id),"user":user}
@app.post("/auth/login",response_model=schemas.TokenOut)
def login(payload:schemas.LoginIn,db:Session=Depends(get_db)):
    user=db.scalar(select(models.User).where(models.User.email==str(payload.email).lower()))
    if not user or not verify_password(payload.password,user.password_hash): raise HTTPException(401,"Email or password is incorrect")
    return {"access_token":create_access_token(user.id),"user":user}
@app.get("/auth/me",response_model=schemas.UserOut)
def me(user:models.User=Depends(current_user)): return user

@app.delete("/auth/account", status_code=204)
def delete_account(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    # Explicitly remove child rows first as well as using FK cascades. This also
    # cleans up accounts created before database constraints were updated.
    db.query(models.CompletionEvent).filter(models.CompletionEvent.user_id == user.id).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.user_id == user.id).delete(synchronize_session=False)
    db.query(models.Milestone).filter(models.Milestone.user_id == user.id).delete(synchronize_session=False)
    db.query(models.Reward).filter(models.Reward.user_id == user.id).delete(synchronize_session=False)
    db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user.id).delete(synchronize_session=False)
    db.query(models.Goal).filter(models.Goal.user_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    return Response(status_code=204)

@app.post("/auth/forgot-password")
def forgot_password(payload: schemas.ForgotPasswordIn, db: Session = Depends(get_db)):
    mail_api_url = os.getenv("MAIL_API_URL")
    mail_api_secret = os.getenv("MAIL_API_SECRET")
    if not mail_api_url or not mail_api_secret:
        raise HTTPException(503, "Password reset email is not configured yet. Please contact the site administrator.")

    email = str(payload.email).lower()
    user = db.scalar(select(models.User).where(models.User.email == email))
    if not user:
        return {"message": "If an account exists for that email, reset instructions will be sent."}

    now = datetime.utcnow()
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now})

    raw_token = secrets.token_urlsafe(40)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    db.add(models.PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=now + timedelta(minutes=30),
    ))
    db.flush()

    frontend_url = os.getenv("FRONTEND_URL", "https://aim-it-six.vercel.app").rstrip("/")
    reset_url = f"{frontend_url}/?reset_token={quote(raw_token)}"
    display_name = escape(user.display_name or "there")
    reset_url_html = escape(reset_url, quote=True)
    email_payload = {
        "secret": mail_api_secret,
        "to": email,
        "subject": "Reset your AimIt password",
        "text": (
            f"Hello {user.display_name or 'there'},\n\n"
            "We received a request to reset your AimIt password. "
            "Use the one-time link below within 30 minutes:\n\n"
            f"{reset_url}\n\n"
            "If you did not request this, you can ignore this email."
        ),
        "html": (
            "<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#24302b;line-height:1.6\">"
            "<h2 style=\"color:#466b58\">Reset your AimIt password</h2>"
            f"<p>Hello {display_name},</p>"
            "<p>We received a request to reset your password. This link expires in 30 minutes.</p>"
            f"<p><a href=\"{reset_url_html}\" style=\"display:inline-block;padding:12px 20px;background:#466b58;color:#fff;text-decoration:none;border-radius:8px\">Reset password</a></p>"
            "<p>If the button does not work, copy this link into your browser:</p>"
            f"<p><a href=\"{reset_url_html}\">{reset_url_html}</a></p>"
            "<p>If you did not request a password reset, you can safely ignore this email.</p>"
            "<p>— AimIt</p></div>"
        ),
    }
    request = URLRequest(
        mail_api_url,
        data=json.dumps(email_payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "AimIt/1.0"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=25) as response:
            response_body = response.read().decode("utf-8", errors="replace")
            if response.status < 200 or response.status >= 300:
                raise RuntimeError("Email relay rejected the request")
            try:
                relay_result = json.loads(response_body)
                if relay_result.get("ok") is False:
                    raise RuntimeError("Email relay could not send the message")
            except json.JSONDecodeError:
                raise RuntimeError("Email relay returned an unexpected response")
        db.commit()
    except (HTTPError, URLError, TimeoutError, RuntimeError, ValueError):
        db.rollback()
        raise HTTPException(502, "Could not send the reset email. Check the email relay configuration and try again.")
    except Exception:
        db.rollback()
        raise HTTPException(502, "Could not send the reset email. Please try again later.")

    return {"message": "If an account exists for that email, reset instructions will be sent."}

@app.post("/auth/reset-password")
def reset_password(payload: schemas.ResetPasswordIn, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    reset = db.scalar(select(models.PasswordResetToken).where(models.PasswordResetToken.token_hash == token_hash, models.PasswordResetToken.used_at.is_(None)))
    now = datetime.utcnow()
    if not reset or reset.expires_at < now:
        raise HTTPException(400, "This reset link is invalid or has expired. Request a new one.")
    user = db.get(models.User, reset.user_id)
    if not user:
        raise HTTPException(400, "This reset link is invalid or has expired. Request a new one.")
    user.password_hash = hash_password(payload.new_password)
    reset.used_at = now
    db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user.id, models.PasswordResetToken.id != reset.id, models.PasswordResetToken.used_at.is_(None)).update({"used_at": now})
    db.commit()
    return {"message": "Password updated. You can now sign in."}

@app.post("/auth/change-password")
def change_password(payload: schemas.ChangePasswordIn, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(400, "Choose a new password different from your current one.")
    user.password_hash = hash_password(payload.new_password)
    db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user.id, models.PasswordResetToken.used_at.is_(None)).update({"used_at": datetime.utcnow()})
    db.commit()
    return {"message": "Password changed successfully."}

@app.get("/goals",response_model=list[schemas.GoalOut])
def list_goals(db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    return db.scalars(select(models.Goal).where(models.Goal.user_id==user.id).order_by(models.Goal.created_at.desc())).all()
@app.post("/goals",response_model=schemas.GoalOut,status_code=201)
def create_goal(payload:schemas.GoalCreate,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    goal=models.Goal(**payload.model_dump(),user_id=user.id); db.add(goal); db.commit(); db.refresh(goal); return goal
@app.delete("/goals/{goal_id}",status_code=204)
def delete_goal(goal_id:int,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    goal=db.scalar(select(models.Goal).where(models.Goal.id==goal_id,models.Goal.user_id==user.id))
    if not goal: raise HTTPException(404,"Goal not found")
    db.delete(goal); db.commit(); return Response(status_code=204)
@app.patch("/goals/{goal_id}/complete",response_model=schemas.GoalOut)
def complete_goal(goal_id:int,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    goal=db.scalar(select(models.Goal).where(models.Goal.id==goal_id,models.Goal.user_id==user.id))
    if not goal: raise HTTPException(404,"Goal not found")
    goal.status="completed" if goal.status!="completed" else "active"; db.commit(); db.refresh(goal); return goal
@app.get("/tasks",response_model=list[schemas.TaskOut])
def list_tasks(day:date|None=None,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    q=select(models.Task).where(models.Task.user_id==user.id).order_by(models.Task.due_date,models.Task.id)
    if day: q=q.where(models.Task.due_date==day)
    return db.scalars(q).all()
@app.post("/tasks",response_model=schemas.TaskOut,status_code=201)
def create_task(payload:schemas.TaskCreate,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    data=payload.model_dump()
    if data["priority"] not in {"low","medium","high"}: raise HTTPException(422,"Priority must be low, medium, or high")
    if data["goal_id"] is not None and not db.scalar(select(models.Goal).where(models.Goal.id==data["goal_id"],models.Goal.user_id==user.id)): raise HTTPException(404,"Goal not found")
    task=models.Task(**data,user_id=user.id); db.add(task); db.commit(); db.refresh(task); return task
@app.patch("/tasks/{task_id}",response_model=schemas.TaskOut)
def update_task(task_id:int,payload:schemas.TaskUpdate,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    task=db.scalar(select(models.Task).where(models.Task.id==task_id,models.Task.user_id==user.id))
    if not task: raise HTTPException(404,"Task not found")
    data=payload.model_dump(exclude_unset=True)
    if "priority" in data and data["priority"] not in {"low","medium","high"}: raise HTTPException(422,"Priority must be low, medium, or high")
    if "goal_id" in data and data["goal_id"] is not None and not db.scalar(select(models.Goal).where(models.Goal.id==data["goal_id"],models.Goal.user_id==user.id)): raise HTTPException(404,"Goal not found")
    for key,value in data.items(): setattr(task,key,value)
    db.commit(); db.refresh(task); return task
@app.patch("/tasks/{task_id}/toggle",response_model=schemas.TaskOut)
def toggle_task(task_id:int,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    task=db.scalar(select(models.Task).where(models.Task.id==task_id,models.Task.user_id==user.id))
    if not task: raise HTTPException(404,"Task not found")
    task.completed=not task.completed; task.completed_at=datetime.utcnow() if task.completed else None
    db.add(models.CompletionEvent(user_id=user.id,task_id=task.id,completed=task.completed)); db.commit(); db.refresh(task); return task
@app.delete("/tasks/{task_id}",status_code=204)
def delete_task(task_id:int,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    task=db.scalar(select(models.Task).where(models.Task.id==task_id,models.Task.user_id==user.id))
    if not task: raise HTTPException(404,"Task not found")
    db.delete(task); db.commit(); return Response(status_code=204)
@app.get("/milestones",response_model=list[schemas.MilestoneOut])
def list_milestones(db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    return db.scalars(select(models.Milestone).where(models.Milestone.user_id==user.id).order_by(models.Milestone.due_date,models.Milestone.id)).all()
@app.post("/milestones",response_model=schemas.MilestoneOut,status_code=201)
def create_milestone(payload:schemas.MilestoneCreate,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    if not db.scalar(select(models.Goal).where(models.Goal.id==payload.goal_id,models.Goal.user_id==user.id)): raise HTTPException(404,"Goal not found")
    item=models.Milestone(**payload.model_dump(),user_id=user.id); db.add(item); db.commit(); db.refresh(item); return item
@app.patch("/milestones/{milestone_id}",response_model=schemas.MilestoneOut)
def update_milestone(milestone_id:int,payload:schemas.MilestoneUpdate,db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    if payload.status not in {"not_started","in_progress","completed","blocked"}: raise HTTPException(422,"Invalid milestone status")
    item=db.scalar(select(models.Milestone).where(models.Milestone.id==milestone_id,models.Milestone.user_id==user.id))
    if not item: raise HTTPException(404,"Milestone not found")
    item.status=payload.status; db.commit(); db.refresh(item); return item
@app.get("/dashboard")
def dashboard(db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    today=date.today(); tasks=db.scalars(select(models.Task).where(models.Task.user_id==user.id,models.Task.due_date==today)).all()
    active=db.scalar(select(func.count()).select_from(models.Goal).where(models.Goal.user_id==user.id,models.Goal.status=="active")) or 0
    milestones=db.scalars(select(models.Milestone).where(models.Milestone.user_id==user.id)).all(); done=sum(t.completed for t in tasks)
    overdue=db.scalar(select(func.count()).select_from(models.Task).where(models.Task.user_id==user.id,models.Task.due_date<today,models.Task.completed.is_(False))) or 0
    return {"date":today.isoformat(),"today_total":len(tasks),"today_completed":done,"today_completion_percent":round(done/len(tasks)*100) if tasks else 0,"active_goals":active,"milestones_total":len(milestones),"milestones_completed":sum(m.status=="completed" for m in milestones),"overdue_tasks":overdue}
@app.get("/analytics")
def analytics(db:Session=Depends(get_db),user:models.User=Depends(current_user)):
    start=date.today()-timedelta(days=13); events=db.scalars(select(models.CompletionEvent).where(models.CompletionEvent.user_id==user.id,models.CompletionEvent.occurred_at>=datetime.combine(start,datetime.min.time())).order_by(models.CompletionEvent.occurred_at)).all()
    daily={ (start+timedelta(days=i)).isoformat():{"date":(start+timedelta(days=i)).isoformat(),"completed":0,"reopened":0} for i in range(14)}
    for e in events:
        k=e.occurred_at.date().isoformat()
        if k in daily: daily[k]["completed" if e.completed else "reopened"]+=1
    tasks=db.scalars(select(models.Task).where(models.Task.user_id==user.id)).all(); done=sum(t.completed for t in tasks)
    return {"last_14_days":list(daily.values()),"all_time_tasks":len(tasks),"currently_completed_tasks":done,"all_time_completion_percent":round(done/len(tasks)*100) if tasks else 0,"overdue_open_tasks":sum(not t.completed and t.due_date<date.today() for t in tasks),"recommendations":["Choose three must-win targets before optional tasks.","Split repeatedly postponed tasks into smaller actions.","Connect daily targets to a goal to see why the work matters."]}


@app.get("/rewards", response_model=list[schemas.RewardOut])
def list_rewards(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return db.scalars(select(models.Reward).where(models.Reward.user_id == user.id).order_by(models.Reward.period_start.desc())).all()

@app.put("/rewards/{period_type}/{period_start}", response_model=schemas.RewardOut)
def save_reward(period_type: str, period_start: date, payload: schemas.RewardIn, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    if period_type not in {"daily", "weekly"}:
        raise HTTPException(422, "Period type must be daily or weekly")
    reward_text = payload.reward_text.strip()
    if not reward_text:
        raise HTTPException(422, "Reward cannot be empty")
    if period_type == "weekly" and period_start.weekday() != 0:
        raise HTTPException(422, "Weekly rewards must use the Monday of that week")
    reward = db.scalar(select(models.Reward).where(models.Reward.user_id == user.id, models.Reward.period_type == period_type, models.Reward.period_start == period_start))
    if reward:
        reward.reward_text = reward_text
    else:
        reward = models.Reward(user_id=user.id, period_type=period_type, period_start=period_start, reward_text=reward_text)
        db.add(reward)
    db.commit()
    db.refresh(reward)
    return reward
