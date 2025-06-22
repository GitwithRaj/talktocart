from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os
import json

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI() 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str
    cart: dict

ALLOWED_ITEMS = ["shirt", "pants", "jeans", "tshirt", "shoes", "jacket", "hat", "socks"]
MAX_QTY = 5

@app.post("/parse")
async def parse_prompt(data: PromptRequest):
    try:
        prompt = data.prompt
        cart = data.cart

        # system_msg = (
        #     "You are a smart fashion cart assistant.\n"
        #     f"Current cart: {json.dumps(cart)}\n\n"
        #     f"Allowed items: {ALLOWED_ITEMS}\n"
        #     f"Rules:\n"
        #     "- You can return JSON with `add`, `remove`, and `message` if the prompt is a cart command.\n"
        #     "- You must respect limits: can't add > {MAX_QTY} of an item, can't remove items not in cart.\n"
        #     "- If the requested amount exceeds the maximum allowed (5), return only the allowed quantity in the `add` object, and clearly explain in `message` that some were rejected."
        #     "- If the user says something unrelated to the cart (like 'hi', 'help', 'return policy'), just respond with:\n"
        #     "  { \"message\": \"(your natural-language answer here)\" }\n"
        #     "- Never fail silently. Always return a JSON object.\n"
        # )
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
            "- You must calculate the final quantity of each item by adding the requested amount to the existing cart quantity.\n"
            f"- If the final quantity for any item exceeds {MAX_QTY}, reject it and mention the reason in `message`.\n"
            "- Example: If the user has 1 hat and asks for 3 more, allow it (total 4).\n"
            "- But if they have 4 and ask for 2 more, add 1 and reject the excess with a message.\n"
            "- If the requested amount exceeds the maximum allowed (5), only add up to the allowed amount and clearly explain in the message that the rest was rejected."
            "- If the user already has the maximum allowed quantity of an item, do not add more. Just include a message that it's already at the limit."
            "- Always include a `message` key explaining what was added/removed or rejected.\n"
            "- If the prompt is unrelated (like 'hello' or 'return policy'), just return:\n"
            "  { \"message\": \"Your natural-language reply here.\" }\n"
            "- Return only JSON — no markdown, no extra explanation.\n"
        )

        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                { "role": "system", "content": system_msg },
                { "role": "user", "content": prompt }
            ],
            temperature=0.3
        )

        content = response.choices[0].message.content.strip()

        try:
            json_data = json.loads(content)

            valid_add = {}
            add_msg = []

            for item, qty in (json_data.get("add") or {}).items():
                current_qty = cart.get(item, 0)
                remaining_capacity = MAX_QTY - current_qty

                if current_qty >= MAX_QTY:
                    add_msg.append(f"❌ You already have {MAX_QTY} {item}(s). Cannot add more.")
                elif remaining_capacity <= 0:
                    add_msg.append(f"❌ Cannot add any more {item}(s). Max limit of {MAX_QTY} reached.")
                elif qty <= remaining_capacity:
                    valid_add[item] = qty
                    add_msg.append(f"✅ Added {qty} {item}(s).")
                else:
                    valid_add[item] = remaining_capacity
                    add_msg.append(
                        f"⚠️ You already have {current_qty} {item}(s). "
                        f"✅ Added {remaining_capacity}. ❌ Could not add {qty - remaining_capacity} — max limit is {MAX_QTY}."
                    )

            return {
                "add": valid_add,
                "remove": json_data.get("remove", {}),
                "message": "\n".join(add_msg) or json_data.get("message", "✅ No message returned.")
            }   


        except json.JSONDecodeError:
            return {
                "add": {},
                "remove": {},
                "message": "❌ Could not parse response. Please try again."
            }

    except Exception as e:
        return {
            "add": {},
            "remove": {},
            "message": "❌ Oops! Something went wrong while processing your request. Please try again shortly."
        }
