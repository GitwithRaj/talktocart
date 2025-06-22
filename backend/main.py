from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os
import json

# Load environment variables
load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI()

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic input model
class PromptRequest(BaseModel):
    prompt: str
    cart: dict

# Config
ALLOWED_ITEMS = ["shirt", "pants", "jeans", "tshirt", "shoes", "jacket", "hat", "socks"]
MAX_QTY = 5

@app.post("/parse")
async def parse_prompt(data: PromptRequest):
    try:
        prompt = data.prompt.lower().strip()
        cart = data.cart

        # 🎯 Check for invoice-related prompts directly
        if any(keyword in prompt for keyword in ["invoice", "bill", "download invoice", "generate invoice", "receipt"]):
            return {
                "add": {},
                "remove": {},
                "message": "📄 Generating your invoice...",
                "action": "generate_invoice"
            }

        # 💬 LLM prompt
        system_msg = (
            "You are a smart fashion cart assistant.\n"
            f"User's current cart: {json.dumps(cart)}\n\n"
            f"Allowed items: {ALLOWED_ITEMS}\n"
            f"Maximum quantity per item: {MAX_QTY}\n\n"
            "Your task:\n"
            "- If the prompt is about adding/removing items, return:\n"
            "  {\n"
            "    \"add\": {\"shirt\": 2},\n"
            "    \"remove\": {\"hat\": 1},\n"
            "    \"message\": \"✅ Added 2 shirts. ✅ Removed 1 hat.\"\n"
            "  }\n"
            "- You must calculate the final quantity by combining with current cart.\n"
            "- If a request exceeds the max quantity, cap it and explain clearly.\n"
            "- If the prompt is unrelated (like 'hi', 'return policy', 'generate invoice'), return only:\n"
            "  { \"message\": \"(Your helpful response)\" }\n"
            "- Always respond with valid JSON, no markdown or explanation."
        )

        # 🔁 Call Groq LLM
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )

        content = response.choices[0].message.content.strip()

        # 🧠 Parse and validate
        try:
            json_data = json.loads(content)

            valid_add = {}
            add_msg = []

            for item, qty in (json_data.get("add") or {}).items():
                current_qty = cart.get(item, 0)
                remaining = MAX_QTY - current_qty

                if current_qty >= MAX_QTY:
                    add_msg.append(f"❌ {item}: Already at limit ({MAX_QTY}).")
                elif qty <= remaining:
                    valid_add[item] = qty
                    add_msg.append(f"✅ Added {qty} {item}(s).")
                else:
                    valid_add[item] = remaining
                    add_msg.append(f"⚠️ Added {remaining} {item}(s), couldn't add {qty - remaining} due to limit.")

            return {
                "add": valid_add,
                "remove": json_data.get("remove", {}),
                "message": "\n".join(add_msg) or json_data.get("message", "✅ No message returned.")
            }

        except json.JSONDecodeError:
            return {
                "add": {},
                "remove": {},
                "message": "❌ Could not parse response from LLM."
            }

    except Exception as e:
        return {
            "add": {},
            "remove": {},
            "message": "❌ Backend error. Please try again."
        }
