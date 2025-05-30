# from langchain_ollama.llms import OllamaLLM
# from langchain_core.prompts import ChatPromptTemplate

# model = OllamaLLM(model="gemma3:4b")

# template = """ """
from langchain.evaluation import load_evaluator

evaluator = load_evaluator("qa")
evaluator.evaluate_strings(
    prediction="We sold more than 40,000 units last week",
    input="How many units did we sell last week?",
    reference="We sold 32,378 units",
)
