from typing import Union, Dict, Any, Annotated
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from typing_extensions import TypedDict
from langchain_openai import ChatOpenAI
import os

app = FastAPI()

# Grade output schema
class RelevanceGrade(TypedDict):
    explanation: Annotated[str, ..., "Explain your reasoning for the score"]
    relevant: Annotated[bool, ..., "Provide the score on whether the answer addresses the question"]

# Grade prompt
relevance_instructions = """You are a teacher grading a quiz. 
You will be given a QUESTION and a STUDENT ANSWER. 
Here is the grade criteria to follow:
(1) Ensure the STUDENT ANSWER is concise and relevant to the QUESTION
(2) Ensure the STUDENT ANSWER helps to answer the QUESTION
Relevance:
A relevance value of True means that the student's answer meets all of the criteria.
A relevance value of False means that the student's answer does not meet all of the criteria.
Explain your reasoning in a step-by-step manner to ensure your reasoning and conclusion are correct. 
Avoid simply stating the correct answer at the outset."""

# Grader LLM
relevance_llm = ChatOpenAI(model="gpt-4o", temperature=0).with_structured_output(RelevanceGrade, method="json_schema", strict=True)

# Evaluator function
def relevance(inputs: dict, outputs: dict) -> bool:
    """A simple evaluator for RAG answer helpfulness."""
    answer = f"QUESTION: {inputs['question']}\nSTUDENT ANSWER: {outputs['answer']}"
    grade = relevance_llm.invoke([
        {"role": "system", "content": relevance_instructions}, 
        {"role": "user", "content": answer}
    ])
    return grade["relevant"]

# Pydantic models for FastAPI
class EvaluationModel(BaseModel):
    input: str
    output: Dict[str, Any]
    reference: str

class EvaluationResponse(BaseModel):
    is_relevant: bool
    explanation: str
    score: float

class EvaluationRequest(BaseModel):
    question: str
    answer: str
    reference: str = None

@app.post("/evaluate")
def evaluate(request: EvaluationModel):
    """
    Evaluate the relevance of an output given an input question
    """
    try:
        # Prepare data for evaluation
        inputs = {"question": request.input}
        outputs = {"answer": request.output.get("answer", "")}
        
        # Get evaluation result
        answer = f"QUESTION: {inputs['question']}\nSTUDENT ANSWER: {outputs['answer']}"
        grade = relevance_llm.invoke([
            {"role": "system", "content": relevance_instructions}, 
            {"role": "user", "content": answer}
        ])
        
        return EvaluationResponse(
            is_relevant=grade["relevant"],
            explanation=grade["explanation"],
            score=1.0 if grade["relevant"] else 0.0
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")

@app.post("/evaluate-simple")
def evaluate_simple(request: EvaluationRequest):
    """
    Simplified evaluation endpoint with direct question/answer input
    """
    try:
        # Prepare data for evaluation
        inputs = {"question": request.question}
        outputs = {"answer": request.answer}
        
        # Use the relevance function
        is_relevant = relevance(inputs, outputs)
        
        # Get detailed grade for explanation
        answer = f"QUESTION: {inputs['question']}\nSTUDENT ANSWER: {outputs['answer']}"
        grade = relevance_llm.invoke([
            {"role": "system", "content": relevance_instructions}, 
            {"role": "user", "content": answer}
        ])
        
        return EvaluationResponse(
            is_relevant=is_relevant,
            explanation=grade["explanation"],
            score=1.0 if is_relevant else 0.0
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
