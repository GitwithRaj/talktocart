from fastapi import FastAPI, Request
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os
import json
import re

import httpx


load_dotenv()
# Load .env variables
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY is missing in environment variables")

client = Groq(api_key=api_key)
app = FastAPI()

# Allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:3000", "https://talktocart.onrender.com"],
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input data model
class PromptRequest(BaseModel):
    prompt: str
    cart: dict

ALLOWED_ITEMS = [
    "shirt", "pants", "jeans", "tshirt", "shoes", "jacket", "hat", "socks",
    "scarf", "blazer", "skirt", "sweater", "shorts", "watch", "belt", "sunglasses",
    "handbag", "boots"
]

MAX_QTY = 5

ITEM_PRICES = {
    "shirt": 20, "pants": 25, "jeans": 30, "tshirt": 15, "shoes": 50, "jacket": 60,
    "hat": 10, "socks": 5, "scarf": 12, "blazer": 45, "skirt": 22, "sweater": 35,
    "shorts": 18, "watch": 80, "belt": 15, "sunglasses": 25, "handbag": 55, "boots": 65
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
            print(f"UI prompt detected: {prompt}")
            try:
                response = client.chat.completions.create(
                   model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3
                )
            except Exception as e:
                print("❌ Groq call failed:", e)
                return {
                    "add": {},
                    "remove": {},
                    "message": f"❌ Groq call failed: {e}"
                }
            print(f"UI response: {response.choices[0].message.content.strip()}")
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

        # 💬 Step 3: Auth prompts
        if any(k in prompt for k in ["login", "register", "logout", "sign in", "sign up"]):
            system_auth_msg = (
                "You are a login assistant. Given a user's prompt, extract their intent (login/register/logout),"
                " and credentials if applicable. Respond only in JSON like this:\n"
                "{\n"
                "  \"action\": \"login\",\n"
                "  \"username\": \"raj@example.com\",\n"
                "  \"password\": \"mypassword\"\n"
                "}\n"
                "For logout, just include { \"action\": \"logout\" }."
            )

            auth_response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_auth_msg},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )

            try:
                parsed = json.loads(auth_response.choices[0].message.content.strip())
                action = parsed.get("action")

                if action == "logout":
                    return {"add": {}, "remove": {}, "message": "🚪 Successfully logged out.", "action": "logout"}

                if action in ["login", "register"]:
                    username = parsed.get("username")
                    password = parsed.get("password")
                    if not username or not password:
                        return {"add": {}, "remove": {}, "message": "❌ Missing username or password."}

                    async with httpx.AsyncClient() as Client:
                        res = await Client.get(f"https://talktocartserver.onrender.com/users?username={username}")
                        users = res.json()

                        if action == "login":
                            if users and users[0]["password"] == password:
                                return {"add": {}, "remove": {}, "message": f"✅ Login successful as {username}.", "action": "login", "user": users[0]}
                            return {"add": {}, "remove": {}, "message": "❌ Invalid credentials."}

                        if action == "register":
                            if users:
                                return {"add": {}, "remove": {}, "message": "⚠️ Username already exists."}

                            payload = {"username": username, "password": password}
                            create_res = await Client.post("https://talktocartserver.onrender.com/users", json=payload)
                            if create_res.status_code == 201:
                                return {"add": {}, "remove": {}, "message": f"✅ Registered successfully as {username}.", "action": "register", "user": payload}
                            return {"add": {}, "remove": {}, "message": "❌ Registration failed."}

            except Exception as e:
                return {"add": {}, "remove": {}, "message": f"❌ Auth parsing failed: {str(e)}"}

        # 💰 Step 4: Budget
        if any(keyword in prompt for keyword in ["what can i buy", "what can i afford", "i have", "budget", "spend"]):
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

        # 🛒 Step 5: Cart logic
        system_msg = (
            "You are a smart fashion cart assistant.\n"
            f"User's current cart: {json.dumps(cart)}\n\n"
            f"Allowed items: {ALLOWED_ITEMS}\n"
            f"Maximum quantity per item: {MAX_QTY}\n\n"
            "Your task:\n"
            "- If the prompt is about adding/removing items, return:\n"
            "  {\"add\": {\"shirt\": 2}, \"remove\": {\"hat\": 1}, \"message\": \"...\" }\n"
            "- Cap quantities at max and explain.\n"
            "- If unrelated, return a polite message.\n"
            "- Always output valid JSON."
        )

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
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
