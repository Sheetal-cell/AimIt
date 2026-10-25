from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, EmailStr
class RegisterIn(BaseModel):
    email: EmailStr
    password: str=Field(min_length=10,max_length=128)
    display_name: str=Field(min_length=1,max_length=80)
class LoginIn(BaseModel):
    email: EmailStr
    password: str=Field(min_length=1,max_length=128)
class UserOut(BaseModel):
    id:int; email:EmailStr; display_name:str
    model_config=ConfigDict(from_attributes=True)
class TokenOut(BaseModel):
    access_token:str; token_type:str="bearer"; user:UserOut
class GoalCreate(BaseModel):
    title:str=Field(min_length=1,max_length=160); description:str|None=None; category:str="Personal"; target_date:date|None=None
class GoalUpdate(BaseModel):
    title:str|None=Field(default=None,min_length=1,max_length=160); description:str|None=None; category:str|None=None; target_date:date|None=None
class GoalOut(GoalCreate):
    id:int; status:str; created_at:datetime
    model_config=ConfigDict(from_attributes=True)
class TaskCreate(BaseModel):
    title:str=Field(min_length=1,max_length=200); notes:str|None=None; due_date:date; priority:str="medium"; estimated_minutes:int=Field(default=30,ge=1,le=1440); goal_id:int|None=None
class TaskUpdate(BaseModel):
    title:str|None=Field(default=None,min_length=1,max_length=200); notes:str|None=None; due_date:date|None=None; priority:str|None=None; estimated_minutes:int|None=Field(default=None,ge=1,le=1440); goal_id:int|None=None
class TaskOut(TaskCreate):
    id:int; completed:bool; completed_at:datetime|None=None; created_at:datetime
    model_config=ConfigDict(from_attributes=True)
class MilestoneCreate(BaseModel):
    title:str=Field(min_length=1,max_length=180); description:str|None=None; due_date:date|None=None; goal_id:int
class MilestoneOut(MilestoneCreate):
    id:int; status:str; created_at:datetime
    model_config=ConfigDict(from_attributes=True)
class MilestoneUpdate(BaseModel): status:str


class RewardIn(BaseModel):
    reward_text: str = Field(min_length=1, max_length=240)
class RewardOut(BaseModel):
    id: int
    period_type: str
    period_start: date
    reward_text: str
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
