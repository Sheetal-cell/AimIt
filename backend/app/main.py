import os
from datetime import date, datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from .database import Base, engine, get_db
from . import models, schemas
from .security import hash_password, verify_password, create_access_token, current_user
if os.getenv("JWT_SECRET", "unsafe-development-secret-change-me")=="unsafe-development-secret-change-me": print("WARNING: Set JWT_SECRET in backend/.env before using real accounts.")
Base.metadata.create_all(bind=engine)
app=FastAPI(title="Momentum API",version="0.2.0")
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:5173","http://127.0.0.1:5173","https://aim-it-six.vercel.app"],allow_credentials=True,allow_methods=["GET","POST","PATCH","DELETE"],allow_headers=["Authorization","Content-Type"])
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
