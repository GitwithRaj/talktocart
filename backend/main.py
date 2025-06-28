from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os
import json

# Load .env variables
load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
 
app = FastAPI()

# Allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:3000"],
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input data model
class PromptRequest(BaseModel):
    prompt: str
    cart: dict

# Config
ALLOWED_ITEMS = [
    "shirt",
    "pants",
    "jeans",
    "tshirt",
    "shoes",
    "jacket",
    "hat",
    "socks",
    "scarf",
    "blazer",
    "skirt",
    "sweater",
    "shorts",
    "watch",
    "belt",
    "sunglasses",
    "handbag",
    "boots",
  ]
MAX_QTY = 5
# Define item prices to be used in budget calculation
ITEM_PRICES = {
    "shirt": 20,
    "pants": 25,
    "jeans": 30,
    "tshirt": 15,
    "shoes": 50,
    "jacket": 60,
    "hat": 10,
    "socks": 5,
    "scarf": 12,
    "blazer": 45,
    "skirt": 22,
    "sweater": 35,
    "shorts": 18,
    "watch": 80,
    "belt": 15,
    "sunglasses": 25,
    "handbag": 55,
    "boots": 65
}

@app.post("/parse")
async def parse_prompt(data: PromptRequest):
    try:
        prompt = data.prompt.lower().strip()
        cart = data.cart

        # 🧠 Step 1: Handle UI prompts
        if any(word in prompt for word in ["color", "background", "style", "theme", "layout", "font", "ui", "look"]):
            system_msg = (
                f"You are a helpful UI assistant.\n"
                f"The user said: \"{prompt}\"\n\n"
                "Convert the user's message into valid JSON for CSS changes.\n"
                "Output format:\n"
                "{\n"
                "  \"action\": \"update_ui\",\n"
                "  \"cssChanges\": {\n"
                "    \"selector\": { \"cssProperty\": \"value\" }\n"
                "  },\n"
                "  \"message\": \"Confirmation text for the user\"\n"
                "}\n"
                "Only output a valid JSON object. No markdown or extra text."
            )

            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )

            try:
                return json.loads(response.choices[0].message.content.strip())
            except Exception as e:
                return {
                    "add": {},
                    "remove": {},
                    "message": f"❌ UI response could not be parsed: {str(e)}"
                }

        # 🧾 Step 2: Invoice
        if any(keyword in prompt for keyword in ["invoice", "bill", "download invoice", "generate invoice", "receipt"]):
            return {
                "add": {},
                "remove": {},
                "message": "📄 Generating your invoice...",
                "action": "generate_invoice"
            }
        # 💰 Step 2.5: Budget query logic
        if any(keyword in prompt for keyword in ["what can i buy", "what can i afford", "i have", "budget", "spend"]):
            import re
            match = re.search(r"\$?(\d+)", prompt)
            if match:
                budget = int(match.group(1))
                response_lines = []
                for item, price in ITEM_PRICES.items():
                    max_qty = min(budget // price, MAX_QTY)
                    if max_qty > 0:
                        response_lines.append(f"{max_qty} {item}(s) at ${price} each")
                if response_lines:
                    return {
                        "add": {},
                        "remove": {},
                        "message": f"💰 With ${budget}, you can buy:\n- " + "\n- ".join(response_lines)
                    }
                else:
                    return {
                        "add": {},
                        "remove": {},
                        "message": f"⚠️ With ${budget}, you cannot afford any available items."
                    }
            else:
                return {
                    "add": {},
                    "remove": {},
                    "message": "❌ Couldn't determine your budget amount."
                }

        # 🛒 Step 3: Cart logic
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
            "- If the prompt is unrelated (like 'hi', 'return policy'), return only:\n"
            "  { \"message\": \"(polite response)\" }\n"
            "- Always return valid JSON. No markdown or comments."
        )

        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt}
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
            "message": f"❌ Backend error: {str(e)}"
        }
