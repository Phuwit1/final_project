from typing import Union, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
import psycopg2
from sentence_transformers import SentenceTransformer
import ollama
import json
# import uvicorn

app = FastAPI()
embedder = SentenceTransformer("BAAI/bge-m3")

# if __name__ == "__main__":
#     uvicorn.run("evaluation:app", host="0.0.0.0", port=8001, reload=True)

class EvaluationRequest(BaseModel):
    input: str
    response: Dict[str, Any]
    # reference: str
    
def query_documents(query_text, k=3):
    conn = psycopg2.connect(
        host="localhost",
        database="LLM",
        user="postgres",
        password="password"
    )

    cur = conn.cursor()
    query_embedding = embedder.encode(query_text).tolist()
    query_embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
    query = """
        SELECT content, embedding <=> %s::vector AS similarity_score
        FROM documents
        ORDER BY similarity_score ASC
        LIMIT %s
    """
    cur.execute(query, (query_embedding_str, k))
    results = cur.fetchall()
    cur.close()
    conn.close()
    print("Query results:", results)
    return results

@app.post("/evaluate")
async def evaluate(request: EvaluationRequest):
    retrieved_docs = query_documents(request.input)
    reference = "\n".join([i[0] for i in retrieved_docs])
    
    json_format = """
    {
        "scores": {
            "accuracy": [1-5],
            "rag_alignment": [1-5], 
            "query_relevance": [1-5],
            "travel_feasibility": [1-5]
        },
        "explanations": {
            "accuracy": "Detailed explanation of accuracy score",
            "rag_alignment": "Explanation of how well response uses reference documents", 
            "query_relevance": "Explanation of how well response addresses the query",
            "travel_feasibility": "Explanation of practicality for actual travelers"
        },
        "overall_assessment": "Brief summary of overall response quality",
        "improvement_suggestions": ["suggestion1", "suggestion2", "..."]
        }
    """
    
    prompt = f""" 
        Please evaluate the following travel response based on the input query and reference documents:
        Input Query: {request.input}
        Response: {request.response}
        Reference Documents: {reference}
        Evaluation Criteria
        Rate the response on a scale of 1-5 for each criterion:
        
        1. Accuracy (1-5)

        How factually correct is the travel information provided?
        Are locations, prices, operating hours, and other details accurate?
        Does the information align with the reference documents?

        2. RAG Alignment (1-5)

        How well does the response utilize information from the reference documents?
        Is the response grounded in the provided RAG context?
        Are there any hallucinations or information not supported by references?

        3. Query Relevance (1-5)

        How well does the response address the specific travel query asked?
        Does it answer what the user actually wanted to know?
        Is the response focused and on-topic?

        4. Travel Feasibility (1-5)

        How practical and realistic are the travel suggestions?
        Can travelers actually follow the recommendations provided?
        Are the suggestions logistically possible (timing, transportation, accessibility)?
        Do the recommendations consider practical travel constraints?

        Response Format
        Provide your evaluation in the following JSON format: {json_format}
        
        Scoring Guidelines
            5: Excellent - Meets all expectations
            4: Good - Meets most expectations with minor issues
            3: Average - Adequate but has some notable issues
            2: Below Average - Has significant problems
            1: Poor - Major issues that make response unreliable/unusable
        
    """
    response = ollama.chat(model="gemma3:4b", messages=[
        {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip."},
        # {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip to **thai language**."},
        {"role": "user", "content" : prompt},
    ])
    
    response_answer = response.get("message", {}).get("content", "No content available")
    response_answer = response_answer.strip().replace("\n", "").replace("```", "")
    if response_answer.startswith('json'):
        response_answer = response_answer[4:]
    # return response_answer
    try:
        data = json.loads(response_answer)
        print("Method 1 successful")
    except json.JSONDecodeError as e:
        print(f"Method 1 failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse JSON from model response")

    return data
