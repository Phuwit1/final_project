from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time

class Customer(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    phone_number: str
    birth_date: datetime
    
class CustomerLogin(BaseModel):
    email: str
    password: str

class CustomerOut(BaseModel):
    email: str
    token: str
    refresh_token: str 

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class TripGroup(BaseModel):
    name_group: str
    description: Optional[str] = ""
    start_date: datetime
    end_date: datetime
    
class GroupMember(BaseModel):
    customer_id: int
    trip_id: int

class Budget(BaseModel):
    trip_id: Optional[int] = None
    plan_id: Optional[int] = None
    total_budget: float

class BudgetUpdate(BaseModel):
    total_budget: int

class Expense(BaseModel):
    budget_id: int
    category: str
    amount: float
    description: Optional[str] = ""

class TripPlan(BaseModel):
    name_group: str
    start_plan_date: datetime
    end_plan_date: datetime
    day_of_trip: Optional[int] = None
    trip_id: Optional[int] = None
    
    
class TripSchedule(BaseModel):
    plan_id: int
    date: date  
    time: time
    activity: str = Field(..., max_length=300)
    description: str = Field("", max_length=300)

class TripScheduleDocIn(BaseModel):  
    plan_id: int
    payload: Dict[str, Any]

class TripScheduleBulkRequest(BaseModel):
    items: List[TripSchedule]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatBody(BaseModel):
    start_date: str
    end_date: str
    messages: List[ChatMessage]
    itinerary_data: Optional[dict] = None

class City(BaseModel):
    id: int
    name: str

class JoinGroupRequest(BaseModel):
    unique_code: str